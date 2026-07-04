/**
 * Export current website product prices to JSON (backup before any sheet sync).
 *
 *   npm run inventory:export-prices
 *   npm run inventory:export-prices -- --out data/product-prices-backup.json
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const connectDB = require('../config/db')
const Product = require('../models/Product')

function parseArgs(argv) {
  const outIdx = argv.indexOf('--out')
  return {
    outPath: outIdx >= 0
      ? path.resolve(argv[outIdx + 1])
      : path.join(__dirname, '../../data/product-prices-backup.json'),
  }
}

async function main() {
  const { outPath } = parseArgs(process.argv.slice(2))
  await connectDB()

  const products = await Product.find({})
    .select('barcode sku name price comparePrice stock isPublished updatedAt')
    .sort({ name: 1 })
    .lean()

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify({
    exportedAt: new Date().toISOString(),
    count: products.length,
    products,
  }, null, 2))

  console.log(`Exported ${products.length} products → ${outPath}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
