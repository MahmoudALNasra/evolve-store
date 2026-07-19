/**
 * CLI: delete unpublished products, then push published catalog to Products sheet.
 *
 *   cd server
 *   node src/scripts/purgeUnpublishedAndSyncSheet.js --dry-run
 *   node src/scripts/purgeUnpublishedAndSyncSheet.js
 */
require('dotenv').config()
const connectDB = require('../config/db')
const { runOpsJob } = require('../services/adminOpsService')

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  await connectDB()
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE DELETE + SHEET PUSH ===')

  const outcome = await runOpsJob('purge-unpublished-and-sync', { dryRun })
  console.log(JSON.stringify(outcome, null, 2))

  if (!outcome.ok) process.exit(1)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
