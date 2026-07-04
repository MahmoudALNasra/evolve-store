const Product = require('../models/Product')
const { normalizeSku } = require('../utils/normalizeProductFields')
const { isValidSheetProductName } = require('../utils/inventoryProductIdentity')

function normalizeCategoryName(category) {
  return String(category || '').trim() || 'Uncategorized'
}

function cleanId(value) {
  return String(value || '').trim()
}

function productQualityScore(product) {
  let score = 0
  const name = cleanId(product.name)
  const barcode = cleanId(product.barcode)
  if (isValidSheetProductName(name, barcode)) score += 100
  if (cleanId(product.description).length > 20) score += 20
  if (Array.isArray(product.images) && product.images.length > 0) score += 10 * product.images.length
  if (product.isPublished) score += 5
  if (normalizeSku(product.sku) && cleanId(product.sku) !== barcode) score += 5
  return score
}

async function findExistingProduct(payload) {
  const barcode = cleanId(payload.barcode)
  const sku = normalizeSku(payload.sku)

  if (barcode) {
    const byBarcode = await Product.findOne({ barcode })
    if (byBarcode) return byBarcode

    const legacySkuMatch = await Product.findOne({
      sku: barcode,
      $or: [{ barcode: '' }, { barcode: null }],
    })
    if (legacySkuMatch) return legacySkuMatch
  }

  if (sku) {
    const bySku = await Product.findOne({ sku })
    if (bySku) return bySku
  }

  return null
}

module.exports = {
  normalizeCategoryName,
  cleanId,
  productQualityScore,
  findExistingProduct,
}
