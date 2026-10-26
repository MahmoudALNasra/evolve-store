/**
 * Rewrite each Merchant Center primary-feed row to Google Shopping standards
 * and write it back to Sheet1 (the feed Merchant Center fetches).
 *
 * Updates: title, description, product highlight (when empty), google product category.
 * Leaves price, image, link, id, and availability formulas in place.
 *
 * Usage (droplet, /var/www/evolve-store/server):
 *   npm run inventory:post-shopping-listings -- --dry-run
 *   npm run inventory:post-shopping-listings
 */
require('dotenv').config()
const { google } = require('googleapis')
const { getGoogleAuthClient } = require('../utils/googleSheetsAuth')
const {
  getMerchantFeedSheetId,
  getMerchantFeedSheetName,
  sheetRange,
} = require('../services/googleSheetsInventoryService')
const { toShoppingListing } = require('../utils/googleShoppingListing')

function columnToLetter(columnNumber) {
  let name = ''
  let n = columnNumber
  while (n > 0) {
    const remainder = (n - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function headerIndex(headers, name) {
  const needle = String(name).toLowerCase()
  return headers.findIndex((header) => String(header || '').trim().toLowerCase() === needle)
}

async function getSheets() {
  const auth = await getGoogleAuthClient()
  return google.sheets({ version: 'v4', auth })
}

async function postGoogleShoppingListings({ dryRun = false } = {}) {
  const sheets = await getSheets()
  const spreadsheetId = getMerchantFeedSheetId()
  const sheetName = getMerchantFeedSheetName()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange(sheetName, 'A:AZ'),
  })
  const values = res.data.values || []
  if (values.length < 2) {
    return { skipped: true, reason: 'Sheet1 has no product rows' }
  }

  const headers = values[0].map((header) => String(header || '').trim())
  const idIdx = headerIndex(headers, 'id')
  const titleIdx = headerIndex(headers, 'title')
  const descIdx = headerIndex(headers, 'description')
  const brandIdx = headerIndex(headers, 'brand')
  const highlightIdx = headerIndex(headers, 'product highlight')
  if (titleIdx < 0 || descIdx < 0) {
    throw new Error(`Sheet1 is missing title/description. Headers: ${headers.join(', ')}`)
  }

  let categoryIdx = headerIndex(headers, 'google product category')
  const titleCol = []
  const descCol = []
  const highlightCol = []
  const categoryCol = []
  const samples = []
  let changed = 0
  let titled = 0

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || []
    const id = idIdx >= 0 ? String(row[idIdx] || '').trim() : ''
    const currentTitle = String(row[titleIdx] || '').trim()
    const currentDesc = String(row[descIdx] || '').trim()
    const brand = brandIdx >= 0 ? String(row[brandIdx] || '').trim() : ''
    const currentHighlight = highlightIdx >= 0 ? String(row[highlightIdx] || '').trim() : ''

    if (!id && !currentTitle) {
      titleCol.push([''])
      descCol.push([''])
      highlightCol.push([''])
      categoryCol.push([''])
      continue
    }

    titled += 1
    const listing = toShoppingListing({
      title: currentTitle,
      description: currentDesc,
      brand,
    })
    const highlight = currentHighlight || listing.productHighlight
    if (listing.title !== currentTitle || listing.description !== currentDesc || highlight !== currentHighlight) {
      changed += 1
    }
    if (samples.length < 8 && listing.title !== currentTitle) {
      samples.push({ id, before: currentTitle, after: listing.title })
    }
    titleCol.push([listing.title])
    descCol.push([listing.description])
    highlightCol.push([highlight])
    categoryCol.push([listing.googleProductCategory])
  }

  const end = values.length
  console.log(`Sheet1 "${sheetName}": titled=${titled} rowsToWrite=${titleCol.length} changed=${changed}`)
  for (const sample of samples) {
    console.log(`- ${sample.id}`)
    console.log(`  before: ${sample.before}`)
    console.log(`  after:  ${sample.after}`)
  }

  if (dryRun) {
    return { dryRun: true, titled, changed, samples, spreadsheetId, sheetName }
  }

  const data = [
    { range: sheetRange(sheetName, `${columnToLetter(titleIdx + 1)}2:${columnToLetter(titleIdx + 1)}${end}`), values: titleCol },
    { range: sheetRange(sheetName, `${columnToLetter(descIdx + 1)}2:${columnToLetter(descIdx + 1)}${end}`), values: descCol },
  ]
  if (highlightIdx >= 0) {
    data.push({
      range: sheetRange(sheetName, `${columnToLetter(highlightIdx + 1)}2:${columnToLetter(highlightIdx + 1)}${end}`),
      values: highlightCol,
    })
  }
  if (categoryIdx < 0) {
    categoryIdx = headers.length
    data.push({
      range: sheetRange(sheetName, `${columnToLetter(categoryIdx + 1)}1`),
      values: [['google product category']],
    })
  }
  data.push({
    range: sheetRange(sheetName, `${columnToLetter(categoryIdx + 1)}2:${columnToLetter(categoryIdx + 1)}${end}`),
    values: categoryCol,
  })

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data },
  })

  return { dryRun: false, titled, changed, samples, spreadsheetId, sheetName }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1'
  const result = await postGoogleShoppingListings({ dryRun })
  console.log(JSON.stringify({ ...result, samples: result.samples?.length || 0 }, null, 2))
  if (!dryRun && !result.skipped) {
    console.log(`
Wrote Shopping-standard titles and plain-text descriptions to Sheet1.
Merchant Center → Products → Data sources → primary source → Update.
Click potential is an estimate. It moves after Google recrawls the feed, not instantly.
`)
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.stack || err.message || err)
    process.exit(1)
  })
}

module.exports = { postGoogleShoppingListings }
