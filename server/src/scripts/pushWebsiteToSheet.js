require('dotenv').config()
const connectDB = require('../config/db')
const { syncWebsiteToMasterSheet } = require('../services/websiteToMasterSheetSyncService')

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    all: argv.includes('--all'),
  }
}

async function main() {
  await connectDB()
  const args = parseArgs(process.argv.slice(2))
  console.log('Pushing website products → master Products tab...')
  const result = await syncWebsiteToMasterSheet({
    dryRun: args.dryRun,
    onlyPublished: !args.all,
  })
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
