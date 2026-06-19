require('dotenv').config()
const connectDB = require('../config/db')
const { enrichProductsBatch } = require('../services/productImageEnrichmentService')
const { getMediaRoot, getSiteOrigin } = require('../utils/productMediaPaths')

function parseArgs(argv) {
  const args = {
    limit: Number(process.env.PRODUCT_IMAGE_BATCH_LIMIT || 25),
    skip: 0,
    dryRun: false,
    force: false,
    onlyNeedsWork: true,
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
      args.onlyNeedsWork = false
    }
  }

  return args
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
  console.log(`Batch: limit=${args.limit} skip=${args.skip} dryRun=${args.dryRun} force=${args.force}`)

  const result = await enrichProductsBatch(args)
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
