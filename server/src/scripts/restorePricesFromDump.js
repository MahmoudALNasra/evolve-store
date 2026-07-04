require('dotenv').config()
const path = require('path')
const connectDB = require('../config/db')
const { findProductsBson, restoreProductsFromBson } = require('../utils/restorePricesFromBackup')

function parseArgs(argv) {
  const dumpIdx = argv.indexOf('--dump')
  return {
    dumpPath: dumpIdx >= 0 ? path.resolve(argv[dumpIdx + 1] || '') : '',
    dryRun: argv.includes('--dry-run'),
    pricesOnly: argv.includes('--prices-only'),
    noUnpublish: argv.includes('--keep-extras'),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.dumpPath) {
    console.error('Usage: npm run inventory:restore-products -- --dump /path/to/mongodump [--dry-run] [--prices-only]')
    process.exit(1)
  }

  const bsonPath = findProductsBson(args.dumpPath)
  console.log(`Loading backup from ${bsonPath}`)
  console.log(`Mode: ${args.pricesOnly ? 'prices only' : 'full product restore'}`)

  await connectDB()
  const result = await restoreProductsFromBson(bsonPath, {
    dryRun: args.dryRun,
    mode: args.pricesOnly ? 'prices' : 'full',
    insertMissing: true,
    unpublishExtras: !args.noUnpublish,
  })

  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
