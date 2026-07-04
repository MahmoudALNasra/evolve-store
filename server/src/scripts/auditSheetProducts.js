/**
 * Compare website products against master Google Sheet Products tab.
 *
 *   npm run inventory:audit-sheet
 *   npm run inventory:audit-sheet -- --limit 20
 */
require('dotenv').config()
const connectDB = require('../config/db')
const Product = require('../models/Product')
const InventorySyncProduct = require('../models/InventorySyncProduct')
const { fetchMasterInventoryRows } = require('../services/googleSheetsInventoryService')
const { mapSheetRowToWebsiteProduct } = require('../utils/inventoryMapper')
const { isValidSheetProductName } = require('../utils/inventoryProductIdentity')
const { cleanId } = require('../utils/productMatch')

function parseArgs(argv) {
  const limitIdx = argv.indexOf('--limit')
  return {
    limit: limitIdx >= 0 ? Number(argv[limitIdx + 1]) || 0 : 0,
  }
}

function money(n) {
  return Number(Number(n || 0).toFixed(2))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  await connectDB()

  const { rows } = await fetchMasterInventoryRows()
  const sheetByBarcode = new Map()

  for (const row of rows) {
    const barcode = cleanId(row.sourceRow.Barcode)
    if (!barcode) continue
    const payload = mapSheetRowToWebsiteProduct(row.sourceRow)
    if (!isValidSheetProductName(payload.name, barcode)) continue
    sheetByBarcode.set(barcode, { rowNumber: row.rowNumber, payload, sourceRow: row.sourceRow })
  }

  const products = await Product.find({ barcode: { $nin: ['', null] } }).lean()
  const report = {
    sheetRows: sheetByBarcode.size,
    websiteWithBarcode: products.length,
    notInSheet: [],
    priceMismatch: [],
    nameMismatch: [],
    duplicateBarcodes: [],
    noSyncRecord: [],
    badSheetNameOnSite: [],
  }

  const byBarcode = new Map()
  for (const product of products) {
    const barcode = cleanId(product.barcode)
    if (!byBarcode.has(barcode)) byBarcode.set(barcode, [])
    byBarcode.get(barcode).push(product)
  }

  for (const [barcode, group] of byBarcode) {
    if (group.length > 1) {
      report.duplicateBarcodes.push({
        barcode,
        count: group.length,
        names: group.map((p) => p.name),
      })
    }
  }

  for (const product of products) {
    const barcode = cleanId(product.barcode)
    const sheet = sheetByBarcode.get(barcode)

    if (!sheet) {
      if (product.isPublished) {
        report.notInSheet.push({ barcode, name: product.name, price: product.price })
      }
      continue
    }

    const sync = await InventorySyncProduct.findOne({ barcode, websiteProduct: product._id }).lean()
    if (!sync) report.noSyncRecord.push({ barcode, name: product.name })

    if (!isValidSheetProductName(product.name, barcode)) {
      report.badSheetNameOnSite.push({
        barcode,
        siteName: product.name,
        sheetName: sheet.payload.name,
      })
    }

    if (money(product.price) !== money(sheet.payload.price)) {
      report.priceMismatch.push({
        barcode,
        name: product.name,
        sitePrice: product.price,
        sheetPrice: sheet.payload.price,
      })
    }

    if (cleanId(product.name).toLowerCase() !== cleanId(sheet.payload.name).toLowerCase()) {
      report.nameMismatch.push({
        barcode,
        siteName: product.name,
        sheetName: sheet.payload.name,
      })
    }
  }

  const trim = (list) => (args.limit > 0 ? list.slice(0, args.limit) : list)

  console.log(JSON.stringify({
    summary: {
      sheetRows: report.sheetRows,
      websiteWithBarcode: report.websiteWithBarcode,
      notInSheet: report.notInSheet.length,
      priceMismatch: report.priceMismatch.length,
      nameMismatch: report.nameMismatch.length,
      duplicateBarcodes: report.duplicateBarcodes.length,
      noSyncRecord: report.noSyncRecord.length,
      badSheetNameOnSite: report.badSheetNameOnSite.length,
    },
    notInSheet: trim(report.notInSheet),
    priceMismatch: trim(report.priceMismatch),
    nameMismatch: trim(report.nameMismatch),
    duplicateBarcodes: trim(report.duplicateBarcodes),
    badSheetNameOnSite: trim(report.badSheetNameOnSite),
  }, null, 2))

  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
