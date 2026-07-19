/**
 * Website DB → Google Sheets Products tab (full refresh).
 *
 * Order:
 *   1) SEO/GEO/AEO quality audit + optimize failing products (all DB products)
 *   2) stock 1 → 2 in website DB
 *   3) backup + replace Products tab A:O from website DB
 *   4) read-back verification
 *
 * Run (from server/):
 *   npm run inventory:sync-db-to-sheet -- --dry-run
 *   npm run inventory:sync-db-to-sheet
 *   npm run inventory:sync-db-to-sheet -- --skip-optimize
 */
require('dotenv').config()
const connectDB = require('../config/db')
const {
  auditDescriptionQuality,
  optimizeAllProducts,
} = require('../services/productDescriptionOptimizationService')
const { shouldFixProductName } = require('../utils/productNameQuality')
const { normalizeStockOneToTwo } = require('../services/stockNormalizationService')
const { replaceWebsiteCatalogOnMasterSheet } = require('../services/websiteToMasterSheetSyncService')
const Product = require('../models/Product')

function parseArgs(argv) {
  const args = {
    dryRun: false,
    skipOptimize: false,
    skipStock: false,
    skipSheet: false,
    forceOptimize: false,
    publishedOnly: false,
    limit: 50,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--skip-optimize') args.skipOptimize = true
    else if (arg === '--skip-stock') args.skipStock = true
    else if (arg === '--skip-sheet') args.skipSheet = true
    else if (arg === '--force-optimize') args.forceOptimize = true
    else if (arg === '--published-only') args.publishedOnly = true
    else if (arg === '--limit') args.limit = Number(argv[++i]) || 50
  }

  return args
}

async function countNeedsWork(includeUnpublished) {
  const { needsDescriptionOptimization } = require('../utils/productDescriptionQuality')
  const filter = includeUnpublished ? {} : { isPublished: true }
  const products = await Product.find(filter)
    .select('name description seoMetaDescription seoFaqs')
    .lean()

  const descAudit = await auditDescriptionQuality({ includeUnpublished })
  let badTitles = 0
  let needsWork = 0

  for (const product of products) {
    const needsDesc = needsDescriptionOptimization(product)
    const needsTitle = shouldFixProductName(product.name)
    if (needsTitle) badTitles += 1
    if (needsDesc || needsTitle) needsWork += 1
  }

  return {
    total: products.length,
    descriptionsNeedWork: descAudit.needsWork,
    badTitles,
    needsWork,
    descAudit,
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const includeUnpublished = !args.publishedOnly

  await connectDB()

  console.log('=== Website DB → Products sheet ===')
  console.log(JSON.stringify({
    dryRun: args.dryRun,
    includeUnpublished,
    skipOptimize: args.skipOptimize,
    skipStock: args.skipStock,
    skipSheet: args.skipSheet,
  }, null, 2))

  const report = {
    dryRun: args.dryRun,
    quality: null,
    optimize: null,
    stock: null,
    sheet: null,
  }

  // 1) Quality gate
  const before = await countNeedsWork(includeUnpublished)
  console.log('\n--- Quality (before) ---')
  console.log(JSON.stringify(before, null, 2))
  report.quality = { before }

  if (!args.skipOptimize && (before.needsWork > 0 || args.forceOptimize)) {
    if (!process.env.OPENAI_API_KEY || !process.env.SERPER_API_KEY) {
      console.error('OPENAI_API_KEY and SERPER_API_KEY are required to optimize products')
      process.exit(1)
    }

    console.log('\n--- Optimizing failing names/descriptions (all DB products) ---')
    report.optimize = await optimizeAllProducts({
      onlyNeedsWork: !args.forceOptimize,
      all: true,
      includeUnpublished,
      dryRun: args.dryRun,
      limit: args.limit,
    })
    console.log(JSON.stringify(report.optimize, null, 2))
  } else if (args.skipOptimize) {
    console.log('\n--- Skipping optimization (--skip-optimize) ---')
  } else {
    console.log('\n--- Quality gate passed (nothing to optimize) ---')
  }

  const after = await countNeedsWork(includeUnpublished)
  report.quality.after = after
  console.log('\n--- Quality (after) ---')
  console.log(JSON.stringify(after, null, 2))

  if (!args.dryRun && !args.skipOptimize && after.descAudit.needsWork > 0) {
    console.error(`\nBlocked sheet sync: ${after.descAudit.needsWork} products still need description/SEO work.`)
    process.exit(1)
  }

  // 2) Stock normalize 1 → 2
  if (!args.skipStock) {
    console.log('\n--- Stock normalize: 1 → 2 ---')
    report.stock = await normalizeStockOneToTwo({ dryRun: args.dryRun })
    console.log(JSON.stringify(report.stock, null, 2))
  } else {
    console.log('\n--- Skipping stock normalize (--skip-stock) ---')
  }

  // 3) Full sheet replace
  if (!args.skipSheet) {
    console.log('\n--- Replace Products tab from website DB ---')
    report.sheet = await replaceWebsiteCatalogOnMasterSheet({
      dryRun: args.dryRun,
      includeUnpublished,
    })
    console.log(JSON.stringify({
      dryRun: report.sheet.dryRun,
      sheetId: report.sheet.sheetId,
      sheetName: report.sheet.sheetName,
      productCount: report.sheet.productCount,
      matrixRows: report.sheet.matrixRows,
      backup: report.sheet.backup,
      write: report.sheet.write,
      verification: report.sheet.verification,
      reportPath: report.sheet.reportPath,
      preview: report.sheet.preview,
    }, null, 2))

    if (!args.dryRun && report.sheet.verification?.warnings?.length) {
      console.warn('\nSheet verification warnings (non-blocking):')
      console.warn(report.sheet.verification.warnings)
    }

    if (!args.dryRun && report.sheet.verification && !report.sheet.verification.ok) {
      console.error('\nSheet verification failed:')
      console.error(report.sheet.verification.issues)
      process.exit(1)
    }
  } else {
    console.log('\n--- Skipping sheet replace (--skip-sheet) ---')
  }

  console.log('\n=== Done ===')
  console.log(JSON.stringify({
    dryRun: args.dryRun,
    qualityNeedsWorkAfter: after.descAudit.needsWork,
    badTitlesAfter: after.badTitles,
    stockUpdated: report.stock?.updated ?? null,
    sheetProducts: report.sheet?.productCount ?? null,
    verificationOk: report.sheet?.verification?.ok ?? null,
  }, null, 2))

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
