const express = require('express')
const Order = require('../models/Order')
const Product = require('../models/Product')
const { protect, admin } = require('../middleware/auth')

const router = express.Router()

// GET /api/orders/my  — current user's orders
router.get('/my', protect, async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate('items.product', 'name images')
    .sort('-createdAt')
  res.json(orders)
})

// GET /api/orders  — admin: all orders
router.get('/', protect, admin, async (req, res) => {
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

// GET /api/orders/:id
router.get('/:id', protect, async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email')
    .populate('items.product', 'name images price')
  if (!order) return res.status(404).json({ message: 'Order not found' })
  const isOwner = order.user._id.toString() === req.user._id.toString()
  if (!isOwner && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Access denied' })
  res.json(order)
})

// GET /api/orders/stats/counts  — admin: get status counts
router.get('/stats/counts', protect, admin, async (req, res) => {
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

// PUT /api/orders/:id/status  — admin: update status
router.put('/:id/status', protect, admin, async (req, res) => {
  const { status } = req.body
  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true })
  if (!order) return res.status(404).json({ message: 'Order not found' })
  res.json(order)
})

// PUT /api/orders/:id/tracking  — admin: update tracking number
router.put('/:id/tracking', protect, admin, async (req, res) => {
  const { trackingNumber } = req.body
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { trackingNumber },
    { new: true }
  )
  if (!order) return res.status(404).json({ message: 'Order not found' })
  res.json(order)
})

// DELETE /api/orders/:id  — admin only
router.delete('/:id', protect, admin, async (req, res) => {
  const order = await Order.findByIdAndDelete(req.params.id)
  if (!order) return res.status(404).json({ message: 'Order not found' })
  res.json({ message: 'Order deleted' })
})

module.exports = router
