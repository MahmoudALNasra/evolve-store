const express = require('express')
const Order = require('../models/Order')
const { syncInventoryFromSheet, applySaleItems } = require('../services/inventorySyncService')

const router = express.Router()

function requireInventorySecret(req, res, next) {
  const expected = process.env.INVENTORY_WEBHOOK_SECRET
  if (!expected) return next()

  const received =
    req.get('x-inventory-webhook-secret') ||
    req.get('x-webhook-secret') ||
    req.query.secret

  if (received !== expected) {
    return res.status(401).json({ message: 'Invalid inventory webhook secret' })
  }

  next()
}

function getOrderItems(body = {}) {
  if (Array.isArray(body.items)) return body.items
  if (Array.isArray(body.order?.items)) return body.order.items
  if (Array.isArray(body.line_items)) return body.line_items
  return []
}

// POST /api/inventory/sync
// Manual trigger or Vercel Cron target for Google Sheet -> MongoDB -> website -> Merchant Center.
router.post('/sync', requireInventorySecret, async (req, res) => {
  const result = await syncInventoryFromSheet()
  res.json(result)
})

// POST /api/inventory/push-order/:orderId
// Push a paid order's current website stock levels to the Google Sheet (manual recovery).
router.post('/push-order/:orderId', requireInventorySecret, async (req, res) => {
  const order = await Order.findById(req.params.orderId)
  if (!order) return res.status(404).json({ message: 'Order not found' })
  if (!order.isPaid) return res.status(400).json({ message: 'Order is not paid yet' })

  const items = await applySaleItems(
    order.items.map((item) => ({
      productId: item.product,
      quantity: item.quantity,
    })),
    { updateWebsiteStock: false }
  )

  order.inventorySynced = true
  await order.save()

  res.json({ orderId: order._id, items })
})

// POST /webhooks/orders
// Inbound sale event from the website or another order source.
router.post('/orders', requireInventorySecret, async (req, res) => {
  const items = getOrderItems(req.body)
  if (!items.length) {
    return res.status(400).json({ message: 'No order items found' })
  }

  const result = await applySaleItems(items, {
    updateWebsiteStock: req.body.websiteStockAlreadyReduced !== true,
  })
  res.json({ updated: result.length, items: result })
})

module.exports = router
