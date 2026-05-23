const Product = require('../models/Product')
const Category = require('../models/Category')
const { generateUniqueSlug } = require('../utils/productSlug')
const { websitePayloadToProductDocument } = require('../utils/inventoryMapper')

function normalizeCategoryName(category) {
  return String(category || '').trim() || 'Uncategorized'
}

async function ensureCategoryExists(category) {
  const name = normalizeCategoryName(category)
  await Category.updateOne(
    { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
    { $setOnInsert: { name, description: '' } },
    { upsert: true }
  )
}

function buildProductQuery(payload) {
  if (payload.sku) return { sku: payload.sku }
  if (payload.barcode) return { barcode: payload.barcode }
  throw new Error('Cannot sync product without sku or barcode')
}

async function upsertWebsiteProduct(websitePayload) {
  const productPayload = websitePayloadToProductDocument(websitePayload)
  productPayload.category = normalizeCategoryName(productPayload.category)
  delete productPayload.imageUrls

  await ensureCategoryExists(productPayload.category)

  const query = buildProductQuery(productPayload)
  const existing = await Product.findOne(query)

  if (!existing) {
    productPayload.slug = await generateUniqueSlug(Product, productPayload.name)
    const created = await Product.create(productPayload)
    return { product: created, created: true }
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
