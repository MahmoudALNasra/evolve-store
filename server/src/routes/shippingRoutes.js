const express = require('express')
const { protect, optionalAuth } = require('../middleware/auth')
const Product = require('../models/Product')
const { getLiveShippingRates } = require('../services/shipping')
const { guessShipLocation } = require('../services/geoLocationService')

const router = express.Router()

const US_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY',
])

function validateUSAddress(addr) {
  if (!addr?.line1?.trim()) return 'Street address is required'
  if (!/\d/.test(addr.line1) || addr.line1.trim().length < 5) {
    return 'Enter the house/building number before the street name, e.g., 123 Main St'
  }
  if (!addr?.city?.trim()) return 'City is required'
  if (!addr?.state || !US_STATE_CODES.has(addr.state)) return 'Valid US state is required'
  if (!addr?.zip || !/^\d{5}(-\d{4})?$/.test(addr.zip)) return 'Valid US ZIP is required'
  return null
}

function normalizeShippoError(err) {
  const status = err.response?.status
  const data = err.response?.data
  const rawMessage = [
    data?.detail,
    data?.message,
    data?.error,
    err.message,
  ].filter(Boolean).join(' ')

  if (status === 401 || status === 403 || /auth|token|api key|permission/i.test(rawMessage)) {
    return {
      status: 502,
      code: 'SHIPPO_AUTH_ERROR',
      message: 'Shipping rates are temporarily unavailable because the carrier connection is not authorized.',
      resolution: 'Store admin: verify SHIPPO_API_KEY is set correctly, restart the API, then reload checkout.',
      suggestions: [
        'Try again in a few minutes.',
        'If this continues, choose pickup or contact the pharmacy so we can help complete the order.',
      ],
    }
  }

  if (status === 400 || /address|zip|postal|state|city|street/i.test(rawMessage)) {
    return {
      status: 400,
      code: 'SHIPPO_ADDRESS_ERROR',
      message: 'The carrier could not rate this shipping address.',
      resolution: 'Check the street address, city, state, and ZIP code. Use a USPS-standard address when possible.',
      suggestions: [
        'Confirm the ZIP code matches the city and state.',
        'Avoid abbreviations that may confuse validation, then request rates again.',
      ],
    }
  }

  if (/No UPS Ground shipping rates/i.test(rawMessage)) {
    return {
      status: 502,
      code: 'NO_UPS_GROUND_RATES',
      message: 'UPS Ground is not available for this address right now.',
      resolution: 'Try a different valid US delivery address, or contact the pharmacy for shipping help.',
      suggestions: [
        'Confirm this is a deliverable US address.',
        'Try again shortly in case the carrier rate service is delayed.',
      ],
    }
  }

  if (err.code === 'ECONNABORTED' || /timeout|network/i.test(rawMessage)) {
    return {
      status: 504,
      code: 'SHIPPO_TIMEOUT',
      message: 'The carrier rate service took too long to respond.',
      resolution: 'Wait a moment and request rates again.',
      suggestions: [
        'Refresh shipping rates before continuing to payment.',
        'If it keeps happening, contact the pharmacy for help.',
      ],
    }
  }

  return {
    status: 502,
    code: 'SHIPPO_RATE_ERROR',
    message: 'We could not load carrier shipping rates right now.',
    resolution: 'Refresh rates and try again. If the issue continues, contact the pharmacy.',
    suggestions: [
      'Re-check the shipping address.',
      'Refresh the page and select a shipping option again.',
    ],
  }
}

// GET /api/shipping/guess-location — account address or IP-based city/ZIP (US only)
router.get('/guess-location', optionalAuth, async (req, res) => {
  const location = await guessShipLocation(req)
  if (!location) {
    return res.json({ location: null })
  }
  res.json({ location })
})

// POST /api/shipping/rates
router.post('/rates', protect, async (req, res) => {
  const { shippingAddress, items } = req.body || {}
  const addressError = validateUSAddress(shippingAddress)
  if (addressError) return res.status(400).json({ message: addressError })

  if (!items?.length) return res.status(400).json({ message: 'Cart is empty' })

  const productIds = items.map((item) => item.product).filter(Boolean)
  const products = await Product.find({ _id: { $in: productIds }, isPublished: true }).select('price')

  let subtotal = 0
  for (const item of items) {
    const qty = Number(item.quantity)
    if (!Number.isInteger(qty) || qty < 1) continue

    const product = products.find((p) => p._id.toString() === item.product)
    if (!product) return res.status(404).json({ message: 'A cart item is no longer available' })

    const price = Number(product.price)
    if (!Number.isFinite(price)) continue
    subtotal += price * qty
  }

  try {
    const result = await getLiveShippingRates({
      subtotal,
      address: shippingAddress,
      user: req.user,
    })

    res.json({
      mode: result.mode,
      shipmentId: result.shipmentId,
      dispatch: result.dispatch,
      rates: result.rates,
      note: result.note,
    })
  } catch (err) {
    console.error('Shipping rates error:', err.response?.data || err.message)
    const normalized = normalizeShippoError(err)
    res.status(normalized.status).json(normalized)
  }
})

module.exports = router
