const Product = require('../models/Product')
const { sendOrderConfirmation, sendNewOrderNotification } = require('./emailService')

/**
 * Idempotently mark a Stripe Checkout order as paid, reduce stock once,
 * and send the confirmation email once.
 */
async function fulfillPaidCheckoutOrder(order, session) {
  if (!order) return { ok: false, reason: 'order_not_found' }

  if (!order.isPaid) {
    order.isPaid = true
    order.paidAt = new Date()
    order.status = 'processing'
  }

  if (session?.payment_intent) {
    order.stripePaymentIntentId = session.payment_intent
  }

  // Backward compatibility for orders created before checkout began reserving stock.
  if (!order.stockReduced) {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } })
    }
    order.stockReduced = true
  }

  await order.save()

  if (!order.confirmationEmailSent && order.user) {
    const sent = await sendOrderConfirmation(order, order.user)
    if (sent) {
      order.confirmationEmailSent = true
      await order.save()
    }
  }

  if (!order.newOrderEmailSent) {
    const sent = await sendNewOrderNotification(order, order.user)
    if (sent) {
      order.newOrderEmailSent = true
      await order.save()
    }
  }

  return { ok: true, order }
}

module.exports = { fulfillPaidCheckoutOrder }
