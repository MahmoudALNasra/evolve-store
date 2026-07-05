require('dotenv').config()
const connectDB = require('../config/db')
const {
  optimizeAllProducts,
  auditDescriptionQuality,
} = require('../services/productDescriptionOptimizationService')
const { MIN_WORDS } = require('../utils/productDescriptionQuality')

function parseArgs(argv) {
  const args = { limit: 50, skip: 0, dryRun: false, onlyMissing: false, needsWork: false, all: false, auditOnly: false }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--limit' && argv[i + 1]) { args.limit = Number(argv[i + 1]); i += 1 }
    else if (argv[i] === '--skip' && argv[i + 1]) { args.skip = Number(argv[i + 1]); i += 1 }
    else if (argv[i] === '--dry-run') args.dryRun = true
    else if (argv[i] === '--only-missing') args.onlyMissing = true
    else if (argv[i] === '--needs-work') args.needsWork = true
    else if (argv[i] === '--all') args.all = true
    else if (argv[i] === '--audit') args.auditOnly = true
  }
  return args
}

async function main() {
  await connectDB()
  const args = parseArgs(process.argv.slice(2))

  const before = await auditDescriptionQuality()
  console.log('--- Description quality (before) ---')
  console.log(JSON.stringify(before, null, 2))

  if (args.auditOnly) {
    process.exit(0)
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required')
    process.exit(1)
  }
  if (!process.env.SERPER_API_KEY) {
    console.error('SERPER_API_KEY is required')
    process.exit(1)
  }

  const mode = args.needsWork ? 'needs-work' : args.onlyMissing ? 'only-missing' : 'all-published'
  console.log(`\nOptimizing descriptions (${mode}): limit=${args.limit} skip=${args.skip} dryRun=${args.dryRun} all=${args.all}`)
  console.log(`Thin = under ${MIN_WORDS} words or missing SEO meta/FAQs\n`)

  const result = await optimizeAllProducts({
    limit: args.limit,
    skip: args.skip,
    dryRun: args.dryRun,
    onlyMissing: args.onlyMissing,
    onlyNeedsWork: args.needsWork,
    all: args.all,
  })

  const after = await auditDescriptionQuality()
  console.log('\n--- Finished ---')
  console.log(JSON.stringify({ ...result, after }, null, 2))
  process.exit(result.errors > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
