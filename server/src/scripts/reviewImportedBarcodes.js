/**
 * AI review of barcode-imported products: fix names/descriptions, unpublish misfits.
 *
 * Run:
 *   npm run product:review-barcodes -- --dry-run --limit 5
 *   npm run product:review-barcodes -- --file data/barcode-import-batch.csv
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const { normalizeBarcode } = require('../services/barcodeProductLookupService')
const { reviewImportedProducts } = require('../services/barcodeProductReviewService')

const DEFAULT_FILE = path.join(__dirname, '../../data/barcode-import-batch.csv')

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    dryRun: false,
    limit: 0,
    skipResearch: false,
    onlyUnpublished: false,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--skip-research') args.skipResearch = true
    else if (arg === '--limit') args.limit = Number(argv[++i]) || 0
    else if (arg === '--only-unpublished') args.onlyUnpublished = true
    else if (arg === '--recent-days') args.recentDays = Number(argv[++i]) || 7
    else if (arg === '--file') args.file = path.resolve(argv[++i])
  }

  return args
}

function loadBarcodesFromCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const barcodes = new Set()

  for (let i = 1; i < lines.length; i += 1) {
    const barcode = normalizeBarcode(lines[i].split(',')[0])
    if (barcode) barcodes.add(barcode)
  }

  return [...barcodes]
}

async function main() {
  const args = parseArgs(process.argv)

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required in server/.env')
    process.exit(1)
  }

  let barcodes = []
  if (fs.existsSync(args.file)) {
    barcodes = loadBarcodesFromCsv(args.file)
  } else if (!args.recentDays) {
    console.error(`CSV not found: ${args.file}`)
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGO_URI)
  console.log(`Barcode review${args.dryRun ? ' [DRY RUN]' : ''}`)
  if (barcodes.length) console.log(`Barcodes from CSV: ${barcodes.length}`)
  console.log('MongoDB connected\n')

  const result = await reviewImportedProducts({
    barcodes: barcodes.length ? barcodes : undefined,
    recentDays: barcodes.length ? 0 : args.recentDays || 14,
    dryRun: args.dryRun,
    limit: args.limit,
    skipResearch: args.skipResearch,
    onlyUnpublished: args.onlyUnpublished,
  })

  console.log('\n--- Summary ---')
  console.log(`Scanned: ${result.scanned}`)
  console.log(`Updated (kept published): ${result.updated}`)
  console.log(`Unpublished (not a fit): ${result.unpublished}`)
  if (result.skipped) console.log(`Errors: ${result.skipped}`)
  console.log(`Report: ${result.reportPath}`)

  for (const row of result.report.slice(0, 15)) {
    if (row.action === 'error') {
      console.log(`✗ ${row.barcode} — ${row.error}`)
    } else if (row.action === 'unpublished') {
      console.log(`⊘ ${row.barcode} — UNPUBLISH — ${row.reason}`)
    } else {
      console.log(`✓ ${row.barcode} — ${row.after?.name || row.before?.name}`)
    }
  }
  if (result.report.length > 15) {
    console.log(`… and ${result.report.length - 15} more in report`)
  }

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
