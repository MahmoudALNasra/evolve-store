const { google } = require('googleapis')
const crypto = require('crypto')
const { getGoogleAuthClient } = require('../utils/googleSheetsAuth')
const {
  getStockSheetId,
  getStockSheetName,
  getMerchantFeedSheetId,
  getMerchantFeedSheetName,
  sheetRange,
} = require('./googleSheetsInventoryService')

const LOCAL_TAB = process.env.GOOGLE_LOCAL_INVENTORY_SHEET_NAME || 'Local inventory'
const CURRENCY = process.env.GOOGLE_MERCHANT_CURRENCY || 'USD'
const PICKUP_METHOD = process.env.GOOGLE_LOCAL_PICKUP_METHOD || 'buy'
const PICKUP_SLA = process.env.GOOGLE_LOCAL_PICKUP_SLA || 'same day'

const LOCAL_HEADERS = [
  'id',
  'store_code',
  'availability',
  'quantity',
  'price',
  'pickup_method',
  'pickup_sla',
]

function getStoreCode() {
  return String(process.env.GOOGLE_MERCHANT_STORE_CODE || '').trim()
}

function pidFromBarcode(barcode) {
  const raw = String(barcode || '').trim()
  if (!raw) return ''
  const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 8).toUpperCase()
  return `PID-${hash}`
}

function availabilityFromStock(stock) {
  const qty = Math.max(0, Number(stock) || 0)
  if (qty <= 0) return 'out_of_stock'
  if (qty <= 2) return 'limited_availability'
  return 'in_stock'
}

function formatPrice(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return ''
  return `${n.toFixed(2)} ${CURRENCY}`
}

async function getSheets() {
  const auth = await getGoogleAuthClient()
  return google.sheets({ version: 'v4', auth })
}

async function ensureLocalInventoryTab(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title,gridProperties))',
  })
  const existing = (meta.data.sheets || []).find(
    (s) => String(s.properties?.title || '') === LOCAL_TAB
  )
  if (existing) {
    return {
      sheetTabId: existing.properties.sheetId,
      created: false,
      columnCount: existing.properties.gridProperties?.columnCount || 0,
      rowCount: existing.properties.gridProperties?.rowCount || 0,
    }
  }

  const add = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: LOCAL_TAB,
              gridProperties: { rowCount: 2000, columnCount: 10 },
            },
          },
        },
      ],
    },
  })
  const props = add.data.replies?.[0]?.addSheet?.properties
  return {
    sheetTabId: props?.sheetId,
    created: true,
    columnCount: 10,
    rowCount: 2000,
  }
}

async function readMasterCatalog(sheets) {
  const sheetId = getStockSheetId()
  const sheetName = getStockSheetName()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: sheetRange(sheetName, 'A:O'),
  })
  const values = res.data.values || []
  const headers = (values[0] || []).map((h) => String(h || '').trim())
  const barcodeIdx = headers.indexOf('Barcode')
  const stockIdx = headers.indexOf('Stock')
  const priceLocalIdx = headers.indexOf('Price (Local)')
  const priceApiIdx = headers.indexOf('price (API)')
  if (barcodeIdx < 0 || stockIdx < 0) {
    throw new Error(`Master Products missing Barcode/Stock. Have: ${headers.join(', ')}`)
  }

  const products = []
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || []
    const barcode = String(row[barcodeIdx] || '').trim()
    if (!barcode) continue
    const stock = Number(row[stockIdx]) || 0
    const local = Number(row[priceLocalIdx]) || 0
    const api = Number(row[priceApiIdx]) || 0
    const price = local > 0 ? local : api
    products.push({ barcode, stock, price })
  }
  return products
}

async function readSheet1IdByGtin(sheets) {
  const sheetId = getMerchantFeedSheetId()
  const sheetName = getMerchantFeedSheetName()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: sheetRange(sheetName, 'A:N'),
  })
  const values = res.data.values || []
  const headers = (values[0] || []).map((h) => String(h || '').trim())
  const idIdx = headers.findIndex((h) => h.toLowerCase() === 'id')
  const gtinIdx = headers.findIndex((h) => h.toLowerCase() === 'gtin')
  const map = new Map()
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || []
    const id = String(row[idIdx] || '').trim()
    const gtin = String(row[gtinIdx] || '').trim()
    if (id && gtin) map.set(gtin, id)
  }
  return map
}

/**
 * Sync local inventory tab from master stock + Sheet1 product ids.
 */
async function syncLocalInventoryFeed(options = {}) {
  const dryRun = Boolean(options.dryRun)
  const storeCode = getStoreCode()
  if (!storeCode) {
    return {
      skipped: true,
      reason:
        'Set GOOGLE_MERCHANT_STORE_CODE in server/.env to your Google Business Profile store code (case-sensitive), then re-run.',
    }
  }

  const sheets = await getSheets()
  const feedSheetId = getMerchantFeedSheetId()
  const products = await readMasterCatalog(sheets)
  const idByGtin = await readSheet1IdByGtin(sheets)

  const rows = [LOCAL_HEADERS]
  let matched = 0
  let generatedIds = 0
  let inStock = 0

  for (const product of products) {
    let id = idByGtin.get(product.barcode)
    if (!id) {
      id = pidFromBarcode(product.barcode)
      generatedIds += 1
    } else {
      matched += 1
    }

    const availability = availabilityFromStock(product.stock)
    if (availability === 'in_stock' || availability === 'limited_availability') inStock += 1

    const qty = Math.max(0, Number(product.stock) || 0)
    const price = formatPrice(product.price)
    const canPickup = qty > 0

    rows.push([
      id,
      storeCode,
      availability,
      String(qty),
      price,
      canPickup ? PICKUP_METHOD : 'not supported',
      canPickup ? PICKUP_SLA : '',
    ])
  }

  console.log(
    `Local inventory: products=${products.length} matchedSheet1Ids=${matched} generatedIds=${generatedIds} inStockish=${inStock} store_code=${storeCode}`
  )

  if (dryRun) {
    return {
      skipped: false,
      dryRun: true,
      storeCode,
      tab: LOCAL_TAB,
      productCount: products.length,
      matchedSheet1Ids: matched,
      generatedIds,
      inStockish: inStock,
      sample: rows.slice(1, 4),
    }
  }

  const tab = await ensureLocalInventoryTab(sheets, feedSheetId)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: feedSheetId,
    range: sheetRange(LOCAL_TAB, 'A:G'),
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId: feedSheetId,
    range: sheetRange(LOCAL_TAB, 'A1'),
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  })

  return {
    skipped: false,
    dryRun: false,
    storeCode,
    tab: LOCAL_TAB,
    tabCreated: tab.created,
    spreadsheetId: feedSheetId,
    productCount: products.length,
    matchedSheet1Ids: matched,
    generatedIds,
    inStockish: inStock,
  }
}

module.exports = {
  syncLocalInventoryFeed,
  getStoreCode,
  LOCAL_TAB,
  LOCAL_HEADERS,
}
