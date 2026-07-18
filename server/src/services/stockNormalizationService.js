const fs = require('fs')
const path = require('path')
const Product = require('../models/Product')

/**
 * Raise every product with stock === 1 to stock = 2 (website DB).
 */
async function normalizeStockOneToTwo(options = {}) {
  const dryRun = options.dryRun === true
  const filter = { stock: 1 }

  const products = await Product.find(filter)
    .select('_id name barcode slug stock isPublished')
    .sort({ name: 1 })
    .lean()

  const affected = products.map((p) => ({
    productId: p._id,
    barcode: p.barcode || '',
    slug: p.slug || '',
    name: p.name,
    isPublished: p.isPublished,
    stockBefore: 1,
    stockAfter: 2,
  }))

  if (!dryRun && affected.length > 0) {
    await Product.updateMany(filter, { $set: { stock: 2 } })
  }

  const outDir = path.join(__dirname, '../../reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const reportPath = path.join(outDir, `stock-normalize-1-to-2-${Date.now()}.json`)
  fs.writeFileSync(reportPath, JSON.stringify({ dryRun, count: affected.length, affected }, null, 2))

  return {
    dryRun,
    matched: affected.length,
    updated: dryRun ? 0 : affected.length,
    reportPath,
    samples: affected.slice(0, 10),
  }
}

module.exports = {
  normalizeStockOneToTwo,
}
