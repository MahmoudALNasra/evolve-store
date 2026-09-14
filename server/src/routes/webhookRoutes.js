const express = require('express')
const Stripe = require('stripe')
const Order = require('../models/Order')
const { trackPurchase, trackGa4EventSafe } = require('../services/ga4AnalyticsService')
const { fulfillPaidCheckoutOrder } = require('../services/orderFulfillmentService')
const { restoreStockForCancelledOrRefundedOrder } = require('../services/inventoryService')

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function findOrderForStripeObject(obj = {}) {
  const paymentIntentId = typeof obj.payment_intent === 'string'
    ? obj.payment_intent
    : obj.payment_intent?.id || ''
  const sessionId = obj.id && String(obj.id).startsWith('cs_') ? obj.id : ''
  const metaOrderId = obj.metadata?.orderId

  if (metaOrderId) {
    const byMeta = await Order.findById(metaOrderId)
    if (byMeta) return byMeta
  }
  if (paymentIntentId) {
    const byPi = await Order.findOne({ stripePaymentIntentId: paymentIntentId })
    if (byPi) return byPi
  }
  if (sessionId) {
    const bySession = await Order.findOne({ stripeSessionId: sessionId })
    if (bySession) return bySession
  }
  return null
}

async function restoreStockAfterStripeRefund(order, reason) {
  if (!order) return false
  const restored = await restoreStockForCancelledOrRefundedOrder(order, reason)
  if (order.status !== 'cancelled') {
    order.status = 'cancelled'
  }
  await order.save()
  return restored
}

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
          await restoreStockForCancelledOrRefundedOrder(order, 'checkout_expired')
          await order.save()
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object
        const fullyRefunded = Boolean(charge.refunded)
          || Number(charge.amount_refunded || 0) >= Number(charge.amount || 0)
        if (!fullyRefunded) {
          console.log(`Partial Stripe refund for charge ${charge.id} — stock left reserved`)
          break
        }
        const order = await findOrderForStripeObject(charge)
        if (order) {
          order.isPaid = false
          order.paidAt = null
          order.amountPaid = 0
          await restoreStockAfterStripeRefund(order, 'stripe_charge_refunded')
          console.log(`✅ Stock restored after Stripe refund for order ${order._id}`)
        } else {
          console.warn(`⚠️ charge.refunded: no order for PI ${charge.payment_intent}`)
        }
        break
      }

      case 'refund.updated':
      case 'refund.created': {
        const refund = event.data.object
        if (refund.status && refund.status !== 'succeeded') break
        // Prefer charge.refunded for full-order restock; only act when refund has order metadata
        const orderId = refund.metadata?.orderId
        if (!orderId) break
        const order = await Order.findById(orderId)
        if (order) {
          order.isPaid = false
          order.paidAt = null
          order.amountPaid = Math.max(0, Number(order.amountPaid || order.total || 0) - Number(refund.amount || 0) / 100)
          if (Number(order.amountPaid) <= 0.009) {
            order.amountPaid = 0
            await restoreStockAfterStripeRefund(order, 'stripe_refund')
          } else {
            await order.save()
          }
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
