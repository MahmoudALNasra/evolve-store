/**
 * Restore prices from a JSON file created by inventory:export-prices.
 *
 *   npm run inventory:restore-prices-json -- --file data/product-prices-backup.json
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const connectDB = require('../config/db')
const Product = require('../models/Product')

function parseArgs(argv) {
  const fileIdx = argv.indexOf('--file')
  return {
    filePath: fileIdx >= 0 ? path.resolve(argv[fileIdx + 1] || '') : '',
    dryRun: argv.includes('--dry-run'),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.filePath || !fs.existsSync(args.filePath)) {
    console.error('Usage: npm run inventory:restore-prices-json -- --file path/to/backup.json')
    process.exit(1)
  }

  await connectDB()
  const data = JSON.parse(fs.readFileSync(args.filePath, 'utf8'))
  const products = data.products || data
  const report = { matched: 0, updated: 0, missing: 0, total: products.length }

  for (const row of products) {
    const barcode = String(row.barcode || '').trim()
    let existing = barcode ? await Product.findOne({ barcode }) : null
    if (!existing && row.sku) existing = await Product.findOne({ sku: String(row.sku).trim() })

    if (!existing) {
      report.missing += 1
      continue
    }

    report.matched += 1
    if (args.dryRun) continue

    await Product.updateOne(
      { _id: existing._id },
      { $set: { price: row.price, comparePrice: row.comparePrice || 0 } }
    )
    report.updated += 1
  }

  console.log(JSON.stringify({ ...report, dryRun: args.dryRun, source: args.filePath }, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
