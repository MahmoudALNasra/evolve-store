const express = require('express')
const Order = require('../models/Order')
const Product = require('../models/Product')
const User = require('../models/User')
const { protect, admin } = require('../middleware/auth')
const { enrichProductsBatch, enrichProductImages } = require('../services/productImageEnrichmentService')

const router = express.Router()

// GET /api/admin/stats  — dashboard summary
router.get('/stats', protect, admin, async (req, res) => {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalOrders,
    ordersToday,
    ordersThisMonth,
    totalRevenue,
    revenueToday,
    revenueThisMonth,
    totalProducts,
    lowStockProducts,
    totalUsers,
    newUsersToday,
    recentOrders,
    ordersByStatus,
  ] = await Promise.all([
    Order.countDocuments({ isPaid: true }),
    Order.countDocuments({ isPaid: true, createdAt: { $gte: startOfDay } }),
    Order.countDocuments({ isPaid: true, createdAt: { $gte: startOfMonth } }),
    Order.aggregate([{ $match: { isPaid: true } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.aggregate([{ $match: { isPaid: true, createdAt: { $gte: startOfDay } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.aggregate([{ $match: { isPaid: true, createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Product.countDocuments(),
    Product.find({ stock: { $lte: 5 } }).select('name stock sku').limit(10),
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: startOfDay } }),
    Order.find({ isPaid: true })
      .populate('user', 'name email')
      .sort('-createdAt')
      .limit(5),
    Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ])

  // Revenue per day for last 30 days
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
  const revenueChart = await Order.aggregate([
    { $match: { isPaid: true, createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])

  res.json({
    totalOrders,
    ordersToday,
    ordersThisMonth,
    totalRevenue: totalRevenue[0]?.total || 0,
    revenueToday: revenueToday[0]?.total || 0,
    revenueThisMonth: revenueThisMonth[0]?.total || 0,
    totalProducts,
    lowStockProducts,
    totalUsers,
    newUsersToday,
    recentOrders,
    ordersByStatus,
    revenueChart,
  })
})

// POST /api/admin/products/enrich-images — Serper + local /media product images
router.post('/products/enrich-images', protect, admin, async (req, res) => {
  const { limit = 10, skip = 0, dryRun = false, force = false, productId } = req.body || {}

  if (productId) {
    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: 'Product not found' })
    const result = await enrichProductImages(product, { dryRun: !!dryRun, force: !!force, save: !dryRun })
    return res.json(result)
  }

  const result = await enrichProductsBatch({
    limit: Number(limit) || 10,
    skip: Number(skip) || 0,
    dryRun: !!dryRun,
    force: !!force,
  })
  res.json(result)
})

module.exports = router
