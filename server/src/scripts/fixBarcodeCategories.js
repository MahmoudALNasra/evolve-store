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
const { fixBarcodeProductCategories, fixAllProductCategories, auditProductCategories } = require('../services/barcodeCategoryFixService')

const DEFAULT_FILE = path.join(__dirname, '../../data/barcode-import-batch.csv')

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    dryRun: false,
    limit: 0,
    all: false,
    allPublished: false,
    onlyUnresolved: false,
    forceOpenAi: false,
    auditOnly: false,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--all') args.all = true
    else if (arg === '--all-published') args.allPublished = true
    else if (arg === '--only-unresolved') args.onlyUnresolved = true
    else if (arg === '--audit') args.auditOnly = true
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

  if (!args.allPublished && !args.onlyUnresolved && fs.existsSync(args.file)) {
    barcodes = loadBarcodesFromCsv(args.file)
  }

  await mongoose.connect(process.env.MONGO_URI)

  if (args.auditOnly) {
    const audit = await auditProductCategories({ onlyPublished: !args.all })
    console.log(JSON.stringify(audit, null, 2))
    await mongoose.disconnect()
    process.exit(0)
  }

  console.log(`Category fix${args.dryRun ? ' [DRY RUN]' : ''}`)
  if (args.allPublished || args.onlyUnresolved) {
    console.log('Scope: all published products needing a category')
  } else if (barcodes.length) {
    console.log(`Barcodes: ${barcodes.length}`)
  } else {
    console.log('Scope: all published products')
  }
  console.log('MongoDB connected\n')

  const result = args.allPublished
    ? await fixAllProductCategories({
      dryRun: args.dryRun,
      limit: args.limit || 25,
      onlyPublished: !args.all,
      forceOpenAi: args.forceOpenAi,
    })
    : await fixBarcodeProductCategories({
      barcodes: barcodes.length ? barcodes : undefined,
      dryRun: args.dryRun,
      limit: args.limit,
      onlyPublished: !args.all,
      onlyNeedsCategory: args.onlyUnresolved,
      forceOpenAi: args.forceOpenAi,
    })

  console.log('\n--- Summary ---')
  console.log(JSON.stringify({
    scanned: result.scanned,
    changed: result.changed,
    batches: result.batches,
    dryRun: result.dryRun,
    reportPath: result.reportPath || result.reportPaths?.[result.reportPaths.length - 1],
  }, null, 2))

  if (Array.isArray(result.report)) {
    for (const row of result.report.filter((r) => r.changed).slice(0, 20)) {
      console.log(`✓ ${row.barcode} | ${row.before} → ${row.after} (${row.source})`)
    }
    const more = result.report.filter((r) => r.changed).length - 20
    if (more > 0) console.log(`… and ${more} more`)
  } else if (result.changed === 0 && result.scanned === 0) {
    console.log('Nothing to do — all published products already have valid categories.')
  }

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
