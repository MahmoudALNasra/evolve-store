/**
 * Remove products created from broken TSV rows (non-numeric barcodes)
 * and unpublish anything not in golden-product-sheet.tsv
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const connectDB = require('../config/db')
const Product = require('../models/Product')
const { parseGoldenSheetTsv } = require('../utils/parseGoldenSheetTsv')
const { isValidBarcode, cleanText } = require('../utils/inventoryProductIdentity')
const { normalizeBarcode } = require('../services/barcodeProductLookupService')

const DEFAULT_FILE = path.join(__dirname, '../../data/golden-product-sheet.tsv')

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  await connectDB()

  const rows = parseGoldenSheetTsv(fs.readFileSync(DEFAULT_FILE, 'utf8'))
  const validBarcodes = new Set()
  for (const row of rows) {
    const bc = normalizeBarcode(row.Barcode)
    if (bc && isValidBarcode(bc)) validBarcodes.add(bc)
  }

  const all = await Product.find({}).select('_id barcode isPublished')
  let deleted = 0
  let orphansUnpublished = 0

  for (const product of all) {
    const bc = cleanText(product.barcode)
    if (bc && !isValidBarcode(bc)) {
      deleted += 1
      if (!dryRun) await Product.deleteOne({ _id: product._id })
      continue
    }

    if (product.isPublished && (!bc || !validBarcodes.has(bc))) {
      orphansUnpublished += 1
      if (!dryRun) {
        await Product.updateOne({ _id: product._id }, { $set: { isPublished: false } })
      }
    }
  }

  console.log(JSON.stringify({ dryRun, validBarcodes: validBarcodes.size, deleted, orphansUnpublished }, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
