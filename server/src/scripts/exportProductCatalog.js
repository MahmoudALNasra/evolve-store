/**
 * Export full product catalog to JSON (backup before any sync).
 *
 *   npm run inventory:export-catalog
 *   npm run inventory:export-catalog -- --out /root/mongo-backups/catalog-$(date +%F).json
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const connectDB = require('../config/db')
const Product = require('../models/Product')

function parseArgs(argv) {
  const outIdx = argv.indexOf('--out')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return {
    outPath: outIdx >= 0
      ? path.resolve(argv[outIdx + 1])
      : path.join(__dirname, '../../data/product-catalog-backup.json'),
    stamp,
  }
}

async function main() {
  const { outPath } = parseArgs(process.argv.slice(2))
  await connectDB()

  const products = await Product.find({}).sort({ name: 1 }).lean()

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify({
    exportedAt: new Date().toISOString(),
    count: products.length,
    products,
  }, null, 2))

  console.log(`Exported ${products.length} full products → ${outPath}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
