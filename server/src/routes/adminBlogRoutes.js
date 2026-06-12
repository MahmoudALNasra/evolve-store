const express = require('express')
const BlogArticle = require('../models/BlogArticle')
const Product = require('../models/Product')
const { protect, admin } = require('../middleware/auth')
const { slugifyCategory } = require('../utils/blogSeo')
const { generateUniqueBlogSlug } = require('../models/BlogArticle')
const {
  generateProductArticleDraft,
  generateTopicArticleDraft,
  regenerateArticleDraft,
} = require('../services/blogGenerationService')
const { auditProductImages, auditProductsBatch } = require('../services/productImageAuditService')

const router = express.Router()

router.use(protect, admin)

function isBlogGenerationEnabled() {
  return process.env.BLOG_GENERATION_ENABLED === 'true'
}

function formatAdminArticle(article) {
  const doc = article.toObject ? article.toObject() : article
  return doc
}

// GET /api/admin/blog — list all articles
router.get('/', async (req, res) => {
  const { status, category, productId, search, page = 1, limit = 20 } = req.query
  const filter = {}

  if (status) filter.status = status
  if (category) filter.category = slugifyCategory(category)
  if (productId) filter.product = productId
  if (search && String(search).trim().length >= 2) {
    filter.$text = { $search: String(search).trim() }
  }

  const skip = (Number(page) - 1) * Number(limit)
  const [articles, total] = await Promise.all([
    BlogArticle.find(filter)
      .sort('-updatedAt')
      .skip(skip)
      .limit(Number(limit))
      .populate('product', 'name slug category images')
      .populate('regeneration_of', 'title slug share_id'),
    BlogArticle.countDocuments(filter),
  ])

  res.json({
    articles: articles.map(formatAdminArticle),
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)) || 1,
  })
})

// GET /api/admin/blog/product-status — article counts per product
router.get('/product-status', async (req, res) => {
  const rows = await BlogArticle.aggregate([
    { $match: { product: { $ne: null } } },
    {
      $group: {
        _id: '$product',
        draftCount: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        publishedCount: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
        totalCount: { $sum: 1 },
      },
    },
  ])

  const map = {}
  for (const row of rows) {
    map[String(row._id)] = {
      draftCount: row.draftCount,
      publishedCount: row.publishedCount,
      totalCount: row.totalCount,
      hasArticle: row.totalCount > 0,
      hasPublished: row.publishedCount > 0,
    }
  }

  res.json({ statusByProduct: map })
})

// GET /api/admin/blog/preview/:category/:slug — admin draft preview
router.get('/preview/:category/:slug', async (req, res) => {
  const category = slugifyCategory(req.params.category)
  const article = await BlogArticle.findOne({ category, slug: req.params.slug })
    .populate('product', 'name slug category description images price tags')

  if (!article) return res.status(404).json({ message: 'Article not found' })
  res.json(formatAdminArticle(article))
})

// GET /api/admin/blog/:id
router.get('/:id', async (req, res) => {
  const article = await BlogArticle.findById(req.params.id)
    .populate('product', 'name slug category description images price tags')
    .populate('regeneration_of', 'title slug share_id status')

  if (!article) return res.status(404).json({ message: 'Article not found' })
  res.json(formatAdminArticle(article))
})

// PUT /api/admin/blog/:id — edit draft fields
router.put('/:id', async (req, res) => {
  const article = await BlogArticle.findById(req.params.id)
  if (!article) return res.status(404).json({ message: 'Article not found' })

  const allowed = [
    'title',
    'content',
    'meta_description',
    'key_takeaways',
    'category',
    'source_name',
    'source_url',
    'image_url',
    'seo_keywords',
    'topic',
  ]

  for (const key of allowed) {
    if (key in req.body) article[key] = req.body[key]
  }

  if (req.body.title && req.body.title !== article.title) {
    article.slug = await generateUniqueBlogSlug(
      BlogArticle,
      req.body.title,
      article.category,
      article._id
    )
  }

  if (req.body.category) {
    article.category = slugifyCategory(req.body.category)
  }

  await article.save()
  res.json(formatAdminArticle(article))
})

// POST /api/admin/blog/generate/product/:productId
router.post('/generate/product/:productId', async (req, res) => {
  if (!isBlogGenerationEnabled()) {
    return res.status(403).json({
      message: 'Blog generation is disabled. Set BLOG_GENERATION_ENABLED=true in server/.env',
    })
  }

  const product = await Product.findById(req.params.productId)
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const article = await generateProductArticleDraft(product, {
    regenerationOf: req.body.regenerationOf || null,
  })

  res.status(201).json(formatAdminArticle(article))
})

// POST /api/admin/blog/generate/topic
router.post('/generate/topic', async (req, res) => {
  if (!isBlogGenerationEnabled()) {
    return res.status(403).json({
      message: 'Blog generation is disabled. Set BLOG_GENERATION_ENABLED=true in server/.env',
    })
  }

  const { topic, category, sourceUrl, sourceName, articleType } = req.body
  if (!topic || !String(topic).trim()) {
    return res.status(400).json({ message: 'Topic is required' })
  }

  const article = await generateTopicArticleDraft({
    topic: String(topic).trim(),
    category: category || 'wellness',
    sourceUrl: sourceUrl || '',
    sourceName: sourceName || 'Evolve Specialty Pharmacy & Wellness',
    articleType: articleType || 'topic',
  })

  res.status(201).json(formatAdminArticle(article))
})

// POST /api/admin/blog/:id/regenerate — new draft version
router.post('/:id/regenerate', async (req, res) => {
  if (!isBlogGenerationEnabled()) {
    return res.status(403).json({
      message: 'Blog generation is disabled. Set BLOG_GENERATION_ENABLED=true in server/.env',
    })
  }

  const existing = await BlogArticle.findById(req.params.id).populate('product')
  if (!existing) return res.status(404).json({ message: 'Article not found' })

  const article = await regenerateArticleDraft(existing)
  res.status(201).json(formatAdminArticle(article))
})

// POST /api/admin/blog/:id/publish
router.post('/:id/publish', async (req, res) => {
  const article = await BlogArticle.findById(req.params.id)
  if (!article) return res.status(404).json({ message: 'Article not found' })

  article.status = 'published'
  article.published_at = new Date()
  await article.save()

  res.json(formatAdminArticle(article))
})

// POST /api/admin/blog/:id/unpublish
router.post('/:id/unpublish', async (req, res) => {
  const article = await BlogArticle.findById(req.params.id)
  if (!article) return res.status(404).json({ message: 'Article not found' })

  article.status = 'draft'
  article.published_at = null
  await article.save()

  res.json(formatAdminArticle(article))
})

// DELETE /api/admin/blog/:id
router.delete('/:id', async (req, res) => {
  const article = await BlogArticle.findByIdAndDelete(req.params.id)
  if (!article) return res.status(404).json({ message: 'Article not found' })
  res.json({ message: 'Article deleted' })
})

// POST /api/admin/blog/audit-images — batch image cleanup
router.post('/audit-images', async (req, res) => {
  const limit = Number(req.body.limit || process.env.BLOG_BATCH_LIMIT || 10)
  const result = await auditProductsBatch({ limit })
  res.json(result)
})

// POST /api/admin/blog/audit-images/:productId
router.post('/audit-images/:productId', async (req, res) => {
  const product = await Product.findById(req.params.productId)
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const result = await auditProductImages(product, {
    replacementUrls: req.body.replacementUrls || [],
  })
  res.json(result)
})

module.exports = router
