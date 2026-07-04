/**
 * Full reconcile: restore from master sheet, dedupe barcodes, unpublish orphans.
 *
 *   npm run inventory:reconcile-from-sheet
 *   npm run inventory:reconcile-from-sheet -- --dry-run
 */
require('dotenv').config()

process.env.INVENTORY_SYNC_SHEET1_LINKS = 'false'
delete process.env.INVENTORY_SYNC_PRESERVE_WEBSITE_PRICE

const connectDB = require('../config/db')
const Product = require('../models/Product')
const InventorySyncProduct = require('../models/InventorySyncProduct')
const { syncInventoryFromSheet } = require('../services/inventorySyncService')
const { fetchMasterInventoryRows } = require('../services/googleSheetsInventoryService')
const { mapSheetRowToWebsiteProduct, websitePayloadToProductDocument } = require('../utils/inventoryMapper')
const { isValidSheetProductName, dedupeSheetEntries } = require('../utils/inventoryProductIdentity')
const { findExistingProduct, productQualityScore, cleanId } = require('../utils/productMatch')
const { generateUniqueSlug } = require('../utils/productSlug')

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') }
}

async function dedupeBarcodeGroups(dryRun) {
  const products = await Product.find({ barcode: { $nin: ['', null] } }).lean()
  const groups = new Map()
  let removed = 0

  for (const product of products) {
    const barcode = cleanId(product.barcode)
    if (!groups.has(barcode)) groups.set(barcode, [])
    groups.get(barcode).push(product)
  }

  for (const [barcode, group] of groups) {
    if (group.length <= 1) continue

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

    for (let i = 1; i < ranked.length; i += 1) {
      const duplicate = ranked[i].product
      removed += 1
      if (dryRun) {
        console.log(`[dry-run] remove duplicate ${duplicate.name} (barcode ${barcode})`)
        continue
      }
      await Product.deleteOne({ _id: duplicate._id })
      await InventorySyncProduct.deleteMany({ websiteProduct: duplicate._id })
    }
  }

  return removed
}

async function unpublishOrphans(validBarcodes, dryRun) {
  const products = await Product.find({ isPublished: true }).select('name barcode sku')
  let count = 0

  for (const product of products) {
    const barcode = cleanId(product.barcode)
    if (barcode && validBarcodes.has(barcode)) continue

    count += 1
    if (dryRun) {
      console.log(`[dry-run] unpublish orphan: ${product.name} (${barcode || product.sku || 'no barcode'})`)
      continue
    }
    await Product.updateOne({ _id: product._id }, { $set: { isPublished: false } })
  }

  return count
}

async function forceAlignFromSheet(dryRun) {
  const { rows } = await fetchMasterInventoryRows()
  const entries = []

  for (const row of rows) {
    const payload = mapSheetRowToWebsiteProduct(row.sourceRow)
    if (!isValidSheetProductName(payload.name, payload.barcode)) continue
    if (!payload.barcode && !payload.sku) continue
    entries.push({ row, websitePayload: payload })
  }

  const deduped = dedupeSheetEntries(entries)
  let realigned = 0

  for (const { websitePayload } of deduped) {
    const existing = await findExistingProduct(websitePayload)
    if (!existing) continue

    const doc = websitePayloadToProductDocument(websitePayload)
    delete doc.imageUrls

    const needsUpdate =
      cleanId(existing.name) !== cleanId(doc.name) ||
      Number(existing.price) !== Number(doc.price) ||
      Number(existing.stock) !== Number(doc.stock) ||
      cleanId(existing.description) !== cleanId(doc.description)

    if (!needsUpdate) continue
    realigned += 1

    if (dryRun) {
      console.log(`[dry-run] realign ${websitePayload.barcode}: "${existing.name}" → "${doc.name}" $${existing.price}→$${doc.price}`)
      continue
    }

    Object.assign(existing, doc)
    if (!existing.slug) {
      existing.slug = await generateUniqueSlug(Product, doc.name, { excludeId: existing._id })
    }
    await existing.save()
  }

  return realigned
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2))
  await connectDB()

  console.log(dryRun ? 'Reconcile (dry-run)...' : 'Reconcile from master Products tab...')

  let restore = null
  if (!dryRun) {
    restore = await syncInventoryFromSheet({ force: true, fromMaster: true })
    console.log('Restore:', JSON.stringify(restore))
  }

  const { rows } = await fetchMasterInventoryRows()
  const sheetBarcodes = new Set()

  for (const row of rows) {
    const payload = mapSheetRowToWebsiteProduct(row.sourceRow)
    const barcode = cleanId(payload.barcode)
    if (!barcode || !isValidSheetProductName(payload.name, barcode)) continue
    sheetBarcodes.add(barcode)
  }

  const removed = await dedupeBarcodeGroups(dryRun)
  const orphans = await unpublishOrphans(sheetBarcodes, dryRun)
  const realigned = await forceAlignFromSheet(dryRun)

  const summary = {
    dryRun,
    restore,
    duplicatesRemoved: removed,
    orphansUnpublished: orphans,
    productsRealigned: realigned,
    sheetBarcodeCount: sheetBarcodes.size,
  }

  console.log(JSON.stringify(summary, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
