const express = require('express')
const { protect, optionalAuth } = require('../middleware/auth')
const Product = require('../models/Product')
const { getLiveShippingRates } = require('../services/shipping')
const { guessShipLocation } = require('../services/geoLocationService')
const { getDeliveryEstimate } = require('../services/deliveryEstimateService')
const {
  isPlacesConfigured,
  suggestAddresses,
  getAddressDetails,
} = require('../services/placesAutocompleteService')

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
  if (!addr?.state || !US_STATE_CODES.has(String(addr.state).toUpperCase())) return 'Valid US state is required'
  if (!addr?.zip || !/^\d{5}(-\d{4})?$/.test(String(addr.zip).trim())) return 'Valid US ZIP is required'
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
        'Pick an address from the Google suggestions when available.',
        'Avoid PO boxes if UPS Ground is required.',
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

// GET /api/shipping/address-autocomplete?q=123+main
router.get('/address-autocomplete', protect, async (req, res) => {
  try {
    const result = await suggestAddresses(req.query.q, {
      sessionToken: req.query.sessionToken,
    })
    res.json(result)
  } catch (err) {
    console.error('Address autocomplete error:', err.response?.data || err.message)
    res.status(502).json({
      configured: isPlacesConfigured(),
      suggestions: [],
      message: err.message || 'Address suggestions unavailable',
    })
  }
})

// GET /api/shipping/address-details?placeId=...
router.get('/address-details', protect, async (req, res) => {
  const placeId = String(req.query.placeId || '').trim()
  if (!placeId) return res.status(400).json({ message: 'placeId is required' })

  try {
    const result = await getAddressDetails(placeId, {
      sessionToken: req.query.sessionToken,
    })
    res.json(result)
  } catch (err) {
    console.error('Address details error:', err.response?.data || err.message)
    res.status(502).json({ message: err.message || 'Could not load address details' })
  }
})

// GET /api/shipping/guess-location — account address or IP-based city/ZIP (US only)
router.get('/guess-location', optionalAuth, async (req, res) => {
  const location = await guessShipLocation(req)
  if (!location) {
    return res.json({ location: null })
  }
  res.json({ location })
})

// GET /api/shipping/estimate?zip=78230&city=San+Antonio&state=TX
router.get('/estimate', async (req, res) => {
  const zip = String(req.query.zip || '').trim()
  const city = String(req.query.city || '').trim()
  const state = String(req.query.state || '').trim().toUpperCase().slice(0, 2)

  if (!zip) {
    const guessed = await guessShipLocation(req)
    if (!guessed?.zip) {
      return res.json(buildFallbackOnly())
    }
    const estimate = await getDeliveryEstimate({
      zip: guessed.zip,
      city: guessed.city,
      state: guessed.state,
    })
    return res.json(estimate)
  }

  const estimate = await getDeliveryEstimate({ zip, city, state })
  res.json(estimate)
})

function buildFallbackOnly() {
  return {
    fallback: true,
    message: 'Enter your ZIP code for a delivery estimate from our San Antonio pharmacy.',
    shipsFrom: 'San Antonio, TX',
    originZip: '78258',
  }
}

// POST /api/shipping/rates
router.post('/rates', protect, async (req, res) => {
  const { shippingAddress, items } = req.body || {}
  const normalizedAddress = {
    ...shippingAddress,
    line1: String(shippingAddress?.line1 || '').trim(),
    line2: String(shippingAddress?.line2 || '').trim(),
    city: String(shippingAddress?.city || '').trim(),
    state: String(shippingAddress?.state || '').trim().toUpperCase(),
    zip: String(shippingAddress?.zip || '').trim(),
    country: 'United States',
  }

  const addressError = validateUSAddress(normalizedAddress)
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
      address: normalizedAddress,
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
    // Never block checkout on carrier address quirks — return estimate rates instead.
    console.error('Shipping rates error; returning estimate fallback:', err.response?.data || err.message)
    try {
      const { getShippingQuote } = require('../utils/shippingRates')
      const { getDispatchInfo } = require('../utils/shippingCutoff')
      const { signShippingRateSelection } = require('../utils/shippingRateToken')
      const estimate = getShippingQuote(subtotal, normalizedAddress)
      const rate = {
        objectId: 'estimate',
        amount: estimate.amount,
        originalAmount: estimate.originalAmount ?? estimate.amount,
        freeShippingApplied: Boolean(estimate.isFree),
        label: estimate.label,
        provider: 'Estimate',
        service: estimate.label,
        estimatedDays: null,
        token: signShippingRateSelection({
          mode: 'estimate',
          amount: estimate.amount,
          originalAmount: estimate.originalAmount ?? estimate.amount,
          freeShippingApplied: Boolean(estimate.isFree),
          label: estimate.label,
          zip: normalizedAddress.zip,
        }),
      }
      return res.json({
        mode: 'estimate',
        dispatch: getDispatchInfo(),
        rates: [rate],
        note: 'Carrier could not rate this address exactly; showing an estimate so you can continue.',
      })
    } catch (fallbackErr) {
      console.error('Estimate fallback also failed:', fallbackErr.message)
      const normalized = normalizeShippoError(err)
      return res.status(normalized.status).json(normalized)
    }
  }
})

module.exports = router
