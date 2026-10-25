/**
 * Fix Google Merchant Center Sheet1 feed issues:
 *  - image_link / additional_image_link → https://evolvepharmacy.com (not droplet IP)
 *  - price → "12.99 USD" (fixes missing price + invalid currency)
 *  - title → max 150 chars
 *  - excluded_destination → Free_local_listings,Local_inventory_ads
 *    (until a real local inventory feed is set up)
 *  - master Products Image URLs / image (extra) host rewrite
 *
 * Usage (droplet, from /var/www/evolve-store/server):
 *   DRY_RUN=1 npm run inventory:fix-merchant-images
 *   npm run inventory:fix-merchant-images
 *
 * Requires SITE_URL=https://evolvepharmacy.com in .env
 */
require('dotenv').config()
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

const LEGACY_HOST = '138.197.107.137'
const PUBLIC_ORIGIN = (process.env.SITE_URL || process.env.PUBLIC_MEDIA_URL || 'https://evolvepharmacy.com')
  .replace(/\/$/, '')
const CURRENCY = process.env.GOOGLE_MERCHANT_CURRENCY || 'USD'
const TITLE_MAX = 150
const EXCLUDED_DESTINATIONS = 'Free_local_listings,Local_inventory_ads'

function preferSafePrimary(primary, extra) {
  const urls = [
    ...String(primary || '').split(','),
    ...String(extra || '').split(','),
  ]
    .map((u) => rewritePublicMediaHost(u.trim()))
    .filter(Boolean)

  const safe = urls.find(isMerchantSafeImageUrl)
  if (!safe) return { primary: urls[0] || '', extra: urls.slice(1).join(', ') }
  const rest = urls.filter((u) => u !== safe)
  return { primary: safe, extra: rest.join(', ') }
}

async function getSheets() {
  const auth = await getGoogleAuthClient()
  return google.sheets({ version: 'v4', auth })
}

async function fixMasterProducts(sheets, { dryRun }) {
  const sheetId = getStockSheetId()
  const sheetName = getStockSheetName()
  const range = sheetRange(sheetName, 'A:O')

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  })
  const values = res.data.values || []
  if (values.length < 2) {
    return { sheetId, sheetName, updated: 0, skipped: true, reason: 'no rows' }
  }

  const headers = values[0].map((h) => String(h || '').trim())
  const imgIdx = headers.indexOf('Image URLs')
  const extraIdx = headers.indexOf('image (extra)')
  if (imgIdx < 0) {
    throw new Error(`Master sheet missing "Image URLs" column (headers: ${headers.join(', ')})`)
  }

  let updated = 0
  let ipHits = 0
  const imgCol = []
  const extraCol = []

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || []
    const beforeImg = String(row[imgIdx] || '')
    const beforeExtra = extraIdx >= 0 ? String(row[extraIdx] || '') : ''
    if (beforeImg.includes(LEGACY_HOST) || beforeExtra.includes(LEGACY_HOST)) ipHits += 1

    const { primary, extra } = preferSafePrimary(beforeImg, beforeExtra)
    if (primary !== beforeImg || extra !== beforeExtra) updated += 1
    imgCol.push([primary])
    extraCol.push([extra])
  }

  console.log(`Master "${sheetName}": rows=${values.length - 1} ipHits=${ipHits} willUpdate=${updated}`)
  console.log(`  Absolute media origin: ${getSiteOrigin()} (expected ${PUBLIC_ORIGIN})`)

  if (dryRun || updated === 0) {
    return { sheetId, sheetName, updated, ipHits, dryRun: true }
  }

  const endRow = values.length
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: sheetRange(sheetName, `H2:H${endRow}`), values: imgCol },
        ...(extraIdx >= 0
          ? [{ range: sheetRange(sheetName, `N2:N${endRow}`), values: extraCol }]
          : []),
      ],
    },
  })

  return { sheetId, sheetName, updated, ipHits, dryRun: false }
}

function buildSheet1Formulas() {
  // Prefer Price (Local) column L; fall back to price (API) column G.
  const priceFormula =
    `=ARRAYFORMULA(IF('from MasterSheet(products)'!B2:B="",,` +
    `IF(IFERROR(VALUE('from MasterSheet(products)'!L2:L),0)>0,` +
    `TEXT(VALUE('from MasterSheet(products)'!L2:L),"0.00")&" ${CURRENCY}",` +
    `IF(IFERROR(VALUE('from MasterSheet(products)'!G2:G),0)>0,` +
    `TEXT(VALUE('from MasterSheet(products)'!G2:G),"0.00")&" ${CURRENCY}",` +
    `))))`

  const titleFormula =
    `=ARRAYFORMULA(IF('from MasterSheet(products)'!B2:B="",,LEFT('from MasterSheet(products)'!B2:B,${TITLE_MAX})))`

  const imageFormula =
    `=ARRAYFORMULA(IF('from MasterSheet(products)'!H2:H="",,` +
    `SUBSTITUTE(SUBSTITUTE('from MasterSheet(products)'!H2:H,` +
    `"http://${LEGACY_HOST}","${PUBLIC_ORIGIN}"),` +
    `"https://${LEGACY_HOST}","${PUBLIC_ORIGIN}")))`

  const extraImageFormula =
    `=ARRAYFORMULA(IF('from MasterSheet(products)'!N2:N="",,` +
    `SUBSTITUTE(SUBSTITUTE('from MasterSheet(products)'!N2:N,` +
    `"http://${LEGACY_HOST}","${PUBLIC_ORIGIN}"),` +
    `"https://${LEGACY_HOST}","${PUBLIC_ORIGIN}")))`

  // Fill excluded destination for every product row that has a title.
  const excludedFormula =
    `=ARRAYFORMULA(IF('from MasterSheet(products)'!B2:B="",,"${EXCLUDED_DESTINATIONS}"))`

  return {
    titleFormula,
    priceFormula,
    imageFormula,
    extraImageFormula,
    excludedFormula,
  }
}

async function ensureExcludedDestinationColumn(sheets, sheetId, sheetName) {
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: sheetRange(sheetName, '1:1'),
  })
  const headers = (headerRes.data.values?.[0] || []).map((h) => String(h || '').trim())
  const existingIdx = headers.findIndex((h) => /^excluded\s*destination$/i.test(h))
  if (existingIdx >= 0) {
    return { colIndex: existingIdx, colLetter: columnToLetter(existingIdx + 1), created: false }
  }

  // Append after last used header column.
  const nextIndex = headers.length
  const colLetter = columnToLetter(nextIndex + 1)
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: sheetRange(sheetName, `${colLetter}1`),
    valueInputOption: 'RAW',
    requestBody: { values: [['excluded destination']] },
  })
  return { colIndex: nextIndex, colLetter, created: true }
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

async function fixSheet1Formulas(sheets, { dryRun }) {
  const sheetId = getMerchantFeedSheetId()
  const sheetName = getMerchantFeedSheetName()
  const formulas = buildSheet1Formulas()

  let excludedCol = { colLetter: 'AM', created: false }
  if (!dryRun) {
    excludedCol = await ensureExcludedDestinationColumn(sheets, sheetId, sheetName)
  }

  const updates = [
    { cell: 'B2', label: 'title (≤150)', formula: formulas.titleFormula },
    { cell: 'J2', label: 'price + USD', formula: formulas.priceFormula },
    { cell: 'I2', label: 'image link host', formula: formulas.imageFormula },
    { cell: 'S2', label: 'additional image link', formula: formulas.extraImageFormula },
    {
      cell: `${excludedCol.colLetter}2`,
      label: 'excluded destination',
      formula: formulas.excludedFormula,
    },
  ]

  console.log(`Sheet1 formulas → ${sheetId} / ${sheetName}`)
  updates.forEach((u) => console.log(`  ${u.cell} (${u.label}): ${u.formula}`))

  if (dryRun) {
    return { sheetId, sheetName, dryRun: true, updates: updates.map((u) => u.cell) }
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates.map((u) => ({
        range: sheetRange(sheetName, u.cell),
        values: [[u.formula]],
      })),
    },
  })

  return {
    sheetId,
    sheetName,
    dryRun: false,
    excludedColumn: excludedCol.colLetter,
    excludedColumnCreated: excludedCol.created,
    updates: updates.map((u) => u.cell),
  }
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')
  const sheets = await getSheets()

  console.log(`=== Fix Merchant Center feed${dryRun ? ' [DRY RUN]' : ''} ===`)
  console.log(`Public origin: ${PUBLIC_ORIGIN}`)
  console.log(`Currency: ${CURRENCY}`)

  const master = await fixMasterProducts(sheets, { dryRun })
  const feed = await fixSheet1Formulas(sheets, { dryRun })

  console.log(JSON.stringify({ dryRun, master, feed }, null, 2))
  if (!dryRun) {
    console.log(`
Done. Next:
1) Wait 1–2 minutes for sheet formulas / IMPORTRANGE.
2) In Merchant Center → Products → Data sources → refresh the Sheet1 source.
3) Confirm price looks like "47.99 ${CURRENCY}" and titles ≤ ${TITLE_MAX} chars.
4) For "Missing local inventory": either keep excluded destinations (already set),
   OR in Merchant Center → Add-ons turn OFF Free local listings / Local inventory ads
   until you upload a local inventory feed with store_code.
5) Misrepresentation review is manual — fill Business information in Merchant Center
   and keep About / Contact / Policies pages clear on evolvepharmacy.com.
`)
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
