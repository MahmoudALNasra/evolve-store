/**
 * Complete Google Merchant Center Sheet1 + master Products cleanup.
 *
 * Fixes:
 *  1) Orphan PID rows (~1500 IDs / ~365 real products) — clean column A
 *  2) price → "12.99 USD"
 *  3) title → max 150 chars
 *  4) image hosts → https://evolvepharmacy.com (+ prefer non-AVIF)
 *  5) restore/fill description, availability, gtin, mpn, brand, condition
 *  6) preserve existing product links when possible
 *  7) clear excluded_destination (keep Free listings + Free local listings eligible)
 *  8) sync "Local inventory" tab from master stock (needs GOOGLE_MERCHANT_STORE_CODE)
 *
 * Usage (droplet, /var/www/evolve-store/server):
 *   DRY_RUN=1 npm run inventory:fix-merchant-feed
 *   npm run inventory:fix-merchant-feed
 */
require('dotenv').config()
const crypto = require('crypto')
const { google } = require('googleapis')
const { getGoogleAuthClient } = require('../utils/googleSheetsAuth')
const {
  getStockSheetId,
  getStockSheetName,
  getMerchantFeedSheetId,
  getMerchantFeedSheetName,
  sheetRange,
} = require('../services/googleSheetsInventoryService')
const {
  rewritePublicMediaHost,
  isMerchantSafeImageUrl,
} = require('../utils/websiteToSheetMapper')
const { getSiteOrigin } = require('../utils/productMediaPaths')
const { syncLocalInventoryFeed } = require('../services/localInventoryFeedService')

const LEGACY_HOST = '138.197.107.137'
const PUBLIC_ORIGIN = (process.env.SITE_URL || process.env.PUBLIC_MEDIA_URL || 'https://evolvepharmacy.com')
  .replace(/\/$/, '')
const CURRENCY = process.env.GOOGLE_MERCHANT_CURRENCY || 'USD'
const TITLE_MAX = 150
const CLEAR_TO_ROW = Number(process.env.MERCHANT_FEED_CLEAR_TO_ROW || 2500)

function preferSafePrimary(primary, extra) {
  const urls = [
    ...String(primary || '').split(','),
    ...String(extra || '').split(','),
  ]
    .map((u) => rewritePublicMediaHost(u.trim()))
    .filter(Boolean)

  const safe = urls.find(isMerchantSafeImageUrl)
  if (!safe) return { primary: urls[0] || '', extra: urls.slice(1).join(', ') }
  return { primary: safe, extra: urls.filter((u) => u !== safe).join(', ') }
}

function pidFromBarcode(barcode) {
  const raw = String(barcode || '').trim()
  if (!raw) return ''
  const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 8).toUpperCase()
  return `PID-${hash}`
}

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

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

function indexOfHeader(headers, name) {
  const needle = String(name).toLowerCase()
  return headers.findIndex((h) => String(h || '').trim().toLowerCase() === needle)
}

async function getSheets() {
  const auth = await getGoogleAuthClient()
  return google.sheets({ version: 'v4', auth })
}

async function fixMasterProducts(sheets, { dryRun }) {
  const sheetId = getStockSheetId()
  const sheetName = getStockSheetName()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: sheetRange(sheetName, 'A:O'),
  })
  const values = res.data.values || []
  if (values.length < 2) {
    return { sheetId, sheetName, productCount: 0, barcodes: [], names: [], skipped: true }
  }

  const headers = values[0].map((h) => String(h || '').trim())
  const imgIdx = headers.indexOf('Image URLs')
  const extraIdx = headers.indexOf('image (extra)')
  const barcodeIdx = headers.indexOf('Barcode')
  const nameIdx = headers.indexOf('Name')
  if (imgIdx < 0 || barcodeIdx < 0) {
    throw new Error(`Master Products missing required columns. Have: ${headers.join(', ')}`)
  }

  let updatedImages = 0
  let ipHits = 0
  const imgCol = []
  const extraCol = []
  const barcodes = []
  const names = []

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || []
    const barcode = String(row[barcodeIdx] || '').trim()
    const name = String(row[nameIdx] || '').trim()
    barcodes.push(barcode)
    names.push(name)
    const beforeImg = String(row[imgIdx] || '')
    const beforeExtra = extraIdx >= 0 ? String(row[extraIdx] || '') : ''
    if (beforeImg.includes(LEGACY_HOST) || beforeExtra.includes(LEGACY_HOST)) ipHits += 1
    const { primary, extra } = preferSafePrimary(beforeImg, beforeExtra)
    if (primary !== beforeImg || extra !== beforeExtra) updatedImages += 1
    imgCol.push([primary])
    extraCol.push([extra])
  }

  console.log(`Master "${sheetName}": products=${barcodes.length} ipHits=${ipHits} imageUpdates=${updatedImages}`)
  console.log(`  media origin: ${getSiteOrigin()} (expected ${PUBLIC_ORIGIN})`)

  if (!dryRun && updatedImages > 0) {
    const endRow = values.length
    const data = [{ range: sheetRange(sheetName, `H2:H${endRow}`), values: imgCol }]
    if (extraIdx >= 0) data.push({ range: sheetRange(sheetName, `N2:N${endRow}`), values: extraCol })
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: 'RAW', data },
    })
  }

  return {
    sheetId,
    sheetName,
    productCount: barcodes.length,
    barcodes,
    names,
    updatedImages,
    ipHits,
    dryRun,
  }
}

async function getSheetTabId(sheets, spreadsheetId, sheetName) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title,gridProperties))',
  })
  const tab = (meta.data.sheets || []).find(
    (s) => String(s.properties?.title || '') === String(sheetName)
  )
  if (!tab) throw new Error(`Sheet tab not found: ${sheetName}`)
  return {
    sheetTabId: tab.properties.sheetId,
    columnCount: tab.properties.gridProperties?.columnCount || 0,
    rowCount: tab.properties.gridProperties?.rowCount || 0,
  }
}

async function ensureGridLargeEnough(sheets, spreadsheetId, sheetName, { minColumns, minRows }) {
  const { sheetTabId, columnCount, rowCount } = await getSheetTabId(sheets, spreadsheetId, sheetName)
  const requests = []
  if (columnCount < minColumns) {
    requests.push({
      appendDimension: {
        sheetId: sheetTabId,
        dimension: 'COLUMNS',
        length: minColumns - columnCount,
      },
    })
  }
  if (rowCount < minRows) {
    requests.push({
      appendDimension: {
        sheetId: sheetTabId,
        dimension: 'ROWS',
        length: minRows - rowCount,
      },
    })
  }
  if (!requests.length) {
    return { sheetTabId, columnCount, rowCount, expanded: false }
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  })
  return {
    sheetTabId,
    columnCount: Math.max(columnCount, minColumns),
    rowCount: Math.max(rowCount, minRows),
    expanded: true,
  }
}

function buildFeedFormulas() {
  const m = "'from MasterSheet(products)'"
  return {
    B2: `=ARRAYFORMULA(IF(${m}!B2:B="",,LEFT(${m}!B2:B,${TITLE_MAX})))`,
    C2: `=ARRAYFORMULA(IF(${m}!B2:B="",,${m}!I2:I))`,
    D2: `=ARRAYFORMULA(IF(${m}!B2:B="",,IF(IFERROR(VALUE(${m}!J2:J),0)>0,"in_stock","out_of_stock")))`,
    I2:
      `=ARRAYFORMULA(IF(${m}!H2:H="",,` +
      `SUBSTITUTE(SUBSTITUTE(${m}!H2:H,"http://${LEGACY_HOST}","${PUBLIC_ORIGIN}"),` +
      `"https://${LEGACY_HOST}","${PUBLIC_ORIGIN}")))`,
    J2:
      `=ARRAYFORMULA(IF(${m}!B2:B="",,` +
      `IF(IFERROR(VALUE(${m}!L2:L),0)>0,TEXT(VALUE(${m}!L2:L),"0.00")&" ${CURRENCY}",` +
      `IF(IFERROR(VALUE(${m}!G2:G),0)>0,TEXT(VALUE(${m}!G2:G),"0.00")&" ${CURRENCY}",))))`,
    M2: `=ARRAYFORMULA(IF(${m}!B2:B="",,IF(LEN(TO_TEXT(${m}!A2:A))>0,"yes","no")))`,
    N2: `=ARRAYFORMULA(IF(${m}!A2:A="",,${m}!A2:A))`,
    O2: `=ARRAYFORMULA(IF(${m}!B2:B="",,${m}!O2:O))`,
    P2: `=ARRAYFORMULA(IF(${m}!B2:B="",,${m}!C2:C))`,
    S2:
      `=ARRAYFORMULA(IF(${m}!N2:N="",,` +
      `SUBSTITUTE(SUBSTITUTE(${m}!N2:N,"http://${LEGACY_HOST}","${PUBLIC_ORIGIN}"),` +
      `"https://${LEGACY_HOST}","${PUBLIC_ORIGIN}")))`,
    T2: `=ARRAYFORMULA(IF(${m}!B2:B="",,"new"))`,
  }
}

async function fixSheet1(sheets, masterInfo, { dryRun }) {
  const sheetId = getMerchantFeedSheetId()
  const sheetName = getMerchantFeedSheetName()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: sheetRange(sheetName, 'A:AZ'),
  })
  const values = res.data.values || []
  const headers = (values[0] || []).map((h) => String(h || '').trim())

  const idIdx = indexOfHeader(headers, 'id')
  const titleIdx = indexOfHeader(headers, 'title')
  const gtinIdx = indexOfHeader(headers, 'gtin')
  const linkIdx = indexOfHeader(headers, 'link')
  const mobileIdx = indexOfHeader(headers, 'mobile link')

  const existingByGtin = new Map()
  let orphanIds = 0
  let titled = 0
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || []
    const id = String(row[idIdx] || '').trim()
    const title = String(row[titleIdx] || '').trim()
    const gtin = String(row[gtinIdx] || '').trim()
    const link = String(row[linkIdx] || '').trim()
    const mobile = String(row[mobileIdx] || '').trim()
    if (id && !title) orphanIds += 1
    if (!title) continue
    titled += 1
    if (gtin) {
      existingByGtin.set(gtin, { id, link, mobile })
    }
  }

  const barcodes = masterInfo.barcodes || []
  const names = masterInfo.names || []
  const idCol = []
  const linkCol = []
  const mobileCol = []
  let preservedIds = 0
  let preservedLinks = 0

  for (let i = 0; i < barcodes.length; i++) {
    const barcode = barcodes[i]
    const prev = existingByGtin.get(barcode)
    const id = prev?.id || pidFromBarcode(barcode)
    if (prev?.id) preservedIds += 1
    idCol.push([id])

    let link = prev?.link || ''
    if (!link || /138\.197|localhost/i.test(link)) {
      const slug = slugify(names[i])
      link = slug ? `${PUBLIC_ORIGIN}/product/${slug}` : ''
    } else {
      preservedLinks += 1
    }
    linkCol.push([link])
    mobileCol.push([prev?.mobile && !/138\.197|localhost/i.test(prev.mobile) ? prev.mobile : link])
  }

  const formulas = buildFeedFormulas()
  const excludedIdx = indexOfHeader(headers, 'excluded destination')

  console.log(`Sheet1 "${sheetName}": rows=${Math.max(0, values.length - 1)} titled=${titled} orphanIds=${orphanIds}`)
  console.log(`  writing ${idCol.length} clean product rows; preserve ids=${preservedIds} links=${preservedLinks}`)
  if (excludedIdx >= 0) {
    console.log(`  will clear excluded destination column ${columnToLetter(excludedIdx + 1)} (local listings stay eligible)`)
  }

  if (dryRun) {
    return {
      sheetId,
      sheetName,
      dryRun: true,
      before: { totalRows: Math.max(0, values.length - 1), titled, orphanIds },
      afterProductCount: idCol.length,
      preservedIds,
      preservedLinks,
      sampleIds: idCol.slice(0, 3).map((r) => r[0]),
      sampleLinks: linkCol.slice(0, 2).map((r) => r[0]),
      formulaCells: Object.keys(formulas),
      clearExcludedDestination: excludedIdx >= 0,
    }
  }

  // Wipe stale feed body (orphans + old values/formulas).
  const lastCol = columnToLetter(Math.max(headers.length, 1))
  await ensureGridLargeEnough(sheets, sheetId, sheetName, {
    minColumns: Math.max(headers.length, 1),
    minRows: CLEAR_TO_ROW,
  })
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: sheetRange(sheetName, `A2:${lastCol}${CLEAR_TO_ROW}`),
  })

  const end = idCol.length + 1
  const data = []
  if (idCol.length) {
    data.push({ range: sheetRange(sheetName, `A2:A${end}`), values: idCol })
    data.push({ range: sheetRange(sheetName, `G2:G${end}`), values: linkCol })
    data.push({ range: sheetRange(sheetName, `H2:H${end}`), values: mobileCol })
  }
  for (const [cell, formula] of Object.entries(formulas)) {
    data.push({ range: sheetRange(sheetName, cell), values: [[formula]] })
  }
  // Keep Free listings + Free local listings eligible (do not exclude local destinations).
  if (excludedIdx >= 0) {
    data.push({
      range: sheetRange(sheetName, `${columnToLetter(excludedIdx + 1)}2`),
      values: [['']],
    })
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  })

  return {
    sheetId,
    sheetName,
    dryRun: false,
    before: { totalRows: Math.max(0, values.length - 1), titled, orphanIds },
    afterProductCount: idCol.length,
    preservedIds,
    preservedLinks,
    clearedThroughRow: CLEAR_TO_ROW,
    clearedExcludedDestination: excludedIdx >= 0,
    formulaCells: Object.keys(formulas),
  }
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')
  const sheets = await getSheets()

  console.log(`=== Complete Merchant Center feed fix${dryRun ? ' [DRY RUN]' : ''} ===`)
  console.log(`Public origin: ${PUBLIC_ORIGIN}`)
  console.log(`Currency: ${CURRENCY}`)

  const master = await fixMasterProducts(sheets, { dryRun })
  const feed = await fixSheet1(sheets, master, { dryRun })
  console.log('\n--- Local inventory feed ---')
  const local = await syncLocalInventoryFeed({ dryRun })

  console.log(JSON.stringify({
    dryRun,
    master: {
      productCount: master.productCount,
      updatedImages: master.updatedImages,
      ipHits: master.ipHits,
    },
    feed,
    local,
  }, null, 2))

  if (!dryRun) {
    console.log(`
Done. Sheet1 should now have ~${master.productCount} products (not 1500+).

Next:
1) Confirm column A ends after the real catalog; no PID-only empty rows.
2) Prices look like "47.99 ${CURRENCY}".
3) Merchant Center → Products → Data sources → refresh Sheet1 (primary / online).
4) Local inventory:
   - Set GOOGLE_MERCHANT_STORE_CODE in .env to your Google Business Profile store code.
   - Re-run: npm run inventory:sync-local-feed
   - Merchant Center → Data sources → Supplemental → add Google Sheet tab "Local inventory".
   - Keep Free local listings + Local inventory ads add-ons ON, and finish "Add inventory".
5) Misrepresentation: fill Business information in Merchant Center (manual).
`)
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err)
  process.exit(1)
})
