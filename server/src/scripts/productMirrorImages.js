/**
 * Mirror external product image URLs to local /media/products/{slug}/ paths.
 *
 *   npm run product:mirror-images -- --dry-run --limit 5
 *   npm run product:mirror-images -- --all
 */
require('dotenv').config()
const connectDB = require('../config/db')
const Product = require('../models/Product')
const {
  mirrorProductsBatch,
  mirrorAllProducts,
} = require('../services/productImageEnrichmentService')
const { getMediaRoot, getSiteOrigin } = require('../utils/productMediaPaths')

function parseArgs(argv) {
  const args = {
    limit: Number(process.env.PRODUCT_IMAGE_BATCH_LIMIT || 25),
    skip: 0,
    dryRun: false,
    all: false,
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
    } else if (arg === '--all') {
      args.all = true
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
  const withExternal = await Product.countDocuments({
    isPublished: true,
    'images.url': /^https?:\/\//,
  })

  console.log('--- Catalog image stats ---')
  console.log(`Published products: ${total}`)
  console.log(`With local /media/ paths: ${withLocal}`)
  console.log(`With external http(s) URLs: ${withExternal}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await connectDB()

  console.log(`Media root: ${getMediaRoot()}`)
  console.log(`Site origin: ${getSiteOrigin()}`)
  console.log(`Images stored as: /media/products/{slug}/...`)

  await printStats()

  if (args.all) {
    console.log(`\nMirroring ALL published products with external images (batch ${args.limit})...\n`)
    const result = await mirrorAllProducts(args)
    console.log('\n--- Finished ---')
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`\nBatch: limit=${args.limit} skip=${args.skip} dryRun=${args.dryRun}\n`)
    const result = await mirrorProductsBatch(args)
    console.log(JSON.stringify(result, null, 2))
  }

  await printStats()
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
