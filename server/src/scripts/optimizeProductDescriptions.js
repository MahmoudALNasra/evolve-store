require('dotenv').config()
const connectDB = require('../config/db')
const { optimizeAllProducts } = require('../services/productDescriptionOptimizationService')

function parseArgs(argv) {
  const args = { limit: 50, skip: 0, dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--limit' && argv[i + 1]) { args.limit = Number(argv[i + 1]); i += 1 }
    else if (argv[i] === '--skip' && argv[i + 1]) { args.skip = Number(argv[i + 1]); i += 1 }
    else if (argv[i] === '--dry-run') args.dryRun = true
  }
  return args
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required')
    process.exit(1)
  }
  if (!process.env.SERPER_API_KEY) {
    console.error('SERPER_API_KEY is required')
    process.exit(1)
  }

  await connectDB()
  const args = parseArgs(process.argv.slice(2))
  console.log(`Optimizing product descriptions: limit=${args.limit} skip=${args.skip} dryRun=${args.dryRun}`)
  const result = await optimizeAllProducts(args)
  console.log(JSON.stringify({ scanned: result.scanned, reportPath: result.reportPath }, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
