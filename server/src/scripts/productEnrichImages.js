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
    includeUnpublished: false,
    publishedOnly: false,
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
    } else if (arg === '--include-unpublished') {
      args.includeUnpublished = true
    } else if (arg === '--published-only') {
      args.publishedOnly = true
    }
  }

  if (args.underMin || args.noImages) {
    if (!args.publishedOnly) args.includeUnpublished = true
  }

  return args
}

async function printStats(includeUnpublished = false) {
  const publishedFilter = { isPublished: true }
  const allFilter = includeUnpublished ? {} : publishedFilter

  const totalPublished = await Product.countDocuments(publishedFilter)
  const totalAll = includeUnpublished
    ? await Product.countDocuments({})
    : totalPublished
  const unpublished = includeUnpublished ? totalAll - totalPublished : 0

  const withMinPublished = await Product.countDocuments({
    ...publishedFilter,
    $expr: { $gte: [{ $size: '$images' }, MIN_IMAGES] },
  })
  const withMinAll = await Product.countDocuments({
    ...allFilter,
    $expr: { $gte: [{ $size: '$images' }, MIN_IMAGES] },
  })
  const noImagesAll = await Product.countDocuments({
    ...allFilter,
    $or: [{ images: { $size: 0 } }, { images: { $exists: false } }],
  })
  const underMinAll = await Product.countDocuments({
    ...allFilter,
    $expr: { $lt: [{ $size: { $ifNull: ['$images', []] } }, MIN_IMAGES] },
  })

  console.log('--- Catalog stats ---')
  console.log(`Min images required: ${MIN_IMAGES}`)
  console.log(`Published products: ${totalPublished}`)
  if (includeUnpublished) {
    console.log(`Unpublished products: ${unpublished}`)
    console.log(`Total catalog: ${totalAll}`)
  }
  console.log(`With ${MIN_IMAGES}+ images (published): ${withMinPublished} / ${totalPublished}`)
  if (includeUnpublished) {
    console.log(`With ${MIN_IMAGES}+ images (all): ${withMinAll} / ${totalAll}`)
  }
  console.log(`No images${includeUnpublished ? ' (all)' : ''}: ${noImagesAll}`)
  console.log(`Under ${MIN_IMAGES} images${includeUnpublished ? ' (all)' : ''}: ${underMinAll}`)
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

  await printStats(args.includeUnpublished)

  if (args.underMin || args.noImages) {
    const scope = args.includeUnpublished ? 'all products (published + unpublished)' : 'published products only'
    const mode = args.noImages ? 'no images' : `under ${MIN_IMAGES} images`
    console.log(`\nEnriching ${scope} with ${mode} (batch ${args.limit})...\n`)
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

  await printStats(args.includeUnpublished)
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
