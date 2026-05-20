const express = require('express')
const Stripe = require('stripe')
const Order = require('../models/Order')
const Product = require('../models/Product')

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

        const order = await Order.findById(orderId)
        if (order) {
          console.log(`📦 Updating order ${orderId} to processing`)
          order.isPaid = true
          order.paidAt = new Date()
          order.status = 'processing'
          order.stripePaymentIntentId = session.payment_intent
          await order.save()
          console.log(`✅ Order ${orderId} marked as paid and processing`)

          // Reduce stock
          for (const item of order.items) {
            await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } })
          }
          console.log(`📉 Stock reduced for order ${orderId}`)
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
