/**
 * One-off golden product sheet import — rebuild catalog from a local TSV export.
 *
 *   npm run inventory:import-golden-sheet -- --dry-run --limit 10
 *   npm run inventory:import-golden-sheet
 *   npm run inventory:import-golden-sheet -- --enrich-images
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const connectDB = require('../config/db')
const Product = require('../models/Product')
const Category = require('../models/Category')
const { parseGoldenSheetTsv } = require('../utils/parseGoldenSheetTsv')
const {
  mapSheetRowToWebsiteProduct,
  websitePayloadToProductDocument,
  parseMoney,
  resolvePricing,
} = require('../utils/inventoryMapper')
const {
  isValidSheetProductName,
  dedupeSheetEntries,
  cleanText,
  isValidBarcode,
} = require('../utils/inventoryProductIdentity')
const { findExistingProduct, cleanId } = require('../utils/productMatch')
const { generateUniqueSlug } = require('../utils/productSlug')
const { normalizeBarcode, lookupBarcodeProduct } = require('../services/barcodeProductLookupService')
const { auditProductImages } = require('../services/productImageAuditService')
const {
  enrichProductImages,
  mirrorProductImagesToLocal,
} = require('../services/productImageEnrichmentService')
const { isPlaceholderImageUrl } = require('../utils/productImageUtils')

const DEFAULT_FILE = path.join(__dirname, '../../data/golden-product-sheet.tsv')
const LOOKUP_DELAY_MS = Number(process.env.BARCODE_LOOKUP_DELAY_MS || 500)

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    dryRun: false,
    limit: 0,
    enrichImages: false,
    skipImages: false,
    skipUnpublish: false,
    skipDedupe: false,
    imagesOnly: false,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--enrich-images') args.enrichImages = true
    else if (arg === '--skip-images') args.skipImages = true
    else if (arg === '--skip-unpublish') args.skipUnpublish = true
    else if (arg === '--skip-dedupe') args.skipDedupe = true
    else if (arg === '--images-only') args.imagesOnly = true
    else if (arg === '--limit') args.limit = Number(argv[++i]) || 0
    else if (arg === '--file') args.file = path.resolve(argv[++i])
  }

  return args
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function splitSheetImageUrls(row) {
  const raw = [
    row['Image URLs'],
    row['image (extra)'],
  ].filter(Boolean).join(', ')

  return raw
    .split(',')
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url) && !isPlaceholderImageUrl(url) && url !== '#REF!')
}

function isBarcodeOnlyRow(row) {
  const barcode = cleanText(row.Barcode)
  const name = cleanText(row.Name)
  const hasName = isValidSheetProductName(name, barcode)
  const pricing = resolvePricing(row)
  const hasPrice = pricing.price > 0
  const hasDesc = cleanText(row['Desc.']).length > 10
  const hasImages = splitSheetImageUrls(row).length > 0

  return Boolean(barcode) && !hasName && !hasPrice && !hasDesc && !hasImages
}

async function ensureCategoryExists(category) {
  const name = cleanText(category) || 'Uncategorized'
  await Category.updateOne(
    { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
    { $setOnInsert: { name, description: '' } },
    { upsert: true }
  )
  return name
}

async function buildWebsitePayload(row, existing) {
  const barcode = normalizeBarcode(row.Barcode)
  if (!barcode) return null

  if (isBarcodeOnlyRow(row)) {
    await sleep(LOOKUP_DELAY_MS)
    const lookup = await lookupBarcodeProduct(barcode, { delayMs: 0 })
    const pricing = resolvePricing(row)
    const price = pricing.price > 0 ? pricing.price : Number(existing?.price || 0)

    return {
      mode: 'barcode-only',
      websitePayload: {
        name: lookup.name,
        description: lookup.description || '',
        brand: lookup.brand || '',
        category: lookup.category || 'Health & Wellness',
        barcode,
        sku: cleanText(row.MPN) || undefined,
        price,
        comparePrice: 0,
        stock: 1,
        isPublished: true,
        isFeatured: false,
        imageUrls: (lookup.images || []).join(', '),
        tags: lookup.brand || '',
        ingredients: '',
        moreInfo: '',
      },
      sheetImageUrls: lookup.images || [],
    }
  }

  const websitePayload = mapSheetRowToWebsiteProduct(row)
  websitePayload.barcode = barcode

  if (!websitePayload.price && existing?.price) {
    websitePayload.price = existing.price
  }
  if (!websitePayload.description && existing?.description) {
    websitePayload.description = existing.description
  }
  if (!websitePayload.name && existing?.name) {
    websitePayload.name = existing.name
  }

  if (!isValidSheetProductName(websitePayload.name, barcode)) {
    await sleep(LOOKUP_DELAY_MS)
    const lookup = await lookupBarcodeProduct(barcode, { delayMs: 0 })
    websitePayload.name = lookup.name
    if (!websitePayload.description) websitePayload.description = lookup.description || ''
    if (!websitePayload.brand) websitePayload.brand = lookup.brand || ''
    if (!websitePayload.imageUrls && lookup.images?.length) {
      websitePayload.imageUrls = lookup.images.join(', ')
    }
  }

  if (Number(websitePayload.stock) > 0) {
    websitePayload.isPublished = true
  }

  return {
    mode: 'sheet',
    websitePayload,
    sheetImageUrls: splitSheetImageUrls(row),
  }
}

async function upsertGoldenProduct(websitePayload, dryRun) {
  const productPayload = websitePayloadToProductDocument(websitePayload)
  delete productPayload.imageUrls

  await ensureCategoryExists(productPayload.category)

  const existing = await findExistingProduct(productPayload)

  if (!existing) {
    if (dryRun) {
      return { created: true, product: { name: productPayload.name, barcode: productPayload.barcode } }
    }
    productPayload.slug = await generateUniqueSlug(Product, productPayload.name)
    const created = await Product.create(productPayload)
    return { created: true, product: created }
  }

  if (dryRun) {
    return { created: false, product: existing }
  }

  if (!existing.slug) {
    productPayload.slug = await generateUniqueSlug(Product, productPayload.name, { excludeId: existing._id })
  }

  // Preserve admin-controlled flags on existing products
  delete productPayload.isPublished
  delete productPayload.isFeatured
  delete productPayload.isTaxable

  Object.assign(existing, productPayload)
  await existing.save()
  return { created: false, product: existing }
}

async function fixProductImages(product, sheetImageUrls, args) {
  if (args.skipImages || args.dryRun) {
    return { skipped: true, afterCount: product.images?.length || 0 }
  }

  const audit = await auditProductImages(product, {
    replacementUrls: sheetImageUrls,
    maxImages: 5,
    save: true,
  })

  if (audit.afterCount > 0) {
    const mirrored = await mirrorProductImagesToLocal(product, {
      dryRun: false,
      save: true,
      maxImages: 5,
    })

    if (args.enrichImages) {
      try {
        const enriched = await enrichProductImages(product, { dryRun: false, force: false, save: true })
        return {
          ...audit,
          mirror: mirrored.status,
          enriched: enriched.status,
          afterCount: enriched.afterCount,
        }
      } catch (err) {
        return { ...audit, mirror: mirrored.status, enrichError: err.message, afterCount: mirrored.afterCount }
      }
    }

    return { ...audit, mirror: mirrored.status, afterCount: mirrored.afterCount || audit.afterCount }
  }

  if (args.enrichImages) {
    try {
      const enriched = await enrichProductImages(product, { dryRun: false, force: true, save: true })
      return { ...audit, enriched: enriched.status, afterCount: enriched.afterCount }
    } catch (err) {
      return { ...audit, enrichError: err.message }
    }
  }

  if (audit.afterCount === 0) {
    product.isPublished = false
    await product.save()
  }

  return audit
}

async function dedupeBarcodeGroups(dryRun) {
  const products = await Product.find({ barcode: { $nin: ['', null] } }).lean()
  const groups = new Map()
  let removed = 0

  for (const product of products) {
    const barcode = cleanId(product.barcode)
    if (!groups.has(barcode)) groups.set(barcode, [])
    groups.get(barcode).push(product)
  }

  for (const [, group] of groups) {
    if (group.length <= 1) continue
    const ranked = group.sort((a, b) => {
      const score = (p) => {
        let s = 0
        if (isValidSheetProductName(p.name, p.barcode)) s += 100
        if (p.description?.length > 20) s += 20
        s += (p.images?.length || 0) * 10
        if (p.isPublished) s += 5
        return s
      }
      return score(b) - score(a)
    })

    for (let i = 1; i < ranked.length; i += 1) {
      removed += 1
      if (!dryRun) {
        await Product.deleteOne({ _id: ranked[i]._id })
      }
    }
  }

  return removed
}

async function unpublishOrphans(validBarcodes, dryRun) {
  const products = await Product.find({ isPublished: true }).select('name barcode sku')
  let count = 0

  for (const product of products) {
    const barcode = cleanId(product.barcode)
    if (barcode && validBarcodes.has(barcode)) continue

    count += 1
    if (!dryRun) {
      await Product.updateOne({ _id: product._id }, { $set: { isPublished: false } })
    }
  }

  return count
}

async function cleanupInvalidBarcodeProducts(dryRun) {
  const products = await Product.find({ barcode: { $nin: ['', null] } }).select('_id barcode name')
  let removed = 0

  for (const product of products) {
    if (isValidBarcode(product.barcode)) continue
    removed += 1
    if (!dryRun) {
      await Product.deleteOne({ _id: product._id })
    }
  }

  return removed
}

function buildSheetImageMap(rows) {
  const byBarcode = new Map()

  for (const row of rows) {
    const barcode = normalizeBarcode(row.Barcode)
    if (!barcode || !isValidBarcode(barcode)) continue

    const urls = splitSheetImageUrls(row)
    const existing = byBarcode.get(barcode) || { row, urls: [] }
    if (urls.length > existing.urls.length) {
      existing.urls = urls
      existing.row = row
    }
    byBarcode.set(barcode, existing)
  }

  return byBarcode
}

async function runImagesOnlyPass(rows, args) {
  const limitedRows = args.limit > 0 ? rows.slice(0, args.limit) : rows
  const imageMap = buildSheetImageMap(limitedRows)
  const stats = {
    dryRun: args.dryRun,
    mode: 'images-only',
    barcodes: imageMap.size,
    audited: 0,
    withImages: 0,
    unpublishedNoImages: 0,
    enriched: 0,
    missingProduct: 0,
    errors: [],
  }

  for (const [barcode, { urls }] of imageMap) {
    try {
      const product = await Product.findOne({ barcode })
      if (!product) {
        stats.missingProduct += 1
        continue
      }

      args.skipImages = false
      const imageResult = await fixProductImages(product, urls, args)
      stats.audited += 1
      if (imageResult.afterCount > 0) stats.withImages += 1
      else if (!product.isPublished) stats.unpublishedNoImages += 1
      if (imageResult.enriched) stats.enriched += 1

      console.log(`IMAGES ${barcode} | ${product.name?.slice(0, 50)} | ${imageResult.afterCount || 0} imgs | pub=${product.isPublished}`)
    } catch (err) {
      stats.errors.push({ barcode, error: err.message })
    }
  }

  return stats
}

async function main() {
  const args = parseArgs(process.argv)
  if (!fs.existsSync(args.file)) {
    console.error(`File not found: ${args.file}`)
    process.exit(1)
  }

  await connectDB()

  const rows = parseGoldenSheetTsv(fs.readFileSync(args.file, 'utf8'))

  if (args.imagesOnly) {
    const stats = await runImagesOnlyPass(rows, args)
    console.log('\n--- Golden sheet images-only summary ---')
    console.log(JSON.stringify(stats, null, 2))
    process.exit(stats.errors.length > 0 ? 1 : 0)
  }

  const limitedRows = args.limit > 0 ? rows.slice(0, args.limit) : rows

  const entries = []
  for (const row of limitedRows) {
    const barcode = normalizeBarcode(row.Barcode)
    if (!barcode || !isValidBarcode(barcode)) continue

    const existing = await Product.findOne({ barcode })
    const built = await buildWebsitePayload(row, existing)
    if (!built) continue

    entries.push({
      row,
      ...built,
    })
  }

  const deduped = dedupeSheetEntries(
    entries.map((entry) => ({ websitePayload: entry.websitePayload, row: entry.row }))
  ).map((entry) => {
    const barcode = cleanId(entry.websitePayload.barcode)
    const original = entries.find((e) => cleanId(e.websitePayload.barcode) === barcode)
    return {
      row: entry.row,
      mode: original?.mode || 'sheet',
      sheetImageUrls: original?.sheetImageUrls || splitSheetImageUrls(entry.row || {}),
      websitePayload: entry.websitePayload,
    }
  })

  const stats = {
    dryRun: args.dryRun,
    rowsRead: limitedRows.length,
    uniqueBarcodes: deduped.length,
    created: 0,
    updated: 0,
    barcodeOnly: 0,
    imagesFixed: 0,
    unpublishedNoImages: 0,
    orphansUnpublished: 0,
    duplicatesRemoved: 0,
    invalidBarcodeRemoved: 0,
    errors: [],
  }

  const validBarcodes = new Set()

  for (const entry of deduped) {
    const { websitePayload, sheetImageUrls, mode } = entry
    validBarcodes.add(cleanId(websitePayload.barcode))

    try {
      const result = await upsertGoldenProduct(websitePayload, args.dryRun)
      if (result.created) stats.created += 1
      else stats.updated += 1
      if (mode === 'barcode-only') stats.barcodeOnly += 1

      if (!args.dryRun && result.product?._id) {
        const product = await Product.findById(result.product._id)
        const imageResult = await fixProductImages(product, sheetImageUrls, args)
        if (imageResult.afterCount > 0) stats.imagesFixed += 1
        else if (!product.isPublished) stats.unpublishedNoImages += 1
      }

      const action = result.created ? 'CREATE' : 'UPDATE'
      console.log(`${action} ${websitePayload.barcode} | ${websitePayload.name?.slice(0, 60)} | $${websitePayload.price} | stock ${websitePayload.stock}`)
    } catch (err) {
      stats.errors.push({ barcode: websitePayload.barcode, error: err.message })
      console.warn(`ERROR ${websitePayload.barcode}: ${err.message}`)
    }
  }

  if (!args.skipDedupe) {
    stats.duplicatesRemoved = await dedupeBarcodeGroups(args.dryRun)
  }

  if (!args.skipUnpublish) {
    stats.orphansUnpublished = await unpublishOrphans(validBarcodes, args.dryRun)
  }

  stats.invalidBarcodeRemoved = await cleanupInvalidBarcodeProducts(args.dryRun)

  console.log('\n--- Golden sheet import summary ---')
  console.log(JSON.stringify(stats, null, 2))
  process.exit(stats.errors.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
