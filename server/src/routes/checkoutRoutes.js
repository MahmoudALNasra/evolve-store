const express = require('express')
const Stripe = require('stripe')
const Order = require('../models/Order')
const Product = require('../models/Product')
const { protect } = require('../middleware/auth')

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Shipping rules — keep in sync with client/src/lib/utils.js
const FREE_SHIPPING_THRESHOLD = 100
const STANDARD_SHIPPING_RATE = 11.99

// Valid US state codes
const US_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY'
])

// Validate US shipping address
const validateUSAddress = (addr) => {
  if (!addr || typeof addr !== 'object') return 'Shipping address is required'
  if (!addr.line1 || !addr.line1.trim()) return 'Street address is required'
  if (!/\d/.test(addr.line1) || addr.line1.trim().length < 5) return 'Invalid street address'
  if (!addr.city || !/^[a-zA-Z\s\-'.]{2,}$/.test(addr.city.trim())) return 'Invalid city'
  if (!addr.state || !US_STATE_CODES.has(addr.state)) return 'Invalid US state'
  if (!addr.zip || !/^\d{5}(-\d{4})?$/.test(addr.zip)) return 'Invalid US ZIP code'
  return null
}

// @POST /api/checkout — create Stripe checkout session
router.post('/', protect, async (req, res) => {
  const { items, shippingAddress } = req.body

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No items in cart' })
  }

  // Validate shipping address (US only)
  const addressError = validateUSAddress(shippingAddress)
  if (addressError) {
    return res.status(400).json({ message: addressError })
  }

  // Fetch products from DB
  const productIds = items.map((i) => i.product)
  const products = await Product.find({ _id: { $in: productIds } })

  // Build order items
  const orderItems = []
  let subtotal = 0

  for (const cartItem of items) {
    const product = products.find((p) => p._id.toString() === cartItem.product)
    if (!product) return res.status(404).json({ message: `Product ${cartItem.product} not found` })
    if (product.stock < cartItem.quantity)
      return res.status(400).json({ message: `Insufficient stock for ${product.name}` })

    subtotal += product.price * cartItem.quantity

    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.images[0]?.url || '',
      price: product.price,
      quantity: cartItem.quantity,
    })
  }

  // Compute shipping ($5.99 unless subtotal >= $100)
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_RATE
  const total = subtotal + shipping

  // Create order in DB
  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress: shippingAddress || {},
    subtotal,
    shipping,
    total,
    paymentMethod: 'stripe',
    status: 'pending',
  })

  // Create Stripe line items
  const lineItems = orderItems.map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.name,
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.quantity,
  }))

  // Create Stripe checkout session (US shipping only)
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    shipping_address_collection: { allowed_countries: ['US'] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: Math.round(shipping * 100), currency: 'usd' },
          display_name: shipping === 0 ? 'Free Shipping' : 'Standard Shipping',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 3 },
            maximum: { unit: 'business_day', value: 7 },
          },
        },
      },
    ],
    success_url: `${process.env.CLIENT_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/cart`,
    customer_email: req.user.email,
    metadata: {
      orderId: order._id.toString(),
      userId: req.user._id.toString(),
    },
  })

  // Save session ID to order
  order.stripeSessionId = session.id
  await order.save()

  res.json({ url: session.url })
})

module.exports = router
