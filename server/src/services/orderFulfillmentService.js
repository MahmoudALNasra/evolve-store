const Product = require('../models/Product')
const User = require('../models/User')
const { sendOrderConfirmation, sendNewOrderNotification } = require('./emailService')
const { applySaleItems } = require('./inventorySyncService')
const { reconcileOrderFromStripeSession } = require('./stripeOrderReconcile')

/**
 * Resolve a user-like object with email for transactional mail.
 * Handles unpopulated ObjectIds and falls back to Stripe customer email.
 */
async function resolveRecipient(order, session) {
  let userDoc = order.user

  if (userDoc && typeof userDoc === 'object' && userDoc.email) {
    return userDoc
  }

  const userId = userDoc?._id || userDoc
  if (userId) {
    userDoc = await User.findById(userId).select('name email')
  }

  const stripeEmail =
    session?.customer_details?.email ||
    session?.customer_email ||
    ''

  if (userDoc?.email) return userDoc

  if (stripeEmail) {
    return {
      _id: userDoc?._id || userId || undefined,
      name: userDoc?.name || session?.customer_details?.name || 'Customer',
      email: stripeEmail,
    }
  }

  return userDoc || null
}

/**
 * Idempotently mark a Stripe Checkout order as paid, reduce stock once,
 * and send the confirmation email once.
 */
async function fulfillPaidCheckoutOrder(order, session) {
  if (!order) return { ok: false, reason: 'order_not_found' }

  const alreadyPaid = Boolean(order.isPaid)

  if (!order.isPaid) {
    order.isPaid = true
    order.paidAt = new Date()
    order.status = 'processing'
  }

  if (session?.payment_intent) {
    order.stripePaymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent.id || order.stripePaymentIntentId
  }

  // Align stored totals / payment method with what Stripe actually charged.
  await reconcileOrderFromStripeSession(order, session)

  // Backward compatibility for orders created before checkout began reserving stock.
  if (!order.stockReduced) {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } })
    }
    order.stockReduced = true
  }

  await order.save()

  const recipient = await resolveRecipient(order, session)

  // Always attempt confirmation after reconcile so totals/payment details are accurate.
  // (Skip only if already sent.)
  if (!order.confirmationEmailSent) {
    try {
      if (!recipient?.email) {
        console.warn(
          `Order confirmation email skipped for ${order._id}: no customer email on user or Stripe session`
        )
      } else {
        const sent = await sendOrderConfirmation(order, recipient)
        if (sent) {
          order.confirmationEmailSent = true
          await order.save()
        }
      }
    } catch (err) {
      console.error(`Order confirmation email threw for ${order._id}:`, err.message)
    }
  }

  if (!order.newOrderEmailSent) {
    try {
      const sent = await sendNewOrderNotification(order, recipient)
      if (sent) {
        order.newOrderEmailSent = true
        await order.save()
      }
    } catch (err) {
      console.error(`New order notification threw for ${order._id}:`, err.message)
    }
  }

  if (process.env.INVENTORY_SYNC_ON_ORDERS === 'true' && !order.inventorySynced) {
    try {
      await applySaleItems(
        order.items.map((item) => ({
          productId: item.product,
          quantity: item.quantity,
        })),
        { updateWebsiteStock: false }
      )
      order.inventorySynced = true
      await order.save()
    } catch (err) {
      console.error('Order inventory sync failed:', err.message)
    }
  }

  return { ok: true, order, alreadyPaid }
}

module.exports = { fulfillPaidCheckoutOrder, resolveRecipient }
