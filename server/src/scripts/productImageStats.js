require('dotenv').config()
const connectDB = require('../config/db')
const Product = require('../models/Product')
const { MIN_IMAGES } = require('../services/productImageEnrichmentService')

async function main() {
  await connectDB()

  const total = await Product.countDocuments({ isPublished: true })
  const withLocal = await Product.countDocuments({
    isPublished: true,
    'images.url': /^\/media\/products\//,
  })
  const withMin = await Product.countDocuments({
    isPublished: true,
    $expr: { $gte: [{ $size: '$images' }, MIN_IMAGES] },
  })
  const noImages = await Product.countDocuments({
    isPublished: true,
    $or: [{ images: { $size: 0 } }, { images: { $exists: false } }],
  })

  console.log(JSON.stringify({
    minImagesRequired: MIN_IMAGES,
    publishedProducts: total,
    withMinImages: withMin,
    withLocalMedia: withLocal,
    noImages,
    stillNeedWork: total - withMin,
    percentComplete: total ? Math.round((withMin / total) * 100) : 0,
  }, null, 2))

  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
