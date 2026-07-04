const Product = require('../models/Product')
const { isImageUrlWorking } = require('./productImageAuditService')
const { isPlaceholderImageUrl } = require('../utils/productImageUtils')
const { suggestProductSeo } = require('./productDescriptionOptimizationService')

const DEFAULT_TIMEOUT = Number(process.env.IMAGE_AUDIT_TIMEOUT_MS || 8000)

async function isValidCatalogImage(url) {
  if (isPlaceholderImageUrl(url)) return false
  return isImageUrlWorking(url)
}

async function cleanProductImages(product, { save = true } = {}) {
  const before = (product.images || []).length
  const kept = []

  for (const img of product.images || []) {
    const url = img?.url
    if (!url) continue
    if (await isValidCatalogImage(url)) {
      kept.push(img)
    }
  }

  product.images = kept

  if (kept.length === 0) {
    product.isPublished = false
  }

  if (save) await product.save()

  return {
    productId: product._id,
    name: product.name,
    before,
    after: kept.length,
    unpublished: kept.length === 0,
    removed: before - kept.length,
  }
}

async function auditAllProductImages({ limit = 0, dryRun = false } = {}) {
  let query = Product.find({})
  if (limit > 0) query = query.limit(limit)

  const products = await query
  const summary = {
    scanned: products.length,
    imagesRemoved: 0,
    unpublished: 0,
    unchanged: 0,
    errors: 0,
  }

  for (const product of products) {
    try {
      const result = await cleanProductImages(product, { save: !dryRun })
      summary.imagesRemoved += result.removed
      if (result.unpublished) summary.unpublished += 1
      else if (result.removed === 0) summary.unchanged += 1
      if (result.removed > 0 || result.unpublished) {
        console.log(`Images: ${product.name} — removed ${result.removed}, published=${!result.unpublished}`)
      }
    } catch (err) {
      summary.errors += 1
      console.warn(`Image audit failed for ${product.name}: ${err.message}`)
    }
  }

  return summary
}

async function enrichProductContent(product, { save = true, dryRun = false } = {}) {
  const needsDescription = !product.description?.trim() || product.description.trim().length < 80
  const needsTabs = !product.ingredients?.trim()
    || !product.suggestedUse?.trim()
    || !product.moreInfo?.trim()
  const needsSeo = !product.seoMetaDescription?.trim()

  if (!needsDescription && !needsTabs && !needsSeo) {
    return { skipped: true, productId: product._id }
  }

  const suggestion = await suggestProductSeo(product, { includeTabs: true })

  if (dryRun) {
    return { productId: product._id, name: product.name, suggested: suggestion.suggested }
  }

  if (needsDescription && suggestion.suggested.descriptionDraft) {
    product.description = suggestion.suggested.descriptionDraft
    product.descriptionDraft = suggestion.suggested.descriptionDraft
  }
  if (needsSeo) {
    product.seoTitle = (suggestion.suggested.seoTitle || product.seoTitle || '').replace(/\s*\|\s*Evolve.*/i, '').trim()
    product.seoMetaDescription = suggestion.suggested.seoMetaDescription || product.seoMetaDescription
    product.seoFaqs = suggestion.suggested.seoFaqs?.length ? suggestion.suggested.seoFaqs : product.seoFaqs
  }
  if (suggestion.suggested.ingredients && !product.ingredients?.trim()) {
    product.ingredients = suggestion.suggested.ingredients
  }
  if (suggestion.suggested.suggestedUse && !product.suggestedUse?.trim()) {
    product.suggestedUse = suggestion.suggested.suggestedUse
  }
  if (suggestion.suggested.moreInfo && !product.moreInfo?.trim()) {
    product.moreInfo = suggestion.suggested.moreInfo
  }

  if (save) await product.save()

  return { productId: product._id, name: product.name, enriched: true }
}

async function enrichAllProductContent({ limit = 50, onlyMissing = true, dryRun = false } = {}) {
  const filter = { isPublished: true }
  if (onlyMissing) {
    filter.$or = [
      { description: { $in: [null, ''] } },
      { seoMetaDescription: { $in: [null, ''] } },
      { ingredients: { $in: [null, ''] } },
      { suggestedUse: { $in: [null, ''] } },
    ]
  }

  const products = await Product.find(filter).sort({ updatedAt: 1 }).limit(limit || 500)
  const delayMs = Number(process.env.PRODUCT_SEO_DELAY_MS || 1200)
  const summary = { scanned: products.length, enriched: 0, skipped: 0, errors: 0 }

  for (const product of products) {
    try {
      const result = await enrichProductContent(product, { save: !dryRun, dryRun })
      if (result.skipped) summary.skipped += 1
      else summary.enriched += 1
      await new Promise((r) => setTimeout(r, delayMs))
    } catch (err) {
      summary.errors += 1
      console.warn(`Content enrich failed for ${product.name}: ${err.message}`)
    }
  }

  return summary
}

module.exports = {
  isValidCatalogImage,
  cleanProductImages,
  auditAllProductImages,
  enrichProductContent,
  enrichAllProductContent,
}
