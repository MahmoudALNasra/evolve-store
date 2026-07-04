/**
 * Import products from a CSV of barcode,stock,price.
 * Looks up product name/images via Open Food Facts + Serper, then creates or updates catalog items.
 *
 * Run:
 *   npm run product:import-barcodes -- --dry-run --limit 5
 *   npm run product:import-barcodes -- --file data/barcode-import-batch.csv
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const Product = require('../models/Product')
const Category = require('../models/Category')
const { lookupBarcodeProduct, normalizeBarcode } = require('../services/barcodeProductLookupService')
const { saveProductImageFromUrl } = require('../services/localMediaStorageService')
const { generateUniqueSlug } = require('../utils/productSlug')
const applyAutoTagsToPayload = require('../utils/applyProductTags')

const DEFAULT_FILE = path.join(__dirname, '../../data/barcode-import-batch.csv')
const LOOKUP_DELAY_MS = Number(process.env.BARCODE_LOOKUP_DELAY_MS || 500)

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    dryRun: false,
    limit: 0,
    publish: true,
    taxable: true,
    skipImages: false,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--skip-images') args.skipImages = true
    else if (arg === '--no-publish') args.publish = false
    else if (arg === '--limit') args.limit = Number(argv[++i]) || 0
    else if (arg === '--file') args.file = path.resolve(argv[++i])
  }

  return args
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const rows = []
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(',').map((p) => p.trim())
    if (parts.length < 3) continue
    const barcode = normalizeBarcode(parts[0])
    const stock = Number(parts[1])
    const price = Number(parts[2])
    if (!barcode || !Number.isFinite(stock) || !Number.isFinite(price)) continue
    rows.push({ barcode, stock, price })
  }

  return mergeDuplicateBarcodes(rows)
}

function mergeDuplicateBarcodes(rows) {
  const map = new Map()

  for (const row of rows) {
    const existing = map.get(row.barcode)
    if (!existing) {
      map.set(row.barcode, { ...row, mergedCount: 1 })
      continue
    }

    existing.stock += row.stock
    existing.price = row.price
    existing.mergedCount += 1
  }

  return [...map.values()]
}

async function ensureCategory(name) {
  const category = String(name || 'Uncategorized').trim() || 'Uncategorized'
  await Category.updateOne(
    { name: { $regex: `^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
    { $setOnInsert: { name: category, description: '' } },
    { upsert: true }
  )
  return category
}

async function saveImagesForProduct(slug, imageUrls, max = 3) {
  const saved = []
  const urls = [...new Set(imageUrls)].slice(0, max)

  for (let i = 0; i < urls.length; i += 1) {
    try {
      const result = await saveProductImageFromUrl(slug, urls[i], {
        index: i,
        source: 'serper',
      })
      saved.push({ url: result.url, source: result.source })
    } catch {
      /* try next */
    }
  }

  return saved
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function importRow(row, args, stats) {
  const existing = await Product.findOne({ barcode: row.barcode })

  if (existing) {
    stats.existing += 1
    if (args.dryRun) {
      console.log(`[dry-run] UPDATE ${row.barcode} → ${existing.name} | stock ${existing.stock}→${row.stock} price ${existing.price}→${row.price}`)
      return
    }

    existing.stock = row.stock
    existing.price = row.price
    if (args.taxable) existing.isTaxable = true
    await existing.save()
    stats.updated += 1
    console.log(`✓ Updated ${row.barcode} — ${existing.name}`)
    return
  }

  const lookup = await lookupBarcodeProduct(row.barcode, { delayMs: LOOKUP_DELAY_MS })
  stats.bySource[lookup.source] = (stats.bySource[lookup.source] || 0) + 1

  const category = await ensureCategory(lookup.category)
  const payload = {
    name: lookup.name,
    brand: lookup.brand || '',
    description: lookup.description || '',
    category,
    barcode: row.barcode,
    price: row.price,
    comparePrice: 0,
    stock: row.stock,
    isPublished: args.publish,
    isFeatured: false,
    isTaxable: args.taxable,
    images: [],
  }

  applyAutoTagsToPayload(payload)

  if (args.dryRun) {
    console.log(`[dry-run] CREATE ${row.barcode} | ${payload.name} | $${payload.price} | stock ${payload.stock} | ${lookup.source}`)
    stats.created += 1
    return
  }

  const slug = await generateUniqueSlug(Product, payload.name)
  payload.slug = slug

  if (!args.skipImages && lookup.images?.length) {
    payload.images = await saveImagesForProduct(slug, lookup.images, 3)
  }

  const product = await Product.create(payload)
  stats.created += 1
  console.log(`+ Created ${row.barcode} — ${product.name} (${lookup.source}, ${product.images.length} img)`)
}

async function main() {
  const args = parseArgs(process.argv)
  const filePath = args.file

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'))
  const toProcess = args.limit > 0 ? rows.slice(0, args.limit) : rows

  console.log(`Barcode import — ${toProcess.length} item(s) from ${path.basename(filePath)}${args.dryRun ? ' [DRY RUN]' : ''}`)
  if (!process.env.SERPER_API_KEY) {
    console.warn('Warning: SERPER_API_KEY not set — lookup will use Open Food Facts + fallback names only.')
  }

  await mongoose.connect(process.env.MONGO_URI)
  console.log('MongoDB connected\n')

  const stats = {
    created: 0,
    updated: 0,
    existing: 0,
    bySource: {},
  }

  for (let i = 0; i < toProcess.length; i += 1) {
    const row = toProcess[i]
    if (row.mergedCount > 1) {
      console.log(`Note: merged ${row.mergedCount} rows for barcode ${row.barcode} (stock summed, last price used)`)
    }

    try {
      await importRow(row, args, stats)
    } catch (err) {
      console.error(`✗ Failed ${row.barcode}:`, err.message)
      stats.failed = (stats.failed || 0) + 1
    }

    if (i < toProcess.length - 1) await sleep(LOOKUP_DELAY_MS)
  }

  console.log('\n--- Summary ---')
  console.log(`Created: ${stats.created}`)
  console.log(`Updated: ${stats.updated}`)
  console.log(`Lookup sources:`, stats.bySource)
  if (stats.failed) console.log(`Failed: ${stats.failed}`)

  await mongoose.disconnect()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
