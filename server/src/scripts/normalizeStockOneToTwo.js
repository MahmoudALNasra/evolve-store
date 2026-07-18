require('dotenv').config()
const connectDB = require('../config/db')
const { normalizeStockOneToTwo } = require('../services/stockNormalizationService')

async function main() {
  await connectDB()
  const dryRun = process.argv.includes('--dry-run')
  const result = await normalizeStockOneToTwo({ dryRun })
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
