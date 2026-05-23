const express = require('express')
const Stripe = require('stripe')
const Order = require('../models/Order')
const Product = require('../models/Product')
const { protect } = require('../middleware/auth')
const { trackBeginCheckout, trackGa4EventSafe } = require('../services/ga4AnalyticsService')
const { fulfillPaidCheckoutOrder } = require('../services/orderFulfillmentService')
const { reserveStockForItems, releaseReservedStock } = require('../services/inventoryService')
const { getClientIp } = require('../utils/ga4UserData')
const { resolveShippingFromToken } = require('../services/shipping')
const { PICKUP_ADDRESS, validatePickupTime, formatPickupTime } = require('../utils/pickupTimes')
const { calculateSalesTax } = require('../utils/salesTax')

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

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

const getCheckoutClientUrl = (req) => {
  const fallback = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '')
  const origin = req.get('origin')
  if (!origin) return fallback

  try {
    const parsed = new URL(origin)
    if (!['http:', 'https:'].includes(parsed.protocol)) return fallback
    return parsed.origin
  } catch {
    return fallback
  }
}

// @POST /api/checkout — create Stripe checkout session
router.post('/', protect, async (req, res) => {
  const { items, shippingAddress, fulfillmentMethod = 'shipping', pickupTime, shippingRateToken, ga4ClientId } =
    req.body
  const isPickup = fulfillmentMethod === 'pickup'

  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'No items in cart' })
  }

  if (!['shipping', 'pickup'].includes(fulfillmentMethod)) {
    return res.status(400).json({ message: 'Invalid fulfillment method' })
  }

  if (isPickup) {
    const pickupError = validatePickupTime(pickupTime)
    if (pickupError) return res.status(400).json({ message: pickupError })
  } else {
    // Validate shipping address (US only)
    const addressError = validateUSAddress(shippingAddress)
    if (addressError) {
      return res.status(400).json({ message: addressError })
    }
  }

  // Fetch products from DB
  const productIds = items.map((i) => i.product)
  const products = await Product.find({ _id: { $in: productIds }, isPublished: true })

  // Build order items
  const orderItems = []
  let subtotal = 0

  for (const cartItem of items) {
    const quantity = Number(cartItem.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'Invalid item quantity' })
    }

    const product = products.find((p) => p._id.toString() === cartItem.product)
    if (!product) return res.status(404).json({ message: `Product ${cartItem.product} not found` })
    if (product.stock < quantity)
      return res.status(400).json({ message: `Insufficient stock for ${product.name}` })

    subtotal += product.price * quantity

    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.images[0]?.url || '',
      price: product.price,
      quantity,
    })
  }

  let shipping = 0
  let shippingLabel = 'Pharmacy Pickup'
  let shippingMethod = {}

  if (!isPickup) {
    if (!shippingRateToken) {
      return res.status(400).json({ message: 'Please select a shipping option' })
    }
    const resolved = resolveShippingFromToken(shippingRateToken, shippingAddress, { subtotal })
    if (resolved.error) return res.status(400).json({ message: resolved.error })
    shipping = resolved.amount
    shippingLabel = resolved.label
    shippingMethod = resolved.method
  }
  const tax = calculateSalesTax(subtotal)
  const total = subtotal + shipping + tax

  const reservation = await reserveStockForItems(orderItems)
  if (!reservation.ok) {
    return res.status(400).json({ message: reservation.message })
  }

  let order

  try {
    // Create order in DB. stockReduced=true means inventory is already reserved for this session.
    order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress: isPickup ? {} : shippingAddress || {},
    fulfillmentMethod,
    pickup: isPickup
      ? {
          requestedAt: new Date(pickupTime),
          display: formatPickupTime(pickupTime),
          address: PICKUP_ADDRESS,
        }
      : undefined,
    subtotal,
    tax,
    shipping,
    shippingMethod: isPickup ? {} : shippingMethod,
    total,
    paymentMethod: 'stripe',
    status: 'pending',
    stockReduced: true,
    analyticsContext: {
      clientIp: getClientIp(req) || '',
      userAgent: req.get('user-agent') || '',
      ga4ClientId: typeof ga4ClientId === 'string' ? ga4ClientId.trim() : '',
    },
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

    if (tax > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Sales Tax',
          },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      })
    }

    const checkoutClientUrl = getCheckoutClientUrl(req)
    const sessionParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${checkoutClientUrl}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${checkoutClientUrl}/cart`,
      customer_email: req.user.email,
      metadata: {
        orderId: order._id.toString(),
        userId: req.user._id.toString(),
        fulfillmentMethod,
      },
    }

    if (!isPickup) {
      sessionParams.shipping_options = [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: Math.round(shipping * 100), currency: 'usd' },
            display_name: shippingLabel,
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 7 },
            },
          },
        },
      ]
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    // Save session ID to order
    order.stripeSessionId = session.id
    await order.save()

    if (!order.ga4BeginCheckoutSent) {
      trackGa4EventSafe(async () => {
        const result = await trackBeginCheckout(order, req.user, req)
        if (result?.ok) {
          order.ga4BeginCheckoutSent = true
          await order.save()
        }
      })
    }

    res.json({ url: session.url })
  } catch (err) {
    if (order) {
      await releaseReservedStock(order)
      await Order.findByIdAndDelete(order._id)
    } else {
      for (const item of orderItems) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } })
      }
    }
    throw err
  }
})

// @GET /api/checkout/session/:sessionId — success-page fallback if Stripe webhook is delayed/missing locally.
// Public by design: Stripe's session id is an unguessable token, and this returns only minimal status.
router.get('/session/:sessionId', async (req, res) => {
  const session = await stripe.checkout.sessions.retrieve(req.params.sessionId)
  const orderId = session.metadata?.orderId

  if (!orderId) {
    return res.status(404).json({ message: 'Order not found for checkout session' })
  }

  const order = await Order.findById(orderId).populate('user', 'name email')
  if (!order) return res.status(404).json({ message: 'Order not found' })

  const isPaid = session.payment_status === 'paid' || session.status === 'complete'
  if (isPaid) {
    await fulfillPaidCheckoutOrder(order, session)
  }

  res.json({
    orderId: order._id,
    isPaid: order.isPaid,
    status: order.status,
    confirmationEmailSent: order.confirmationEmailSent,
  })
})

module.exports = router
