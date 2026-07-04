const { google } = require('googleapis')

const PRODUCT_HEADERS = [
  'Barcode', 'Name', 'Brand', 'active_ingredient', 'dosage_form', 'package_ndc',
  'price (API)', 'Image URLs', 'Desc.', 'Stock', 'Google Category',
  'Price (Local)', 'Stock Alert', 'image (extra)', 'MPN',
]

function getGoogleAuth() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_USE_APPLICATION_DEFAULT === 'true') {
    return new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!clientEmail || !privateKey) {
    throw new Error('Google Sheets auth is not configured')
  }

  return new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function getSheetsClient() {
  const auth = await getGoogleAuth().getClient()
  return google.sheets({ version: 'v4', auth })
}

function getMasterConfig() {
  return {
    sheetId: process.env.GOOGLE_MASTER_SHEET_ID || '1xlDAlbKki5lwI91_Jw1pTe6mhyxIwEmp2_tJ6vOYMag',
    sheetName: process.env.GOOGLE_MASTER_SHEET_NAME || 'from MasterSheet(products)',
    range: process.env.GOOGLE_MASTER_RANGE || '',
  }
}

function getProductsSheetConfig() {
  return {
    sheetId: process.env.GOOGLE_INVENTORY_SHEET_ID || '1LKXERqfQUOssj3WadUxIgwoPdcOyRcJGf8itFwTnhjk',
    sheetName: process.env.GOOGLE_INVENTORY_SHEET_NAME || 'Products',
  }
}

function normalizeHeader(value) {
  return String(value || '').trim()
}

function rowToProductValues(sourceRow, headers) {
  return headers.map((header) => sourceRow[header] ?? '')
}

async function syncMasterSheetToProductsTab() {
  const master = getMasterConfig()
  const products = getProductsSheetConfig()
  const masterRange = master.range || `${master.sheetName}!A:O`
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
  const headerMap = PRODUCT_HEADERS.map((header) => {
    const idx = masterHeaders.findIndex((h) => h.toLowerCase() === header.toLowerCase())
    return idx >= 0 ? idx : masterHeaders.indexOf(header)
  })

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

  const targetRange = `${products.sheetName}!A1`
  await sheets.spreadsheets.values.clear({
    spreadsheetId: products.sheetId,
    range: `${products.sheetName}!A:O`,
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId: products.sheetId,
    range: targetRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [PRODUCT_HEADERS, ...outputRows],
    },
  })

  return {
    masterSheetId: master.sheetId,
    masterTab: master.sheetName,
    productsSheetId: products.sheetId,
    productsTab: products.sheetName,
    copiedRows: outputRows.length,
  }
}

module.exports = {
  syncMasterSheetToProductsTab,
  PRODUCT_HEADERS,
}
