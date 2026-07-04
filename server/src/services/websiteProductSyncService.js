const Product = require('../models/Product')
const Category = require('../models/Category')
const { generateUniqueSlug } = require('../utils/productSlug')
const { websitePayloadToProductDocument } = require('../utils/inventoryMapper')
const { normalizeSku } = require('../utils/normalizeProductFields')
const { findExistingProduct, normalizeCategoryName } = require('../utils/productMatch')

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
    productPayload.slug = await generateUniqueSlug(Product, productPayload.name)
    const created = await Product.create(productPayload)
    return { product: created, created: true }
  }

  if (!existing.slug) {
    productPayload.slug = await generateUniqueSlug(Product, productPayload.name, { excludeId: existing._id })
  }

  Object.assign(existing, productPayload)
  await existing.save()
  return { product: existing, created: false }
}

async function updateWebsiteStockByProductId(productId, stock) {
  return Product.findByIdAndUpdate(
    productId,
    { $set: { stock, isPublished: stock > 0 } },
    { returnDocument: 'after' }
  )
}

module.exports = {
  upsertWebsiteProduct,
  updateWebsiteStockByProductId,
}
