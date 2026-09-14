const express = require('express')
const crypto = require('crypto')
const Order = require('../models/Order')
const Product = require('../models/Product')
const { protect, admin } = require('../middleware/auth')
const { sendOrderShipped } = require('../services/emailService')
const { auditWriteLogger } = require('../middleware/auditWriteLogger')
const { logAuditFromReq } = require('../services/auditLogService')
const { restoreStockForCancelledOrRefundedOrder } = require('../services/inventoryService')

const router = express.Router()
router.use(auditWriteLogger())

function getAdminOrdersPassword() {
  return process.env.ADMIN_ORDERS_PASSWORD || 'change-this-orders-password'
}

function passwordsMatch(received, expected) {
  const a = Buffer.from(String(received || ''))
  const b = Buffer.from(String(expected || ''))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function requireOrdersPassword(req, res, next) {
  const password = req.get('x-admin-orders-password')
  if (passwordsMatch(password, getAdminOrdersPassword())) return next()
  return res.status(403).json({ message: 'Orders password required' })
}

async function sendShippedEmailIfReady(order, previous = {}) {
  if (!order?.user || (order.fulfillmentMethod === 'shipping' && !order.trackingNumber)) return false

  const trackingWasAdded = order.trackingNumber && !previous.trackingNumber
  if (order.shippedEmailSent && !trackingWasAdded) return false

  const sent = await sendOrderShipped(order, order.user)
  if (sent) {
    order.shippedEmailSent = true
    await order.save()
  }
  return sent
}

// GET /api/orders/my  — current user's orders
router.get('/my', protect, async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate('items.product', 'name images')
    .sort('-createdAt')
  res.json(orders)
})

// GET /api/orders  — admin: all orders
router.get('/', protect, admin, requireOrdersPassword, async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query
  const filter = {}
  if (status) filter.status = status
  if (search && search.trim()) {
    // Match against the hex string of _id so the short 8-char order codes work
    const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$expr = {
      $regexMatch: { input: { $toString: '$_id' }, regex: safe, options: 'i' },
    }
  }
  const skip = (Number(page) - 1) * Number(limit)
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email')
      .populate('items.product', 'name images')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit)),
    Order.countDocuments(filter),
  ])
  res.json({ orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
})

// GET /api/orders/stats/counts  — admin: get status counts (must be before /:id)
router.get('/stats/counts', protect, admin, requireOrdersPassword, async (req, res) => {
  const counts = await Order.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ])
  const result = { all: 0 }
  counts.forEach(({ _id, count }) => {
    result[_id] = count
    result.all += count
  })
  res.json(result)
})

// GET /api/orders/:id
router.get('/:id', protect, async (req, res) => {
  const { getAddressEditState } = require('../utils/addressEditWindow')
  const { formatPaymentMethodLabel } = require('../services/stripeOrderReconcile')
  const { SALES_TAX_RATE } = require('../utils/salesTax')

  const order = await Order.findById(req.params.id)
    .populate('user', 'name email')
    .populate('items.product', 'name images price')
  if (!order) return res.status(404).json({ message: 'Order not found' })
  const isOwner = order.user._id.toString() === req.user._id.toString()
  if (!isOwner && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Access denied' })
  if (!isOwner && req.user.role === 'admin' && !passwordsMatch(req.get('x-admin-orders-password'), getAdminOrdersPassword())) {
    return res.status(403).json({ message: 'Orders password required' })
  }

  const plain = order.toObject()
  plain.addressEdit = getAddressEditState(order)
  plain.paymentMethodLabel = formatPaymentMethodLabel(order)
  plain.salesTaxRate = SALES_TAX_RATE
  res.json(plain)
})

// PUT /api/orders/:id/shipping-address — customer self-service within edit window
router.put('/:id/shipping-address', protect, async (req, res) => {
  const { getAddressEditState } = require('../utils/addressEditWindow')

  const order = await Order.findById(req.params.id)
  if (!order) return res.status(404).json({ message: 'Order not found' })

  const isOwner = order.user.toString() === req.user._id.toString()
  if (!isOwner) return res.status(403).json({ message: 'Access denied' })

  const editState = getAddressEditState(order)
  if (!editState.canEdit) {
    return res.status(403).json({
      message: editState.message,
      addressEdit: editState,
    })
  }

  const a = req.body?.shippingAddress || req.body || {}
  const next = {
    line1: String(a.line1 || '').trim(),
    line2: String(a.line2 || '').trim(),
    city: String(a.city || '').trim(),
    state: String(a.state || '').trim().toUpperCase(),
    zip: String(a.zip || '').trim(),
    country: String(a.country || 'United States').trim() || 'United States',
  }

  if (!next.line1 || !/\d/.test(next.line1)) {
    return res.status(400).json({ message: 'Enter a street address with a house/building number' })
  }
  if (!next.city) return res.status(400).json({ message: 'City is required' })
  if (!/^[A-Z]{2}$/.test(next.state)) return res.status(400).json({ message: 'Valid US state is required' })
  if (!/^\d{5}(-\d{4})?$/.test(next.zip)) return res.status(400).json({ message: 'Valid US ZIP is required' })

  order.shippingAddress = next
  order.addressLastEditedAt = new Date()
  await order.save()

  void logAuditFromReq(req, {
    action: 'order.customer_address_update',
    entityType: 'order',
    entityId: order._id,
    summary: `Customer updated shipping address for order #${String(order._id).slice(-8).toUpperCase()}`,
    after: { shippingAddress: next },
  })
  res.locals.auditLogged = true

  const plain = order.toObject()
  plain.addressEdit = getAddressEditState(order)
  res.json(plain)
})

// PUT /api/orders/:id  — admin: edit order fields (address, notes, shipping, status, paid, tracking)
router.put('/:id', protect, admin, requireOrdersPassword, async (req, res) => {
  const previous = await Order.findById(req.params.id)
  if (!previous) return res.status(404).json({ message: 'Order not found' })

  const body = req.body || {}
  const update = {}

  if (body.shippingAddress && typeof body.shippingAddress === 'object') {
    const a = body.shippingAddress
    update.shippingAddress = {
      line1: String(a.line1 ?? previous.shippingAddress?.line1 ?? '').trim(),
      line2: String(a.line2 ?? previous.shippingAddress?.line2 ?? '').trim(),
      city: String(a.city ?? previous.shippingAddress?.city ?? '').trim(),
      state: String(a.state ?? previous.shippingAddress?.state ?? '').trim().toUpperCase(),
      zip: String(a.zip ?? previous.shippingAddress?.zip ?? '').trim(),
      country: String(a.country ?? previous.shippingAddress?.country ?? 'United States').trim(),
    }
  }

  if (typeof body.notes === 'string') {
    update.notes = body.notes.trim().slice(0, 2000)
  }

  if (typeof body.trackingNumber === 'string') {
    update.trackingNumber = body.trackingNumber.trim()
  }

  if (body.status) {
    const allowed = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
    if (!allowed.includes(body.status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }
    update.status = body.status
  }

  if (body.fulfillmentMethod === 'shipping' || body.fulfillmentMethod === 'pickup') {
    update.fulfillmentMethod = body.fulfillmentMethod
  }

  if (body.isPaid === true || body.isPaid === false) {
    update.isPaid = body.isPaid
    if (body.isPaid && !previous.paidAt) update.paidAt = new Date()
    if (!body.isPaid) update.paidAt = null
  }

  if (body.shipping != null && body.shipping !== '') {
    const shipping = Number(body.shipping)
    if (!Number.isFinite(shipping) || shipping < 0) {
      return res.status(400).json({ message: 'Invalid shipping amount' })
    }
    update.shipping = shipping
    const subtotal = Number(previous.subtotal) || 0
    const tax = Number(previous.tax) || 0
    update.total = Number((subtotal + tax + shipping).toFixed(2))
  }

  if (body.pickup && typeof body.pickup === 'object') {
    update.pickup = {
      ...(previous.pickup?.toObject?.() || previous.pickup || {}),
      display: String(body.pickup.display ?? previous.pickup?.display ?? '').trim(),
    }
  }

  if (!Object.keys(update).length) {
    return res.status(400).json({ message: 'No editable fields provided' })
  }

  const order = await Order.findByIdAndUpdate(req.params.id, { $set: update }, { returnDocument: 'after' })
    .populate('user', 'name email')
  if (!order) return res.status(404).json({ message: 'Order not found' })

  const becameCancelled = update.status === 'cancelled' && previous.status !== 'cancelled'
  const becameUnpaid = update.isPaid === false && previous.isPaid === true
  if (becameCancelled || becameUnpaid) {
    // Reload mutable doc so stockReduced flag can be cleared idempotently
    const live = await Order.findById(req.params.id)
    if (live) {
      await restoreStockForCancelledOrRefundedOrder(
        live,
        becameCancelled ? 'admin_cancel' : 'admin_refund_unpaid'
      )
    }
  }

  if (
    update.status === 'shipped' &&
    previous.status !== 'shipped' &&
    !order.shippedEmailSent
  ) {
    await sendShippedEmailIfReady(order, previous)
  } else if (
    typeof update.trackingNumber === 'string' &&
    update.trackingNumber &&
    update.trackingNumber !== previous.trackingNumber
  ) {
    await sendShippedEmailIfReady(order, previous)
  }

  void logAuditFromReq(req, {
    action: 'order.update',
    entityType: 'order',
    entityId: order._id,
    summary: `Edited order #${String(order._id).slice(-8).toUpperCase()}`,
    before: {
      status: previous.status,
      trackingNumber: previous.trackingNumber,
      isPaid: previous.isPaid,
      shipping: previous.shipping,
      total: previous.total,
    },
    after: {
      status: order.status,
      trackingNumber: order.trackingNumber,
      isPaid: order.isPaid,
      shipping: order.shipping,
      total: order.total,
      fields: Object.keys(update),
    },
  })
  res.locals.auditLogged = true
  res.json(order)
})

// POST /api/orders/:id/shipping-label — admin: purchase UPS/Shippo label PDF
router.post('/:id/shipping-label', protect, admin, requireOrdersPassword, async (req, res) => {
  const shippo = require('../services/shipping/shippoProvider')

  if (!shippo.isConfigured()) {
    return res.status(503).json({ message: 'Shippo is not configured (SHIPPO_API_KEY missing)' })
  }

  const order = await Order.findById(req.params.id).populate('user', 'name email')
  if (!order) return res.status(404).json({ message: 'Order not found' })
  if (order.fulfillmentMethod === 'pickup') {
    return res.status(400).json({ message: 'Pickup orders do not need a shipping label' })
  }

  // Reuse existing purchased label
  if (order.shippingMethod?.labelUrl && order.trackingNumber) {
    return res.json({
      ok: true,
      reused: true,
      labelUrl: order.shippingMethod.labelUrl,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.shippingMethod.trackingUrlProvider || '',
    })
  }

  let rateObjectId = order.shippingMethod?.rateObjectId
  const carrierHint = [
    order.shippingMethod?.carrier,
    order.shippingMethod?.provider,
    order.shippingMethod?.label,
    order.shippingMethod?.service,
  ].map((v) => String(v || '').toLowerCase()).join(' ')
  const isUpsRate = carrierHint.includes('ups')
  const needsUpsRate = !rateObjectId
    || order.shippingMethod?.provider === 'estimate'
    || !isUpsRate

  if (needsUpsRate) {
    // Create a fresh UPS shipment/rate for label purchase (prefer configured UPS carrier account)
    try {
      const { rates, messages } = await shippo.createShipmentWithRates({
        toAddress: order.shippingAddress,
        user: order.user,
      })
      const upsGround = rates.find((r) =>
        String(r.provider || '').toLowerCase().includes('ups')
        && String(r.service || '').toLowerCase().includes('ground')
      )
      const upsAny = rates.find((r) => String(r.provider || '').toLowerCase().includes('ups'))
      const pick = upsGround || upsAny
      if (!pick) {
        const hint = (messages || []).map((m) => m.text).filter(Boolean).slice(0, 2).join(' ')
        return res.status(502).json({
          message: hint
            || 'No UPS rates available. Connect a US UPS carrier account in Shippo and set SHIPPO_UPS_CARRIER_ACCOUNT_ID.',
        })
      }
      rateObjectId = pick.objectId
      order.shippingMethod = {
        ...(order.shippingMethod?.toObject?.() || order.shippingMethod || {}),
        provider: 'shippo',
        rateObjectId: pick.objectId,
        carrier: pick.provider,
        service: pick.service,
        label: pick.label,
        amount: pick.amount,
      }
    } catch (err) {
      console.error('Shippo rate refresh for label failed:', err.response?.data || err.message)
      return res.status(502).json({
        message: err.message || 'Could not get UPS rates for label purchase. Check Shippo UPS account / rate limits.',
      })
    }
  }

  try {
    const label = await shippo.purchaseLabel({ rateObjectId, labelFileType: 'PDF_4x6' })
    if (!label.labelUrl) {
      return res.status(502).json({ message: 'Shippo returned no label PDF URL' })
    }
    order.trackingNumber = label.trackingNumber || order.trackingNumber
    order.shippingMethod = {
      ...(order.shippingMethod?.toObject?.() || order.shippingMethod || {}),
      labelUrl: label.labelUrl,
      labelTransactionId: label.transactionId,
      trackingUrlProvider: label.trackingUrl || '',
      carrier: label.carrier || order.shippingMethod?.carrier || 'UPS',
    }
    if (order.status === 'processing' || order.status === 'pending') {
      order.status = 'shipped'
    }
    await order.save()

    if (!order.shippedEmailSent && order.trackingNumber) {
      await sendShippedEmailIfReady(order, {})
    }

    void logAuditFromReq(req, {
      action: 'order.shipping_label',
      entityType: 'order',
      entityId: order._id,
      summary: `Purchased shipping label for order #${String(order._id).slice(-8).toUpperCase()}`,
      after: { trackingNumber: order.trackingNumber, labelUrl: label.labelUrl },
    })
    res.locals.auditLogged = true

    res.json({
      ok: true,
      reused: false,
      labelUrl: label.labelUrl,
      trackingNumber: order.trackingNumber,
      trackingUrl: label.trackingUrl,
      order,
    })
  } catch (err) {
    console.error('Shippo label purchase failed:', err.shippo || err.message)
    res.status(502).json({
      message: err.message || 'Could not purchase UPS/Shippo shipping label',
    })
  }
})

// PUT /api/orders/:id/status  — admin: update status
router.put('/:id/status', protect, admin, requireOrdersPassword, async (req, res) => {
  const { status } = req.body
  const previous = await Order.findById(req.params.id)
  if (!previous) return res.status(404).json({ message: 'Order not found' })

  if (status === 'cancelled' && previous.status !== 'cancelled') {
    await restoreStockForCancelledOrRefundedOrder(previous, 'admin_status_cancel')
  }

  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' }).populate(
    'user',
    'name email'
  )
  if (!order) return res.status(404).json({ message: 'Order not found' })

  if (
    status === 'shipped' &&
    previous.status !== 'shipped' &&
    !order.shippedEmailSent
  ) {
    await sendShippedEmailIfReady(order, previous)
  }

  void logAuditFromReq(req, {
    action: 'order.status',
    entityType: 'order',
    entityId: order._id,
    summary: `Order #${String(order._id).slice(-8).toUpperCase()} status ${previous.status} → ${status}`,
    before: { status: previous.status, stockReduced: previous.stockReduced },
    after: { status, stockReduced: order.stockReduced },
  })
  res.locals.auditLogged = true
  res.json(order)
})

// PUT /api/orders/:id/tracking  — admin: update tracking number
router.put('/:id/tracking', protect, admin, requireOrdersPassword, async (req, res) => {
  const trackingNumber = String(req.body?.trackingNumber || '').trim()
  const previous = await Order.findById(req.params.id)
  if (!previous) return res.status(404).json({ message: 'Order not found' })

  const update = { trackingNumber }
  if (trackingNumber) update.status = 'shipped'

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    update,
    { returnDocument: 'after' }
  ).populate('user', 'name email')
  if (!order) return res.status(404).json({ message: 'Order not found' })

  if (trackingNumber) {
    await sendShippedEmailIfReady(order, previous)
  }

  void logAuditFromReq(req, {
    action: 'order.tracking',
    entityType: 'order',
    entityId: order._id,
    summary: `Order #${String(order._id).slice(-8).toUpperCase()} tracking updated`,
    before: { trackingNumber: previous.trackingNumber, status: previous.status },
    after: { trackingNumber, status: order.status },
  })
  res.locals.auditLogged = true
  res.json(order)
})

// POST /api/orders/:id/resend-confirmation  — admin: resend customer confirmation email
router.post('/:id/resend-confirmation', protect, admin, requireOrdersPassword, async (req, res) => {
  const { isEmailConfigured, sendOrderConfirmation } = require('../services/emailService')
  const { resolveRecipient } = require('../services/orderFulfillmentService')

  if (!isEmailConfigured()) {
    return res.status(503).json({
      message: 'Email provider is not configured. Set RESEND_API_KEY and EMAIL_FROM on the server.',
    })
  }

  const order = await Order.findById(req.params.id).populate('user', 'name email')
  if (!order) return res.status(404).json({ message: 'Order not found' })
  if (!order.isPaid) {
    return res.status(400).json({ message: 'Order is not paid yet — confirmation emails send after payment' })
  }

  const recipient = await resolveRecipient(order, null)
  if (!recipient?.email) {
    return res.status(400).json({ message: 'No customer email on this order' })
  }

  const sent = await sendOrderConfirmation(order, recipient)
  if (!sent) {
    return res.status(502).json({ message: 'Email provider rejected the send — check server logs / Resend domain' })
  }

  order.confirmationEmailSent = true
  await order.save()

  void logAuditFromReq(req, {
    action: 'order.resend_confirmation',
    entityType: 'order',
    entityId: order._id,
    summary: `Resent confirmation for order #${String(order._id).slice(-8).toUpperCase()} to ${recipient.email}`,
    after: { email: recipient.email, confirmationEmailSent: true },
  })
  res.locals.auditLogged = true
  res.json({ ok: true, email: recipient.email, confirmationEmailSent: true })
})

// DELETE /api/orders/:id  — admin only (restores reserved stock first)
router.delete('/:id', protect, admin, requireOrdersPassword, async (req, res) => {
  const order = await Order.findById(req.params.id)
  if (!order) return res.status(404).json({ message: 'Order not found' })

  const stockRestored = await restoreStockForCancelledOrRefundedOrder(order, 'admin_delete')
  await Order.findByIdAndDelete(req.params.id)

  void logAuditFromReq(req, {
    action: 'order.delete',
    entityType: 'order',
    entityId: order._id,
    summary: `Deleted order #${String(order._id).slice(-8).toUpperCase()}${stockRestored ? ' (stock restored)' : ''}`,
    before: {
      status: order.status,
      total: order.total,
      isPaid: order.isPaid,
      stockReduced: order.stockReduced,
      stockRestored,
    },
  })
  res.locals.auditLogged = true
  res.json({ message: 'Order deleted', stockRestored })
})

module.exports = router
