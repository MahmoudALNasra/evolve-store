const express = require('express')
const Product = require('../models/Product')
const Review = require('../models/Review')
const { syncProductRating } = require('../services/reviewService')
const { optionalAuth } = require('../middleware/auth')

const router = express.Router({ mergeParams: true })

async function findPublishedProduct(slug) {
  return Product.findOne({ slug, isPublished: true })
}

// GET /api/products/:slug/reviews
router.get('/', async (req, res) => {
  const product = await findPublishedProduct(req.params.slug)
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const reviews = await Review.find({ product: product._id })
    .sort({ createdAt: -1 })
    .select('-user')
    .lean()

  res.json({
    reviews,
    rating: product.rating,
    numReviews: product.numReviews,
  })
})

// POST /api/products/:slug/reviews
router.post('/', optionalAuth, async (req, res) => {
  const product = await findPublishedProduct(req.params.slug)
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const rating = Number(req.body?.rating)
  const body = String(req.body?.body || '').trim()
  const title = String(req.body?.title || '').trim().slice(0, 120)
  const authorName = String(req.body?.authorName || req.user?.name || '').trim().slice(0, 80)

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be 1–5' })
  }
  if (!body || body.length < 10) {
    return res.status(400).json({ message: 'Review must be at least 10 characters' })
  }
  if (!authorName) {
    return res.status(400).json({ message: 'Name is required' })
  }

  const review = await Review.create({
    product: product._id,
    user: req.user?._id || null,
    rating,
    title,
    body,
    authorName,
    isVerifiedPurchase: false,
  })

  const stats = await syncProductRating(product._id)

  res.status(201).json({
    review: {
      _id: review._id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      authorName: review.authorName,
      isVerifiedPurchase: review.isVerifiedPurchase,
      createdAt: review.createdAt,
    },
    rating: stats.rating,
    numReviews: stats.numReviews,
  })
})

module.exports = router
