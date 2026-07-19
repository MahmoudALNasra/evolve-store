/**
 * Remove duplicate catalog products that share the same barcode.
 * Keeps the best listing (real name, images, description) and deletes the rest.
 *
 *   npm run product:dedupe-barcodes
 *   npm run product:dedupe-barcodes -- --dry-run
 */
require('dotenv').config()
const connectDB = require('../config/db')
const Product = require('../models/Product')
const InventorySyncProduct = require('../models/InventorySyncProduct')
const { productQualityScore, cleanId } = require('../utils/productMatch')
const { isValidSheetProductName } = require('../utils/inventoryProductIdentity')

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') }
}

async function dedupeBarcodeGroups(dryRun) {
  const products = await Product.find({ barcode: { $nin: ['', null] } }).lean()
  const groups = new Map()

  for (const product of products) {
    const barcode = cleanId(product.barcode)
    if (!groups.has(barcode)) groups.set(barcode, [])
    groups.get(barcode).push(product)
  }

  const report = { duplicateGroups: 0, removed: 0, unpublishedBadNames: 0, kept: 0 }

  for (const [barcode, group] of groups) {
    if (group.length <= 1) {
      const only = group[0]
      if (!isValidSheetProductName(only.name, barcode) && only.isPublished) {
        report.unpublishedBadNames += 1
        if (!dryRun) {
          await Product.updateOne({ _id: only._id }, { $set: { isPublished: false } })
        }
      }
      continue
    }

    report.duplicateGroups += 1
    const syncLinks = await InventorySyncProduct.find({
      barcode,
      websiteProduct: { $in: group.map((p) => p._id) },
    }).lean()
    const syncedIds = new Set(
      syncLinks.filter((s) => s.syncStatus === 'synced').map((s) => String(s.websiteProduct))
    )

    const ranked = group
      .map((product) => {
        let score = productQualityScore(product)
        if (syncedIds.has(String(product._id))) score += 500
        return { product, score }
      })
      .sort((a, b) => b.score - a.score)

    const keeper = ranked[0].product
    report.kept += 1

    for (let i = 1; i < ranked.length; i += 1) {
      const duplicate = ranked[i].product
      report.removed += 1

      if (dryRun) {
        console.log(`[dry-run] remove duplicate ${duplicate._id} (${duplicate.name}) keep ${keeper._id} (${keeper.name}) barcode=${barcode}`)
        continue
      }

      await Product.deleteOne({ _id: duplicate._id })
      await InventorySyncProduct.deleteMany({ websiteProduct: duplicate._id })
      console.log(`Removed duplicate barcode ${barcode}: "${duplicate.name}" → kept "${keeper.name}"`)
    }

    if (!dryRun && keeper.stock <= 0 && ranked.some((r) => r.product.stock > 0)) {
      const maxStock = Math.max(...ranked.map((r) => Number(r.product.stock) || 0))
      await Product.updateOne({ _id: keeper._id }, { $set: { stock: maxStock } })
    }
  }

  return report
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await connectDB()
  const report = await dedupeBarcodeGroups(args.dryRun)
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
