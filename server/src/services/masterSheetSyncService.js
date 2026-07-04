const { google } = require('googleapis')
const { getGoogleAuthClient } = require('../utils/googleSheetsAuth')
const { quoteSheetName, sheetRange } = require('./googleSheetsInventoryService')

const PRODUCT_HEADERS = [
  'Barcode', 'Name', 'Brand', 'active_ingredient', 'dosage_form', 'package_ndc',
  'price (API)', 'Image URLs', 'Desc.', 'Stock', 'Google Category',
  'Price (Local)', 'Stock Alert', 'image (extra)', 'MPN',
]

async function getSheetsClient() {
  const auth = await getGoogleAuthClient()
  return google.sheets({ version: 'v4', auth })
}

/** Source of truth: master spreadsheet, Products tab. */
function getMasterConfig() {
  return {
    sheetId: process.env.GOOGLE_MASTER_SHEET_ID || '1xlDAlbKki5lwI91_Jw1pTe6mhyxIwEmp2_tJ6vOYMag',
    sheetName: process.env.GOOGLE_MASTER_SHEET_NAME || 'Products',
    range: process.env.GOOGLE_MASTER_RANGE || '',
  }
}

/** IMPORTRANGE destination on the GMC spreadsheet (normally filled by Sheets, not code). */
function getImportTabConfig() {
  return {
    sheetId: process.env.GOOGLE_INVENTORY_SHEET_ID || '1LKXERqfQUOssj3WadUxIgwoPdcOyRcJGf8itFwTnhjk',
    sheetName: process.env.GOOGLE_INVENTORY_SHEET_NAME || 'from MasterSheet(products)',
  }
}

function normalizeHeader(value) {
  return String(value || '').trim()
}

/**
 * Optional manual copy: master Products → GMC sheet import tab.
 * Normally IMPORTRANGE handles this; enable only if INVENTORY_SYNC_MASTER_FIRST=true.
 */
async function syncMasterSheetToProductsTab() {
  const master = getMasterConfig()
  const importTab = getImportTabConfig()
  const masterRange = master.range || sheetRange(master.sheetName, 'A:O')
  const sheets = await getSheetsClient()

  const masterResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: master.sheetId,
    range: masterRange,
  })

  const values = masterResponse.data.values || []
  if (values.length < 2) {
    return { copiedRows: 0, message: 'Master sheet has no data rows' }
  }

  const masterHeaders = values[0].map(normalizeHeader)
  const dataRows = values.slice(1).filter((row) => String(row[0] || '').trim())
  const outputRows = dataRows.map((row) => {
    const sourceRow = {}
    masterHeaders.forEach((header, i) => {
      sourceRow[header] = row[i] ?? ''
    })

    return PRODUCT_HEADERS.map((header) => {
      const idx = masterHeaders.findIndex((h) => h.toLowerCase() === header.toLowerCase())
      if (idx >= 0) return row[idx] ?? ''
      return sourceRow[header] ?? ''
    })
  })

  const targetRange = sheetRange(importTab.sheetName, 'A1')
  await sheets.spreadsheets.values.clear({
    spreadsheetId: importTab.sheetId,
    range: sheetRange(importTab.sheetName, 'A:O'),
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId: importTab.sheetId,
    range: targetRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [PRODUCT_HEADERS, ...outputRows],
    },
  })

  return {
    masterSheetId: master.sheetId,
    masterTab: master.sheetName,
    importSheetId: importTab.sheetId,
    importTab: importTab.sheetName,
    copiedRows: outputRows.length,
  }
}

module.exports = {
  syncMasterSheetToProductsTab,
  PRODUCT_HEADERS,
}
