require('dotenv').config()
const connectDB = require('../config/db')
const { optimizeAllProducts } = require('../services/productDescriptionOptimizationService')
const { shouldFixProductName } = require('../utils/productNameQuality')
const Product = require('../models/Product')

function parseArgs(argv) {
  const args = { limit: 50, dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--limit' && argv[i + 1]) { args.limit = Number(argv[i + 1]); i += 1 }
    else if (argv[i] === '--dry-run') args.dryRun = true
  }
  return args
}

async function main() {
  if (!process.env.OPENAI_API_KEY || !process.env.SERPER_API_KEY) {
    console.error('OPENAI_API_KEY and SERPER_API_KEY are required')
    process.exit(1)
  }

  await connectDB()
  const args = parseArgs(process.argv.slice(2))

  const published = await Product.find({ isPublished: true }).select('name').lean()
  const needsFix = published.filter((p) => shouldFixProductName(p.name))
  console.log(`Bad titles: ${needsFix.length} / ${published.length}`)

  if (needsFix.length === 0) {
    console.log('Nothing to do.')
    process.exit(0)
  }

  const result = await optimizeAllProducts({
    onlyBadTitles: true,
    all: true,
    limit: args.limit,
    dryRun: args.dryRun,
  })

  console.log(JSON.stringify(result, null, 2))
  process.exit(result.errors > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
