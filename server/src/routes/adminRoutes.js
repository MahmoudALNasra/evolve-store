const express = require('express')
const Order = require('../models/Order')
const Product = require('../models/Product')
const User = require('../models/User')
const { protect, admin } = require('../middleware/auth')

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

module.exports = router
