const express = require('express')
const Order = require('../models/Order')
const Product = require('../models/Product')
const User = require('../models/User')
const { protect, admin } = require('../middleware/auth')
const { enrichProductsBatch, enrichProductImages } = require('../services/productImageEnrichmentService')
const { suggestProductSeo } = require('../services/productDescriptionOptimizationService')
const {
  getAnalyticsOverview,
  getTopPages,
  getUserJourneys,
  getHeatmapData,
} = require('../services/adminAnalyticsService')
const { syncMasterSheetToProductsTab } = require('../services/masterSheetSyncService')
const { syncWebsiteToMasterSheet } = require('../services/websiteToMasterSheetSyncService')
const { runOpsJob, getOpsStatus } = require('../services/adminOpsService')
const StoreSettings = require('../models/StoreSettings')

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
    StoreSettings.get().then((settings) =>
      Product.find({ stock: { $lte: settings.lowStockThreshold } })
        .select('name stock sku')
        .limit(10)
    ),
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

// POST /api/admin/products/:id/suggest-seo — Serper + OpenAI SEO rewrite (draft only)
router.post('/products/:id/suggest-seo', protect, admin, async (req, res) => {
  const product = await Product.findById(req.params.id)
  if (!product) return res.status(404).json({ message: 'Product not found' })
  try {
    const suggestion = await suggestProductSeo(product)
    res.json(suggestion)
  } catch (err) {
    res.status(500).json({ message: err.message || 'SEO suggestion failed' })
  }
})

// POST /api/admin/products/:id/apply-seo — apply approved SEO fields to live product
router.post('/products/:id/apply-seo', protect, admin, async (req, res) => {
  const product = await Product.findById(req.params.id)
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const { description, seoTitle, seoMetaDescription, seoFaqs } = req.body || {}
  if (description) product.description = description
  if (seoTitle) product.seoTitle = seoTitle
  if (seoMetaDescription) product.seoMetaDescription = seoMetaDescription
  if (Array.isArray(seoFaqs)) product.seoFaqs = seoFaqs
  product.descriptionDraft = ''
  await product.save()
  res.json({ message: 'SEO fields applied', product })
})

router.get('/analytics/overview', protect, admin, async (req, res) => {
  try {
    res.json(await getAnalyticsOverview(req.query))
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ message: err.message })
  }
})

router.get('/analytics/pages', protect, admin, async (req, res) => {
  try {
    res.json(await getTopPages(req.query))
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ message: err.message })
  }
})

router.get('/analytics/journeys', protect, admin, async (req, res) => {
  try {
    res.json(await getUserJourneys(req.query))
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ message: err.message })
  }
})

router.get('/analytics/heatmap', protect, admin, async (req, res) => {
  try {
    res.json(await getHeatmapData(req.query))
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ message: err.message })
  }
})

router.post('/sheets/sync-master', protect, admin, async (req, res) => {
  try {
    const result = await syncMasterSheetToProductsTab()
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message || 'Master sheet sync failed' })
  }
})

router.post('/sheets/push-website', protect, admin, async (req, res) => {
  try {
    const result = await syncWebsiteToMasterSheet({
      dryRun: req.body?.dryRun === true,
      onlyPublished: req.body?.onlyPublished !== false,
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message || 'Website → master sheet push failed' })
  }
})

// GET /api/admin/ops — list jobs + running/last-run status + catalog counts
router.get('/ops', protect, admin, async (req, res) => {
  try {
    res.json(await getOpsStatus())
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load ops status' })
  }
})

// POST /api/admin/ops/:job — run a job (awaits short jobs; long jobs return 202)
router.post('/ops/:job', protect, admin, async (req, res) => {
  try {
    const outcome = await runOpsJob(req.params.job, req.body || {})
    if (!outcome.ok) {
      return res.status(outcome.status || 400).json({ message: outcome.message, ...outcome })
    }
    res.status(outcome.waited ? 200 : 202).json(outcome)
  } catch (err) {
    res.status(500).json({ message: err.message || 'Ops job failed' })
  }
})

// GET /api/admin/settings — persisted store settings
router.get('/settings', protect, admin, async (req, res) => {
  const settings = await StoreSettings.get()
  res.json(settings)
})

// PUT /api/admin/settings — update store settings
router.put('/settings', protect, admin, async (req, res) => {
  const settings = await StoreSettings.update(req.body || {})
  res.json(settings)
})

module.exports = router
