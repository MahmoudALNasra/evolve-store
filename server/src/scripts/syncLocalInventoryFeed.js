/**
 * Build / refresh Google Merchant Center local inventory tab from master Products stock.
 *
 * Tab columns: id, store_code, availability, quantity, price, pickup_method, pickup_sla
 * - id must match Sheet1 product id
 * - store_code must match Google Business Profile store code (case-sensitive)
 *
 * Usage:
 *   DRY_RUN=1 npm run inventory:sync-local-feed
 *   npm run inventory:sync-local-feed
 *
 * Required env:
 *   GOOGLE_MERCHANT_STORE_CODE=your-gbp-store-code
 */
require('dotenv').config()
const { syncLocalInventoryFeed } = require('../services/localInventoryFeedService')

async function main() {
  const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')
  const result = await syncLocalInventoryFeed({ dryRun })
  console.log(JSON.stringify(result, null, 2))
  if (result.skipped) process.exitCode = 1
}

main().catch((err) => {
  console.error(err.stack || err.message || err)
  process.exit(1)
})
