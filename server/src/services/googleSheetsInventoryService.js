const { google } = require('googleapis')

const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

function getSheetId() {
  return process.env.GOOGLE_INVENTORY_SHEET_ID || '1xlDAlbKki5lwI91_Jw1pTe6mhyxIwEmp2_tJ6vOYMag'
}

function getSheetName() {
  return process.env.GOOGLE_INVENTORY_SHEET_NAME || 'Products'
}

function getMerchantFeedSheetId() {
  return process.env.GOOGLE_MERCHANT_FEED_SHEET_ID || ''
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

function getGoogleAuth() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_USE_APPLICATION_DEFAULT === 'true') {
    return new google.auth.GoogleAuth({ scopes: DEFAULT_SCOPES })
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!clientEmail || !privateKey) {
    throw new Error('Google Sheets auth is not configured')
  }

  return new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: DEFAULT_SCOPES,
  })
}

async function getSheetsClient() {
  const auth = await getGoogleAuth().getClient()
  return google.sheets({ version: 'v4', auth })
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
  const range = process.env.GOOGLE_INVENTORY_RANGE || `${sheetName}!A:O`
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
  const sheetId = getSheetId()
  const sheetName = getSheetName()
  const stockColumn = Number(process.env.GOOGLE_INVENTORY_STOCK_COLUMN || 10)
  const cell = `${sheetName}!${columnNumberToName(stockColumn)}${rowNumber}`
  const sheets = await getSheetsClient()

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: cell,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[stock]] },
  })
}

async function updateMerchantFeedLinkCell(rowNumber, productUrl) {
  const sheetId = getMerchantFeedSheetId()
  if (!sheetId || !productUrl) return { skipped: true }

  const sheetName = getMerchantFeedSheetName()
  const linkColumn = Number(process.env.GOOGLE_MERCHANT_FEED_LINK_COLUMN || 7)
  const cell = `${sheetName}!${columnNumberToName(linkColumn)}${rowNumber}`
  const sheets = await getSheetsClient()

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: cell,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[productUrl]] },
  })

  return { skipped: false, cell }
}

module.exports = {
  fetchInventoryRows,
  updateStockCell,
  updateMerchantFeedLinkCell,
  getSheetId,
  getSheetName,
}
