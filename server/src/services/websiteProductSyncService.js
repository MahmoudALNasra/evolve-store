const Product = require('../models/Product')
const Category = require('../models/Category')
const { generateUniqueSlug } = require('../utils/productSlug')
const { websitePayloadToProductDocument } = require('../utils/inventoryMapper')
const { normalizeSku } = require('../utils/normalizeProductFields')
const { findExistingProduct, normalizeCategoryName } = require('../utils/productMatch')
const { shouldSyncPricesFromSheet, stripSheetPricing } = require('../utils/inventorySyncOptions')

async function ensureCategoryExists(category) {
  const name = normalizeCategoryName(category)
  await Category.updateOne(
    { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
    { $setOnInsert: { name, description: '' } },
    { upsert: true }
  )
}

async function upsertWebsiteProduct(websitePayload) {
  const productPayload = websitePayloadToProductDocument(websitePayload)
  productPayload.category = normalizeCategoryName(productPayload.category)
  delete productPayload.imageUrls

  const sku = normalizeSku(productPayload.sku)
  if (sku) productPayload.sku = sku
  else delete productPayload.sku

  if (!productPayload.barcode && !sku) {
    throw new Error('Cannot sync product without sku or barcode')
  }

  await ensureCategoryExists(productPayload.category)

  const existing = await findExistingProduct(productPayload)

  if (!existing) {
    // Website admin controls publishing. Sheet/inventory sync never auto-publishes.
    productPayload.isPublished = false
    productPayload.slug = await generateUniqueSlug(Product, productPayload.name)
    const created = await Product.create(productPayload)
    return { product: created, created: true }
  }

  if (!shouldSyncPricesFromSheet()) {
    Object.assign(productPayload, stripSheetPricing(productPayload))
  }

  if (!existing.slug) {
    productPayload.slug = await generateUniqueSlug(Product, productPayload.name, { excludeId: existing._id })
  }

  // Never let sheet/stock sync flip admin-only flags — website DB is source of truth.
  delete productPayload.isPublished
  delete productPayload.isFeatured
  delete productPayload.isTaxable

  Object.assign(existing, productPayload)
  await existing.save()
  return { product: existing, created: false }
}

async function updateWebsiteStockByProductId(productId, stock) {
  return Product.findByIdAndUpdate(
    productId,
    { $set: { stock } },
    { returnDocument: 'after' }
  )
}

module.exports = {
  upsertWebsiteProduct,
  updateWebsiteStockByProductId,
}
