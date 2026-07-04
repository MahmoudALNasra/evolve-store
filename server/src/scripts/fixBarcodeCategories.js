/**
 * Fix categories on barcode-imported products to match store Category collection.
 *
 * Run:
 *   npm run product:fix-categories -- --dry-run --limit 5
 *   npm run product:fix-categories -- --file data/barcode-import-batch.csv
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const { normalizeBarcode } = require('../services/barcodeProductLookupService')
const { fixBarcodeProductCategories } = require('../services/barcodeCategoryFixService')

const DEFAULT_FILE = path.join(__dirname, '../../data/barcode-import-batch.csv')

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    dryRun: false,
    limit: 0,
    all: false,
    forceOpenAi: false,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--all') args.all = true
    else if (arg === '--force-openai') args.forceOpenAi = true
    else if (arg === '--limit') args.limit = Number(argv[++i]) || 0
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
  let barcodes = []

  if (fs.existsSync(args.file)) {
    barcodes = loadBarcodesFromCsv(args.file)
  }

  await mongoose.connect(process.env.MONGO_URI)
  console.log(`Category fix${args.dryRun ? ' [DRY RUN]' : ''}`)
  if (barcodes.length) console.log(`Barcodes: ${barcodes.length}`)
  console.log('MongoDB connected\n')

  const result = await fixBarcodeProductCategories({
    barcodes: barcodes.length ? barcodes : undefined,
    dryRun: args.dryRun,
    limit: args.limit,
    onlyPublished: !args.all,
    forceOpenAi: args.forceOpenAi,
  })

  console.log('\n--- Summary ---')
  console.log(`Scanned: ${result.scanned}`)
  console.log(`Changed: ${result.changed}`)
  console.log(`Report: ${result.reportPath}`)

  for (const row of result.report.filter((r) => r.changed).slice(0, 20)) {
    console.log(`✓ ${row.barcode} | ${row.before} → ${row.after} (${row.source})`)
  }
  const more = result.report.filter((r) => r.changed).length - 20
  if (more > 0) console.log(`… and ${more} more`)

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
