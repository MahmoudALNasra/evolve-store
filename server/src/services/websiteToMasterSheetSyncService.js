const fs = require('fs')
const path = require('path')
const Product = require('../models/Product')
const InventorySyncProduct = require('../models/InventorySyncProduct')
const {
  fetchMasterProductRows,
  pushWebsiteProductToMasterRow,
  replaceMasterProductsTab,
  readMasterProductsMatrix,
  getStockSheetId,
  getStockSheetName,
} = require('./googleSheetsInventoryService')
const {
  PRODUCTS_SHEET_HEADERS,
  productsToSheetMatrix,
  mapWebsiteProductToSheetRow,
} = require('../utils/websiteToSheetMapper')

function cleanId(value) {
  return String(value || '').trim()
}

function ensureReportsDir() {
  const outDir = path.join(__dirname, '../../reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  return outDir
}

async function backupMasterProductsTab(options = {}) {
  const { sheetId, sheetName, values } = await readMasterProductsMatrix(options)
  const outDir = ensureReportsDir()
  const stamp = Date.now()
  const backupPath = path.join(outDir, `products-sheet-backup-${stamp}.json`)
  fs.writeFileSync(backupPath, JSON.stringify({
    sheetId,
    sheetName,
    backedUpAt: new Date().toISOString(),
    rowCount: values.length,
    values,
  }, null, 2))

  return {
    sheetId,
    sheetName,
    backupPath,
    previousRows: Math.max(0, values.length - 1),
  }
}

function verifyReplacedSheet(matrix, readValues) {
  const expectedHeader = PRODUCTS_SHEET_HEADERS
  const actualHeader = (readValues[0] || []).map((h) => String(h || '').trim())
  const expectedDataRows = Math.max(0, matrix.length - 1)
  const actualDataRows = Math.max(0, readValues.length - 1)

  // Fatal issues mean the write itself is wrong and must block the sync.
  // Warnings are legitimate data gaps in the catalog that should not undo a
  // successful write (e.g. a product genuinely has no description yet).
  const issues = []
  const warnings = []
  if (actualHeader.join('|') !== expectedHeader.join('|')) {
    issues.push('Header mismatch after write')
  }
  if (actualDataRows !== expectedDataRows) {
    issues.push(`Row count mismatch: expected ${expectedDataRows}, got ${actualDataRows}`)
  }

  const barcodes = new Set()
  const duplicateBarcodes = []
  let stockOneCount = 0
  let missingName = 0
  let missingDesc = 0

  for (let i = 1; i < readValues.length; i += 1) {
    const row = readValues[i] || []
    const barcode = String(row[0] || '').trim()
    const name = String(row[1] || '').trim()
    const desc = String(row[8] || '').trim()
    const stock = Number(row[9]) || 0

    if (barcode) {
      if (barcodes.has(barcode)) duplicateBarcodes.push(barcode)
      barcodes.add(barcode)
    }
    if (!name) missingName += 1
    if (!desc) missingDesc += 1
    if (stock === 1) stockOneCount += 1
  }

  // Fatal: structural / requested-transform failures.
  if (missingName > 0) issues.push(`${missingName} rows missing Name`)
  if (stockOneCount > 0) issues.push(`${stockOneCount} rows still have Stock=1`)

  // Warnings: catalog data quality, not a write failure.
  if (missingDesc > 0) warnings.push(`${missingDesc} rows missing Desc.`)
  if (duplicateBarcodes.length > 0) {
    warnings.push(`${duplicateBarcodes.length} duplicate barcode(s): ${[...new Set(duplicateBarcodes)].slice(0, 10).join(', ')}`)
  }

  return {
    ok: issues.length === 0,
    expectedDataRows,
    actualDataRows,
    uniqueBarcodes: barcodes.size,
    stockOneCount,
    missingName,
    missingDesc,
    duplicateBarcodes: duplicateBarcodes.length,
    issues,
    warnings,
  }
}

/**
 * Full refresh: website DB → Products tab A:O (all products by default).
 * Clears existing A:O values after backup, then writes fresh rows.
 */
async function replaceWebsiteCatalogOnMasterSheet(options = {}) {
  const dryRun = options.dryRun === true
  const includeUnpublished = options.includeUnpublished !== false
  const sheetId = options.sheetId || getStockSheetId()
  const sheetName = options.sheetName || getStockSheetName()

  const filter = includeUnpublished ? {} : { isPublished: true }
  const products = await Product.find(filter).sort({ name: 1 })
  const matrix = productsToSheetMatrix(products)

  const backup = dryRun
    ? { sheetId, sheetName, backupPath: null, previousRows: null, skipped: true }
    : await backupMasterProductsTab({ sheetId, sheetName })

  if (dryRun) {
    const preview = products.slice(0, 5).map(mapWebsiteProductToSheetRow)
    return {
      dryRun: true,
      sheetId,
      sheetName,
      productCount: products.length,
      matrixRows: matrix.length,
      backup,
      preview,
      write: null,
      verification: null,
    }
  }

  const write = await replaceMasterProductsTab(matrix, { sheetId, sheetName })
  const { values } = await readMasterProductsMatrix({ sheetId, sheetName })
  const verification = verifyReplacedSheet(matrix, values)

  const outDir = ensureReportsDir()
  const reportPath = path.join(outDir, `products-sheet-replace-${Date.now()}.json`)
  fs.writeFileSync(reportPath, JSON.stringify({
    sheetId,
    sheetName,
    productCount: products.length,
    backup,
    write,
    verification,
  }, null, 2))

  return {
    dryRun: false,
    sheetId,
    sheetName,
    productCount: products.length,
    matrixRows: matrix.length,
    backup,
    write,
    verification,
    reportPath,
  }
}

/** Legacy: update only rows that already exist in the sheet (matched by barcode/MPN). */
async function syncWebsiteToMasterSheet(options = {}) {
  const dryRun = options.dryRun === true
  const onlyPublished = options.onlyPublished !== false

  if (options.fullReplace === true) {
    return replaceWebsiteCatalogOnMasterSheet({
      dryRun,
      includeUnpublished: !onlyPublished,
    })
  }

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
  replaceWebsiteCatalogOnMasterSheet,
  backupMasterProductsTab,
  verifyReplacedSheet,
}
