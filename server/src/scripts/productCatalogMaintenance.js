/**
 * Catalog maintenance: image audit, unpublish empty-image products, AI content enrichment.
 *
 *   npm run product:catalog-maintenance -- --audit-images
 *   npm run product:catalog-maintenance -- --enrich-content --limit 100
 *   npm run product:catalog-maintenance -- --all
 */
require('dotenv').config()
const connectDB = require('../config/db')
const {
  auditAllProductImages,
  enrichAllProductContent,
} = require('../services/productCatalogMaintenanceService')

function parseArgs(argv) {
  const args = {
    auditImages: false,
    enrichContent: false,
    all: false,
    dryRun: false,
    limit: 0,
    enrichLimit: 50,
  }

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--audit-images') args.auditImages = true
    else if (argv[i] === '--enrich-content') args.enrichContent = true
    else if (argv[i] === '--all') args.all = true
    else if (argv[i] === '--dry-run') args.dryRun = true
    else if (argv[i] === '--limit' && argv[i + 1]) { args.limit = Number(argv[i + 1]); i += 1 }
    else if (argv[i] === '--enrich-limit' && argv[i + 1]) { args.enrichLimit = Number(argv[i + 1]); i += 1 }
  }

  if (args.all) {
    args.auditImages = true
    args.enrichContent = true
  }

  return args
}

async function main() {
  if (!process.env.OPENAI_API_KEY && parseArgs(process.argv.slice(2)).enrichContent) {
    console.error('OPENAI_API_KEY is required for --enrich-content')
    process.exit(1)
  }

  await connectDB()
  const args = parseArgs(process.argv.slice(2))

  if (!args.auditImages && !args.enrichContent) {
    console.error('Usage: --audit-images | --enrich-content | --all [--dry-run] [--limit N]')
    process.exit(1)
  }

  const report = {}

  if (args.auditImages) {
    console.log('Auditing product images...')
    report.images = await auditAllProductImages({ limit: args.limit, dryRun: args.dryRun })
  }

  if (args.enrichContent) {
    console.log('Enriching product descriptions and tabs...')
    report.content = await enrichAllProductContent({
      limit: args.enrichLimit,
      onlyMissing: true,
      dryRun: args.dryRun,
    })
  }

  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
