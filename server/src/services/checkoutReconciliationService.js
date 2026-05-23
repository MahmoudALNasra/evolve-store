const mongoose = require('mongoose')
const Stripe = require('stripe')
const Order = require('../models/Order')
const { fulfillPaidCheckoutOrder } = require('./orderFulfillmentService')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

let reconcileTimer = null
let reconciliationRunning = false

async function reconcilePaidCheckoutOrders({ limit = 25 } = {}) {
  if (mongoose.connection.readyState !== 1) return { checked: 0, fulfilled: 0, skipped: true }

  const orders = await Order.find({
    stripeSessionId: { $exists: true, $ne: '' },
    $or: [
      { isPaid: false, status: 'pending' },
      { isPaid: true, confirmationEmailSent: { $ne: true } },
      { isPaid: true, newOrderEmailSent: { $ne: true } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email')

  let fulfilled = 0

  for (const order of orders) {
    try {
      const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId)
      const paid = session.payment_status === 'paid' || session.status === 'complete'

      if (!paid) continue

      await fulfillPaidCheckoutOrder(order, session)
      fulfilled += 1
      console.log(`✅ Reconciled paid Stripe order ${order._id}`)
    } catch (err) {
      console.error(`Checkout reconciliation failed for order ${order._id}:`, err.message)
    }
  }

  return { checked: orders.length, fulfilled }
}

function startCheckoutReconciliation() {
  if (reconcileTimer || process.env.CHECKOUT_RECONCILIATION_ENABLED === 'false') return

  const intervalMs = Number(process.env.CHECKOUT_RECONCILIATION_INTERVAL_MS || 60000)

  const run = async () => {
    if (reconciliationRunning) return
    reconciliationRunning = true
    try {
      await reconcilePaidCheckoutOrders()
    } catch (err) {
      console.error('Checkout reconciliation loop failed:', err.message)
    } finally {
      reconciliationRunning = false
    }
  }

  setTimeout(run, 5000)
  reconcileTimer = setInterval(run, intervalMs)
  console.log(`Checkout reconciliation enabled every ${Math.round(intervalMs / 1000)}s`)
}

module.exports = {
  reconcilePaidCheckoutOrders,
  startCheckoutReconciliation,
}
