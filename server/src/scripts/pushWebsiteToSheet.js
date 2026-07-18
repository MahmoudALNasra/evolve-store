require('dotenv').config()
const connectDB = require('../config/db')
const {
  syncWebsiteToMasterSheet,
  replaceWebsiteCatalogOnMasterSheet,
} = require('../services/websiteToMasterSheetSyncService')

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    all: argv.includes('--all'),
    fullReplace: argv.includes('--full-replace'),
  }
}

async function main() {
  await connectDB()
  const args = parseArgs(process.argv.slice(2))

  if (args.fullReplace) {
    console.log('Full replace: website products → master Products tab (A:O)...')
    const result = await replaceWebsiteCatalogOnMasterSheet({
      dryRun: args.dryRun,
      includeUnpublished: args.all,
    })
    console.log(JSON.stringify(result, null, 2))
    if (!args.dryRun && result.verification && !result.verification.ok) {
      process.exit(1)
    }
    process.exit(0)
  }

  console.log('Pushing website products → master Products tab (matched rows only)...')
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
