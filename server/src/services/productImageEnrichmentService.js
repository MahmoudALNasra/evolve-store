const fs = require('fs')
const Product = require('../models/Product')
const { searchImages } = require('./serperService')
const { isImageUrlWorking } = require('./productImageAuditService')
const { saveProductImageFromUrl, localFileExists } = require('./localMediaStorageService')
const {
  isLocalProductMediaUrl,
  localPathFromPublicUrl,
  sanitizeSlug,
} = require('../utils/productMediaPaths')

const MIN_IMAGES = Number(process.env.PRODUCT_IMAGE_MIN_COUNT || 5)
const MAX_IMAGES = Number(process.env.PRODUCT_IMAGE_MAX_COUNT || 8)
const SERPER_DELAY_MS = Number(process.env.PRODUCT_IMAGE_SERPER_DELAY_MS || 600)

const PLACEHOLDER_PATTERNS = [
  /placehold\.co/i,
  /placeholder/i,
  /no\+image/i,
  /logo\.png/i,
  /\/logo\.png$/i,
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPlaceholderUrl(url) {
  if (!url) return true
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(url))
}

async function isGoodProductImage(url) {
  if (!url || isPlaceholderUrl(url)) return false

  if (isLocalProductMediaUrl(url)) {
    const filePath = localPathFromPublicUrl(url)
    return filePath && fs.existsSync(filePath)
  }

  return isImageUrlWorking(url)
}

function buildSerperQuery(product) {
  const parts = [
    product.name,
    product.category,
    product.tags?.[0],
    'product package',
    'pharmacy',
  ].filter(Boolean)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

async function classifyProductImages(product) {
  const images = product.images || []
  const good = []
  const broken = []

  for (const img of images) {
    const url = img?.url
    if (await isGoodProductImage(url)) {
      good.push(img)
    } else if (url) {
      broken.push(img)
    }
  }

  return { good, broken, beforeCount: images.length }
}

async function mirrorImageLocally(product, imageEntry, index) {
  const slug = product.slug || product._id
  if (isLocalProductMediaUrl(imageEntry.url) && localFileExists(imageEntry.url)) {
    return { url: imageEntry.url, source: imageEntry.source || 'local' }
  }

  const saved = await saveProductImageFromUrl(slug, imageEntry.url, {
    index,
    source: imageEntry.source === 'serper' ? 'serper' : 'local',
  })

  return { url: saved.url, source: saved.source }
}

async function fetchSerperCandidates(product, needed) {
  const query = buildSerperQuery(product)
  const num = Math.min(Math.max(needed * 4, 10), 20)
  const results = await searchImages(query, { num })
  const seen = new Set()

  return results
    .map((item) => item.imageUrl)
    .filter((url) => {
      if (!url || seen.has(url) || isPlaceholderUrl(url)) return false
      seen.add(url)
      return true
    })
}

async function enrichProductImages(product, options = {}) {
  const dryRun = options.dryRun === true
  const force = options.force === true
  const save = options.save !== false

  const { good, broken, beforeCount } = await classifyProductImages(product)

  if (!force && good.length >= MIN_IMAGES && broken.length === 0) {
    return {
      productId: product._id,
      productName: product.name,
      slug: product.slug,
      status: 'skipped',
      reason: 'Already has enough working images',
      beforeCount,
      afterCount: good.length,
      goodCount: good.length,
      brokenCount: broken.length,
      added: [],
      removed: broken.map((img) => img.url),
      images: good,
    }
  }

  const targetCount = Math.min(
    MAX_IMAGES,
    Math.max(MIN_IMAGES, good.length + (broken.length > 0 ? broken.length : 0))
  )
  const neededFromSerper = Math.max(0, targetCount - good.length)

  const finalImages = []
  const added = []
  const removed = broken.map((img) => img.url)
  let index = 1

  for (const img of good) {
    try {
      if (dryRun) {
        finalImages.push(img)
      } else {
        const local = await mirrorImageLocally(product, img, index)
        finalImages.push(local)
        if (local.url !== img.url) added.push(local.url)
      }
      index += 1
    } catch (err) {
      removed.push(img.url)
    }
  }

  if (neededFromSerper > 0) {
    await sleep(SERPER_DELAY_MS)
    const candidates = await fetchSerperCandidates(product, neededFromSerper)
    const existingUrls = new Set(finalImages.map((img) => img.url))

    for (const candidateUrl of candidates) {
      if (finalImages.length >= targetCount) break
      if (existingUrls.has(candidateUrl)) continue

      try {
        if (!(await isImageUrlWorking(candidateUrl))) continue

        if (dryRun) {
          finalImages.push({ url: candidateUrl, source: 'serper' })
          added.push(candidateUrl)
          existingUrls.add(candidateUrl)
          continue
        }

        const saved = await saveProductImageFromUrl(product.slug || product._id, candidateUrl, {
          index,
          source: 'serper',
        })
        finalImages.push({ url: saved.url, source: 'serper' })
        added.push(saved.url)
        existingUrls.add(saved.url)
        index += 1
        await sleep(SERPER_DELAY_MS)
      } catch {
        /* try next candidate */
      }
    }
  }

  const afterCount = finalImages.length

  if (!dryRun && save) {
    product.images = afterCount > 0 ? finalImages : []
    await product.save()
  }

  return {
    productId: product._id,
    productName: product.name,
    slug: product.slug,
    status: afterCount >= MIN_IMAGES ? 'updated' : afterCount > good.length ? 'partial' : 'needs_more',
    beforeCount,
    afterCount,
    goodCount: good.length,
    brokenCount: broken.length,
    neededFromSerper,
    added,
    removed,
    images: finalImages,
    dryRun,
  }
}

async function enrichProductsBatch(options = {}) {
  const limit = Number(options.limit || 25)
  const skip = Number(options.skip || 0)
  const dryRun = options.dryRun === true
  const force = options.force === true
  const onlyNeedsWork = options.onlyNeedsWork !== false

  const products = await Product.find({ isPublished: true })
    .sort({ updatedAt: 1 })
    .skip(skip)
    .limit(limit)

  const results = []
  let skipped = 0
  let updated = 0

  for (const product of products) {
    if (onlyNeedsWork && !force) {
      const { good, broken } = await classifyProductImages(product)
      if (good.length >= MIN_IMAGES && broken.length === 0) {
        skipped += 1
        results.push({
          productId: product._id,
          productName: product.name,
          status: 'skipped',
          reason: 'Already has enough working images',
          goodCount: good.length,
          brokenCount: broken.length,
        })
        continue
      }
    }

    try {
      const result = await enrichProductImages(product, { dryRun, force, save: !dryRun })
      if (result.status === 'skipped') skipped += 1
      else updated += 1
      results.push(result)
    } catch (err) {
      results.push({
        productId: product._id,
        productName: product.name,
        status: 'error',
        error: err.message,
      })
    }
  }

  return {
    scanned: products.length,
    skipped,
    updated,
    dryRun,
    minImages: MIN_IMAGES,
    maxImages: MAX_IMAGES,
    results,
  }
}

/** Process every published product in batches until the catalog is exhausted. */
async function enrichAllProducts(options = {}) {
  const batchSize = Number(options.limit || process.env.PRODUCT_IMAGE_BATCH_LIMIT || 25)
  let skip = 0
  const totals = {
    batches: 0,
    scanned: 0,
    skipped: 0,
    updated: 0,
    errors: 0,
    dryRun: options.dryRun === true,
    minImages: MIN_IMAGES,
    maxImages: MAX_IMAGES,
  }

  while (true) {
    const result = await enrichProductsBatch({
      ...options,
      limit: batchSize,
      skip,
    })

    if (result.scanned === 0) break

    totals.batches += 1
    totals.scanned += result.scanned
    totals.skipped += result.skipped
    totals.updated += result.updated
    totals.errors += result.results.filter((r) => r.status === 'error').length

    console.log(
      `[batch ${totals.batches}] scanned=${result.scanned} skip=${skip} ` +
      `updated=${result.updated} skipped=${result.skipped} (running total: ${totals.scanned})`
    )

    skip += result.scanned
  }

  return totals
}

module.exports = {
  MIN_IMAGES,
  MAX_IMAGES,
  isPlaceholderUrl,
  isGoodProductImage,
  classifyProductImages,
  enrichProductImages,
  enrichProductsBatch,
  enrichAllProducts,
}
