require('dotenv').config()
const path = require('path')
const connectDB = require('../config/db')
const { findProductsBson, restorePricesFromBson } = require('../utils/restorePricesFromBackup')

function parseArgs(argv) {
  const dumpIdx = argv.indexOf('--dump')
  return {
    dumpPath: dumpIdx >= 0 ? path.resolve(argv[dumpIdx + 1] || '') : '',
    dryRun: argv.includes('--dry-run'),
    full: argv.includes('--full'),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.dumpPath) {
    console.error('Usage: npm run inventory:restore-prices -- --dump /path/to/mongodump [--dry-run] [--full]')
    process.exit(1)
  }

  const bsonPath = findProductsBson(args.dumpPath)
  console.log(`Loading backup from ${bsonPath}`)

  await connectDB()
  const result = await restorePricesFromBson(bsonPath, {
    dryRun: args.dryRun,
    full: args.full,
  })

  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
