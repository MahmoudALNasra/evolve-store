const express = require('express')
const Stripe = require('stripe')
const Order = require('../models/Order')
const { trackPurchase, trackGa4EventSafe } = require('../services/ga4AnalyticsService')
const { fulfillPaidCheckoutOrder } = require('../services/orderFulfillmentService')
const { releaseReservedStock } = require('../services/inventoryService')

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the event
  try {
    console.log(`📨 Webhook received: ${event.type}`)
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const orderId = session.metadata.orderId
        console.log(`✅ Payment completed for order: ${orderId}`)

        const order = await Order.findById(orderId).populate('user', 'name email')
        if (order) {
          await fulfillPaidCheckoutOrder(order, session)
          console.log(`✅ Order ${orderId} fulfilled from Stripe webhook`)

          // GA4 server-side purchase (idempotent — safe on webhook retries)
          if (!order.ga4PurchaseSent) {
            const phone = session.customer_details?.phone || ''
            const email = session.customer_details?.email || order.user?.email
            trackGa4EventSafe(async () => {
              const result = await trackPurchase(order, order.user, { phone, email })
              if (result?.ok) {
                order.ga4PurchaseSent = true
                await order.save()
              }
            })
          }
        } else {
          console.error(`❌ Order ${orderId} not found`)
        }
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object
        const orderId = session.metadata.orderId

        const order = await Order.findById(orderId)
        if (order && !order.isPaid) {
          order.status = 'cancelled'
          await releaseReservedStock(order)
          await order.save()
        }
        break
      }

      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    res.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    res.status(500).json({ message: 'Webhook handler failed' })
  }
})

module.exports = router
