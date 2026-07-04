const Product = require('../models/Product')
const InventorySyncProduct = require('../models/InventorySyncProduct')
const {
  fetchMasterProductRows,
  pushWebsiteProductToMasterRow,
} = require('./googleSheetsInventoryService')

function cleanId(value) {
  return String(value || '').trim()
}

async function syncWebsiteToMasterSheet(options = {}) {
  const dryRun = options.dryRun === true
  const onlyPublished = options.onlyPublished !== false

  const { sheetId, sheetName, barcodeIndex, mpnIndex } = await fetchMasterProductRows()

  const filter = onlyPublished ? { isPublished: true } : {}
  const products = await Product.find(filter).sort({ name: 1 })

  const results = {
    scanned: products.length,
    matched: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    dryRun,
    masterSheetId: sheetId,
    masterTab: sheetName,
  }

  for (const product of products) {
    const barcode = cleanId(product.barcode)
    const sku = cleanId(product.sku)
    let rowNumber = barcode ? barcodeIndex.get(barcode) : null

    if (!rowNumber && sku) {
      rowNumber = mpnIndex.get(sku) || barcodeIndex.get(sku)
    }

    if (!rowNumber) {
      const syncRecord = await InventorySyncProduct.findOne({
        $or: [
          barcode ? { barcode } : null,
          sku ? { sku } : null,
        ].filter(Boolean),
      }).sort({ updatedAt: -1 })

      if (syncRecord?.sourceRow?.Barcode) {
        rowNumber = barcodeIndex.get(cleanId(syncRecord.sourceRow.Barcode))
      }
    }

    if (!rowNumber) {
      results.skipped += 1
      continue
    }

    results.matched += 1

    try {
      if (!dryRun) {
        await pushWebsiteProductToMasterRow(rowNumber, product)
      }
      results.updated += 1
      if (results.updated % 25 === 0) {
        const verb = dryRun ? 'Would push' : 'Pushed'
        console.log(`${verb} ${results.updated} products to master sheet...`)
      }
    } catch (err) {
      results.failed += 1
      console.warn(`Push failed for ${product.name}: ${err.message}`)
    }
  }

  console.log(`Done: matched=${results.matched} updated=${results.updated} skipped=${results.skipped} failed=${results.failed}`)
  return results
}

module.exports = {
  syncWebsiteToMasterSheet,
}
