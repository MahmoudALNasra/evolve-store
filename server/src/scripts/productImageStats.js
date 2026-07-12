require('dotenv').config()
const connectDB = require('../config/db')
const Product = require('../models/Product')
const { MIN_IMAGES } = require('../services/productImageEnrichmentService')

async function countFor(filter) {
  const total = await Product.countDocuments(filter)
  const withMin = await Product.countDocuments({
    ...filter,
    $expr: { $gte: [{ $size: '$images' }, MIN_IMAGES] },
  })
  const withLocal = await Product.countDocuments({
    ...filter,
    'images.url': /^\/media\/products\//,
  })
  const noImages = await Product.countDocuments({
    ...filter,
    $or: [{ images: { $size: 0 } }, { images: { $exists: false } }],
  })
  const underMin = await Product.countDocuments({
    ...filter,
    $expr: { $lt: [{ $size: { $ifNull: ['$images', []] } }, MIN_IMAGES] },
  })

  return { total, withMin, withLocal, noImages, underMin }
}

async function main() {
  await connectDB()

  const published = await countFor({ isPublished: true })
  const unpublished = await countFor({ isPublished: false })
  const all = await countFor({})

  console.log(JSON.stringify({
    minImagesRequired: MIN_IMAGES,
    published,
    unpublished,
    all,
  }, null, 2))

  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
