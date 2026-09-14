const Stripe = require('stripe')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

function centsToDollars(cents) {
  const n = Number(cents)
  if (!Number.isFinite(n)) return 0
  return Math.round(n) / 100
}

function extractPaymentDetails(paymentIntent) {
  const pm = paymentIntent?.payment_method
  if (!pm || typeof pm === 'string') {
    return {
      type: 'card',
      brand: '',
      last4: '',
      funding: '',
      expMonth: null,
      expYear: null,
      wallet: '',
    }
  }

  const card = pm.card || {}
  return {
    type: pm.type || 'card',
    brand: card.brand || '',
    last4: card.last4 || '',
    funding: card.funding || '',
    expMonth: card.exp_month || null,
    expYear: card.exp_year || null,
    wallet: card.wallet?.type || '',
  }
}

/**
 * Pull final paid totals + payment method from Stripe so order/email match the charge.
 */
async function reconcileOrderFromStripeSession(order, sessionInput) {
  if (!order) return order

  let session = sessionInput
  const sessionId = session?.id || order.stripeSessionId
  if (!sessionId) return order

  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.payment_method', 'total_details'],
    })
  } catch (err) {
    console.warn(`Stripe session reconcile failed for order ${order._id}:`, err.message)
    return order
  }

  const discount = centsToDollars(session.total_details?.amount_discount)
  const amountPaid = centsToDollars(session.amount_total)
  const shippingFromStripe = centsToDollars(session.total_details?.amount_shipping)

  if (discount > 0) order.discount = discount
  if (session.metadata?.promotionCode) {
    order.discountCode = String(session.metadata.promotionCode).trim().toUpperCase()
  }

  // Prefer Stripe shipping amount when present (should match our fixed shipping option).
  if (shippingFromStripe > 0) {
    order.shipping = shippingFromStripe
  }

  // Keep our computed sales-tax line unless Stripe reports tax separately.
  const stripeTax = centsToDollars(session.total_details?.amount_tax)
  if (stripeTax > 0) {
    order.tax = stripeTax
  }

  if (amountPaid > 0) {
    order.amountPaid = amountPaid
    order.total = amountPaid
  } else {
    // Fallback math if amount_total missing
    order.total = Math.max(
      0,
      Number(order.subtotal || 0) - Number(order.discount || 0) + Number(order.shipping || 0) + Number(order.tax || 0)
    )
    order.amountPaid = order.isPaid ? order.total : 0
  }

  if (session.payment_intent) {
    const pi =
      typeof session.payment_intent === 'string'
        ? null
        : session.payment_intent
    if (pi) {
      order.stripePaymentIntentId = pi.id || order.stripePaymentIntentId
      order.paymentDetails = extractPaymentDetails(pi)
      order.paymentMethod = 'card'
    } else if (typeof session.payment_intent === 'string') {
      order.stripePaymentIntentId = session.payment_intent
    }
  }

  return order
}

function formatPaymentMethodLabel(order) {
  const details = order?.paymentDetails || {}
  const brand = String(details.brand || '').trim()
  const last4 = String(details.last4 || '').trim()
  const wallet = String(details.wallet || '').trim()

  if (brand && last4) {
    const brandLabel = brand.charAt(0).toUpperCase() + brand.slice(1)
    const walletLabel = wallet ? ` (${wallet.replace(/_/g, ' ')})` : ''
    return `${brandLabel} •••• ${last4}${walletLabel}`
  }

  if (order?.paymentMethod === 'card' || order?.paymentMethod === 'stripe') {
    return 'Card (Stripe)'
  }

  return order?.paymentMethod || 'Card'
}

module.exports = {
  reconcileOrderFromStripeSession,
  formatPaymentMethodLabel,
  extractPaymentDetails,
  centsToDollars,
}
