const express = require('express')
const BlogArticle = require('../models/BlogArticle')
const { slugifyCategory } = require('../utils/blogSeo')

const router = express.Router()

function publicArticleQuery(extra = {}) {
  return { status: 'published', ...extra }
}

function formatPublicArticle(article) {
  const doc = article.toObject ? article.toObject() : article
  return {
    _id: doc._id,
    title: doc.title,
    slug: doc.slug,
    content: doc.content,
    meta_description: doc.meta_description,
    key_takeaways: doc.key_takeaways,
    category: doc.category,
    source_name: doc.source_name,
    source_url: doc.source_url,
    image_url: doc.image_url,
    share_id: doc.share_id,
    status: doc.status,
    published_at: doc.published_at,
    product: doc.product,
    topic: doc.topic,
    article_type: doc.article_type,
    seo_keywords: doc.seo_keywords,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

// GET /api/blog — published list
router.get('/', async (req, res) => {
  const { category, search, productId, page = 1, limit = 12, sort = '-published_at' } = req.query
  const filter = publicArticleQuery()

  if (category) filter.category = slugifyCategory(category)
  if (productId) filter.product = productId
  if (search && String(search).trim().length >= 2) {
    filter.$text = { $search: String(search).trim() }
  }

  const skip = (Number(page) - 1) * Number(limit)
  const [articles, total, categories] = await Promise.all([
    BlogArticle.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .populate('product', 'name slug category images price'),
    BlogArticle.countDocuments(filter),
    BlogArticle.distinct('category', publicArticleQuery()),
  ])

  res.json({
    articles: articles.map(formatPublicArticle),
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)) || 1,
    categories,
  })
})

// GET /api/blog/categories — published category counts
router.get('/categories', async (req, res) => {
  const rows = await BlogArticle.aggregate([
    { $match: publicArticleQuery() },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ])

  res.json(
    rows.map((row) => ({
      category: row._id,
      count: row.count,
    }))
  )
})

// GET /api/blog/product/:productId — related published articles
router.get('/product/:productId', async (req, res) => {
  const articles = await BlogArticle.find(
    publicArticleQuery({ product: req.params.productId })
  )
    .sort('-published_at')
    .populate('product', 'name slug category images price')

  res.json({ articles: articles.map(formatPublicArticle) })
})

// GET /api/blog/:category/:slug — single published article
router.get('/:category/:slug', async (req, res) => {
  const category = slugifyCategory(req.params.category)
  const article = await BlogArticle.findOne(
    publicArticleQuery({ category, slug: req.params.slug })
  ).populate('product', 'name slug category description images price tags')

  if (!article) {
    return res.status(404).json({ message: 'Article not found' })
  }

  res.json(formatPublicArticle(article))
})

module.exports = router
