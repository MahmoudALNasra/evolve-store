require('dotenv').config()
const connectDB = require('../config/db')
const Product = require('../models/Product')
const {
  enrichProductsBatch,
  enrichAllProducts,
  enrichAllProductsUnderMin,
  MIN_IMAGES,
  MAX_IMAGES,
} = require('../services/productImageEnrichmentService')
const { getMediaRoot, getSiteOrigin } = require('../utils/productMediaPaths')

function parseArgs(argv) {
  const args = {
    limit: Number(process.env.PRODUCT_IMAGE_BATCH_LIMIT || 25),
    skip: 0,
    dryRun: false,
    force: false,
    onlyNeedsWork: true,
    all: false,
    underMin: false,
    noImages: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--limit' && argv[i + 1]) {
      args.limit = Number(argv[i + 1])
      i += 1
    } else if (arg === '--skip' && argv[i + 1]) {
      args.skip = Number(argv[i + 1])
      i += 1
    } else if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--force') {
      args.force = true
    } else if (arg === '--all') {
      args.all = true
    } else if (arg === '--under-min') {
      args.underMin = true
    } else if (arg === '--no-images') {
      args.noImages = true
    }
  }

  return args
}

async function printStats() {
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
  const underMin = await Product.countDocuments({
    isPublished: true,
    $expr: { $lt: [{ $size: { $ifNull: ['$images', []] } }, MIN_IMAGES] },
  })

  console.log('--- Catalog stats ---')
  console.log(`Min images required: ${MIN_IMAGES}`)
  console.log(`Published products: ${total}`)
  console.log(`With ${MIN_IMAGES}+ images: ${withMin} / ${total}`)
  console.log(`With local /media/ paths: ${withLocal}`)
  console.log(`No images: ${noImages}`)
  console.log(`Under ${MIN_IMAGES} images: ${underMin}`)
}

async function main() {
  if (!process.env.SERPER_API_KEY) {
    console.error('SERPER_API_KEY is required in server/.env')
    process.exit(1)
  }

  const args = parseArgs(process.argv.slice(2))
  await connectDB()

  console.log(`Media root: ${getMediaRoot()}`)
  console.log(`Stored as relative paths like: /media/products/{slug}/...`)
  console.log(`Absolute URLs for feeds use SITE_URL: ${getSiteOrigin()}`)
  console.log(`Target: ${MIN_IMAGES}-${MAX_IMAGES} images per product`)

  await printStats()

  if (args.underMin || args.noImages) {
    const mode = args.noImages ? 'no images' : `under ${MIN_IMAGES} images`
    console.log(`\nEnriching published products with ${mode} (batch ${args.limit})...\n`)
    const result = await enrichAllProductsUnderMin({
      ...args,
      onlyNoImages: args.noImages,
    })
    console.log('\n--- Finished ---')
    console.log(JSON.stringify(result, null, 2))
  } else if (args.all) {
    console.log(`\nProcessing ALL published products (batch size ${args.limit})...\n`)
    const result = await enrichAllProducts(args)
    console.log('\n--- Finished ---')
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(
      `\nBatch: limit=${args.limit} skip=${args.skip} dryRun=${args.dryRun} force=${args.force}\n`
    )
    const result = await enrichProductsBatch(args)
    console.log(JSON.stringify(result, null, 2))
  }

  await printStats()
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
