const express = require('express')
const { protect } = require('../middleware/auth')
const Product = require('../models/Product')
const { getLiveShippingRates } = require('../services/shipping')

const router = express.Router()

const US_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY',
])

function validateUSAddress(addr) {
  if (!addr?.line1?.trim()) return 'Street address is required'
  if (!addr?.city?.trim()) return 'City is required'
  if (!addr?.state || !US_STATE_CODES.has(addr.state)) return 'Valid US state is required'
  if (!addr?.zip || !/^\d{5}(-\d{4})?$/.test(addr.zip)) return 'Valid US ZIP is required'
  return null
}

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
    res.status(502).json({
      message: err.response?.data?.detail || err.message || 'Unable to fetch shipping rates',
    })
  }
})

module.exports = router
