/**
 * Rewrite legacy droplet IP image hosts → https://evolvepharmacy.com
 * for Google Merchant Center verification.
 *
 * Updates:
 *  1) Master Products tab Image URLs + image (extra)
 *     (feeds IMPORTRANGE → "from MasterSheet(products)")
 *  2) Sheet1!I2 formula so image_link substitutes the IP host
 *  3) Sheet1!S2 formula for additional_image_link from column N
 *
 * Usage (droplet, from /var/www/evolve-store/server):
 *   DRY_RUN=1 npm run inventory:fix-merchant-images
 *   npm run inventory:fix-merchant-images
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
    const nextImg = primary
    const nextExtra = extra

    if (nextImg !== beforeImg || nextExtra !== beforeExtra) updated += 1
    imgCol.push([nextImg])
    extraCol.push([nextExtra])
  }

  console.log(`Master "${sheetName}": rows=${values.length - 1} ipHits=${ipHits} willUpdate=${updated}`)
  console.log(`  SITE_URL/origin used for absolute media: ${getSiteOrigin()} (expected ${PUBLIC_ORIGIN})`)

  if (dryRun || updated === 0) {
    return { sheetId, sheetName, updated, ipHits, dryRun: true }
  }

  const endRow = values.length
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        {
          range: sheetRange(sheetName, `H2:H${endRow}`),
          values: imgCol,
        },
        ...(extraIdx >= 0
          ? [{
            range: sheetRange(sheetName, `N2:N${endRow}`),
            values: extraCol,
          }]
          : []),
      ],
    },
  })

  return { sheetId, sheetName, updated, ipHits, dryRun: false }
}

async function fixSheet1Formulas(sheets, { dryRun }) {
  const sheetId = getMerchantFeedSheetId()
  const sheetName = getMerchantFeedSheetName()

  // image_link (I) + additional_image_link (S)
  const imageFormula =
    `=ARRAYFORMULA(IF('from MasterSheet(products)'!H2:H="",,SUBSTITUTE(SUBSTITUTE('from MasterSheet(products)'!H2:H,"http://${LEGACY_HOST}","${PUBLIC_ORIGIN}"),"https://${LEGACY_HOST}","${PUBLIC_ORIGIN}")))`
  const extraFormula =
    `=ARRAYFORMULA(IF('from MasterSheet(products)'!N2:N="",,SUBSTITUTE(SUBSTITUTE('from MasterSheet(products)'!N2:N,"http://${LEGACY_HOST}","${PUBLIC_ORIGIN}"),"https://${LEGACY_HOST}","${PUBLIC_ORIGIN}")))`

  console.log(`Sheet1 formulas → ${sheetId} / ${sheetName}`)
  console.log(`  I2: ${imageFormula}`)
  console.log(`  S2: ${extraFormula}`)

  if (dryRun) {
    return { sheetId, sheetName, dryRun: true }
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: sheetRange(sheetName, 'I2'), values: [[imageFormula]] },
        { range: sheetRange(sheetName, 'S2'), values: [[extraFormula]] },
      ],
    },
  })

  return { sheetId, sheetName, dryRun: false }
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')
  const sheets = await getSheets()

  console.log(`=== Fix Merchant feed image URLs${dryRun ? ' [DRY RUN]' : ''} ===`)
  console.log(`Public origin: ${PUBLIC_ORIGIN}`)

  const master = await fixMasterProducts(sheets, { dryRun })
  const feed = await fixSheet1Formulas(sheets, { dryRun })

  console.log(JSON.stringify({ dryRun, master, feed }, null, 2))
  if (!dryRun) {
    console.log('\nDone. Wait ~1–2 min for IMPORTRANGE, then in Merchant Center: request a data refresh.')
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
