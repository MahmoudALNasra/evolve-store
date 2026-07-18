const { google } = require('googleapis')
const { getGoogleAuthClient } = require('../utils/googleSheetsAuth')

function getSheetId() {
  return process.env.GOOGLE_INVENTORY_SHEET_ID || '1LKXERqfQUOssj3WadUxIgwoPdcOyRcJGf8itFwTnhjk'
}

function getSheetName() {
  return process.env.GOOGLE_INVENTORY_SHEET_NAME || 'from MasterSheet(products)'
}

function getStockSheetId() {
  return process.env.GOOGLE_STOCK_SHEET_ID
    || process.env.GOOGLE_MASTER_SHEET_ID
    || '1xlDAlbKki5lwI91_Jw1pTe6mhyxIwEmp2_tJ6vOYMag'
}

function getStockSheetName() {
  return process.env.GOOGLE_STOCK_SHEET_NAME
    || process.env.GOOGLE_MASTER_SHEET_NAME
    || 'Products'
}

function quoteSheetName(name) {
  if (/[^A-Za-z0-9_]/.test(name)) {
    return `'${String(name).replace(/'/g, "''")}'`
  }
  return name
}

function sheetRange(sheetName, a1) {
  return `${quoteSheetName(sheetName)}!${a1}`
}

function getMerchantFeedSheetId() {
  return process.env.GOOGLE_MERCHANT_FEED_SHEET_ID || '1LKXERqfQUOssj3WadUxIgwoPdcOyRcJGf8itFwTnhjk'
}

function getMerchantFeedSheetName() {
  return process.env.GOOGLE_MERCHANT_FEED_SHEET_NAME || 'Sheet1'
}

function columnNumberToName(columnNumber) {
  let name = ''
  let n = columnNumber
  while (n > 0) {
    const remainder = (n - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

async function getSheetsClient() {
  const auth = await getGoogleAuthClient()
  return google.sheets({ version: 'v4', auth })
}

let lastSheetWriteAt = 0

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function throttledSheetWrite(fn) {
  const delayMs = Number(process.env.GOOGLE_SHEETS_WRITE_DELAY_MS || 250)
  const now = Date.now()
  const wait = Math.max(0, lastSheetWriteAt + delayMs - now)
  if (wait) await sleep(wait)
  const result = await fn()
  lastSheetWriteAt = Date.now()
  return result
}

function rowsToObjects(values = []) {
  const [headers = [], ...rows] = values
  const stockColumnIndex = headers.findIndex((header) => String(header).trim() === 'Stock') + 1

  return rows.map((row, index) => {
    const sourceRow = {}
    headers.forEach((header, headerIndex) => {
      sourceRow[String(header).trim()] = row[headerIndex] ?? ''
    })

    return {
      rowNumber: index + 2,
      stockColumnIndex,
      sourceRow,
    }
  })
}

async function fetchInventoryRows() {
  const sheetId = getSheetId()
  const sheetName = getSheetName()
  const range = process.env.GOOGLE_INVENTORY_RANGE || sheetRange(sheetName, 'A:O')
  const sheets = await getSheetsClient()

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  })

  return {
    sheetId,
    sheetName,
    rows: rowsToObjects(response.data.values || []),
  }
}

async function updateStockCell(rowNumber, stock) {
  const sheetId = getStockSheetId()
  const sheetName = getStockSheetName()
  const stockColumn = Number(process.env.GOOGLE_INVENTORY_STOCK_COLUMN || 10)
  const cell = sheetRange(sheetName, `${columnNumberToName(stockColumn)}${rowNumber}`)
  const sheets = await getSheetsClient()

  await throttledSheetWrite(() => sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: cell,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[stock]] },
  }))
}

/** Master Products tab column numbers (A=1 … O=15). */
function getMasterColumnMap() {
  return {
    name: Number(process.env.GOOGLE_MASTER_COL_NAME || 2),
    desc: Number(process.env.GOOGLE_MASTER_COL_DESC || 9),
    stock: Number(process.env.GOOGLE_MASTER_COL_STOCK || 10),
    priceLocal: Number(process.env.GOOGLE_MASTER_COL_PRICE_LOCAL || 12),
    mpn: Number(process.env.GOOGLE_MASTER_COL_MPN || 15),
  }
}

async function fetchMasterProductRows() {
  const { sheetId, sheetName, rows, headers } = await fetchMasterInventoryRows()
  const barcodeIndex = new Map()
  const mpnIndex = new Map()

  const barcodeCol = Math.max(headers.indexOf('Barcode'), 0)
  const mpnCol = Math.max(headers.indexOf('MPN'), 14)

  rows.forEach((entry) => {
    const barcode = String(entry.sourceRow.Barcode || '').trim()
    const mpn = String(entry.sourceRow.MPN || '').trim()
    if (barcode) barcodeIndex.set(barcode, entry.rowNumber)
    if (mpn) mpnIndex.set(mpn, entry.rowNumber)
  })

  return { sheetId, sheetName, barcodeIndex, mpnIndex, headers }
}

/** Read master Products tab (source of truth) in the same shape as fetchInventoryRows. */
async function fetchMasterInventoryRows() {
  const sheetId = getStockSheetId()
  const sheetName = getStockSheetName()
  const range = process.env.GOOGLE_MASTER_RANGE || sheetRange(sheetName, 'A:O')
  const sheets = await getSheetsClient()

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  })

  const values = response.data.values || []
  const headers = (values[0] || []).map((h) => String(h).trim())

  return {
    sheetId,
    sheetName,
    headers,
    rows: rowsToObjects(values),
  }
}

/** Push website product fields → master Products tab (website = source of truth). */
async function pushWebsiteProductToMasterRow(rowNumber, product) {
  const sheetId = getStockSheetId()
  const sheetName = getStockSheetName()
  const cols = getMasterColumnMap()
  const sheets = await getSheetsClient()

  const updates = [
    { col: cols.name, value: product.name },
    { col: cols.desc, value: product.description || '' },
    { col: cols.stock, value: Number(product.stock) || 0 },
    { col: cols.priceLocal, value: Number(product.price).toFixed(2) },
  ]

  if (product.sku) {
    updates.push({ col: cols.mpn, value: product.sku })
  }

  const data = updates.map(({ col, value }) => ({
    range: sheetRange(sheetName, `${columnNumberToName(col)}${rowNumber}`),
    values: [[value]],
  }))

  await throttledSheetWrite(() => sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data,
    },
  }))
}

const WRITE_CHUNK_SIZE = Number(process.env.GOOGLE_SHEETS_WRITE_CHUNK || 200)

/**
 * Clear Products tab A:O values and write a full matrix (header + rows).
 * Preserves formatting / columns beyond O.
 */
async function replaceMasterProductsTab(matrix, options = {}) {
  const sheetId = options.sheetId || getStockSheetId()
  const sheetName = options.sheetName || getStockSheetName()
  const clearRange = options.clearRange || sheetRange(sheetName, 'A:O')
  const sheets = await getSheetsClient()

  if (!Array.isArray(matrix) || matrix.length < 1) {
    throw new Error('replaceMasterProductsTab requires a non-empty values matrix')
  }

  await throttledSheetWrite(() => sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: clearRange,
  }))

  let written = 0
  for (let i = 0; i < matrix.length; i += WRITE_CHUNK_SIZE) {
    const chunk = matrix.slice(i, i + WRITE_CHUNK_SIZE)
    const startRow = i + 1
    const endRow = startRow + chunk.length - 1
    const range = sheetRange(sheetName, `A${startRow}:O${endRow}`)

    await throttledSheetWrite(() => sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: chunk },
    }))

    written += chunk.length
  }

  return {
    sheetId,
    sheetName,
    rowsWritten: written,
    dataRows: Math.max(0, written - 1),
  }
}

async function readMasterProductsMatrix(options = {}) {
  const sheetId = options.sheetId || getStockSheetId()
  const sheetName = options.sheetName || getStockSheetName()
  const range = options.range || sheetRange(sheetName, 'A:O')
  const sheets = await getSheetsClient()

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  })

  return {
    sheetId,
    sheetName,
    values: response.data.values || [],
  }
}

async function updateMerchantFeedLinkCell(rowNumber, productUrl) {
  const sheetId = getMerchantFeedSheetId()
  if (!sheetId || !productUrl) return { skipped: true }

  const sheetName = getMerchantFeedSheetName()
  const linkColumn = Number(process.env.GOOGLE_MERCHANT_FEED_LINK_COLUMN || 7)
  const cell = sheetRange(sheetName, `${columnNumberToName(linkColumn)}${rowNumber}`)
  const sheets = await getSheetsClient()

  await throttledSheetWrite(() => sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: cell,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[productUrl]] },
  }))

  return { skipped: false, cell }
}

module.exports = {
  fetchInventoryRows,
  fetchMasterInventoryRows,
  fetchMasterProductRows,
  updateStockCell,
  pushWebsiteProductToMasterRow,
  replaceMasterProductsTab,
  readMasterProductsMatrix,
  updateMerchantFeedLinkCell,
  getSheetId,
  getSheetName,
  getStockSheetId,
  getStockSheetName,
  quoteSheetName,
  sheetRange,
}
