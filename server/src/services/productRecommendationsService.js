const mongoose = require('mongoose')
const Product = require('../models/Product')

const SAMPLE_SIZE = 4

const CARD_PROJECTION = {
  _id: 1,
  slug: 1,
  name: 1,
  price: 1,
  comparePrice: 1,
  category: 1,
  rating: 1,
  numReviews: 1,
  stock: 1,
  isFeatured: 1,
  images: { $slice: ['$images', 1] },
}

async function resolveSourceProduct(slug) {
  let source = await Product.findOne({ slug, isPublished: true })
    .select('_id slug category tags')
    .lean()

  if (
    !source &&
    mongoose.Types.ObjectId.isValid(slug) &&
    String(new mongoose.Types.ObjectId(slug)) === slug
  ) {
    source = await Product.findOne({ _id: slug, isPublished: true })
      .select('_id slug category tags')
      .lean()
  }

  return source
}

function buildMatchStage(source, { requireTagOverlap = false } = {}) {
  const match = {
    isPublished: true,
    _id: { $ne: source._id },
    slug: { $exists: true, $nin: [null, ''] },
    category: source.category,
  }

  if (requireTagOverlap && source.tags?.length > 0) {
    match.tags = { $in: source.tags }
  }

  return match
}

async function sampleRecommendations(match, limit = SAMPLE_SIZE) {
  const count = await Product.countDocuments(match)
  if (count === 0) return []

  const size = Math.min(limit, count)
  return Product.aggregate([
    { $match: match },
    { $sample: { size } },
    { $project: CARD_PROJECTION },
  ])
}

/**
 * Up to 4 random published products in the same category (tag overlap preferred when possible).
 */
async function getProductRecommendations(slug) {
  const source = await resolveSourceProduct(slug)
  if (!source) return { notFound: true, products: [] }

  let products = []

  if (source.tags?.length > 0) {
    products = await sampleRecommendations(buildMatchStage(source, { requireTagOverlap: true }))
  }

  if (products.length < SAMPLE_SIZE) {
    const excludeIds = [source._id, ...products.map((p) => p._id)]
    const categoryMatch = {
      ...buildMatchStage(source),
      _id: { $nin: excludeIds },
    }
    const needed = SAMPLE_SIZE - products.length
    const more = await sampleRecommendations(categoryMatch, needed)
    products = [...products, ...more]
  }

  return { notFound: false, products }
}

module.exports = { getProductRecommendations, SAMPLE_SIZE }
