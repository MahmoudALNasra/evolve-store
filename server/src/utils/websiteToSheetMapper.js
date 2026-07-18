const { toAbsoluteMediaUrl } = require('./productMediaPaths')

const PRODUCTS_SHEET_HEADERS = [
  'Barcode',
  'Name',
  'Brand',
  'active_ingredient',
  'dosage_form',
  'package_ndc',
  'price (API)',
  'Image URLs',
  'Desc.',
  'Stock',
  'Google Category',
  'Price (Local)',
  'Stock Alert',
  'image (extra)',
  'MPN',
]

function cleanText(value) {
  if (value == null) return ''
  return String(value).trim()
}

function parseIngredientsParts(ingredients) {
  const raw = cleanText(ingredients)
  if (!raw) return { activeIngredient: '', dosageForm: '' }

  const parts = raw.split(/[;|]/).map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { activeIngredient: parts[0], dosageForm: parts.slice(1).join('; ') }
  }
  return { activeIngredient: raw, dosageForm: '' }
}

function parsePackageNdc(moreInfo) {
  const text = cleanText(moreInfo)
  if (!text) return ''
  const match = text.match(/Package\s*NDC:\s*([0-9A-Za-z.\-]+)/i)
  return match ? match[1] : ''
}

function collectAbsoluteImageUrls(product) {
  const urls = (product.images || [])
    .map((img) => toAbsoluteMediaUrl(img?.url))
    .map(cleanText)
    .filter((url) => /^https?:\/\//i.test(url))

  return [...new Set(urls)]
}

/**
 * Map a website Product document to one Products-tab row (A:O).
 * Website DB is the source of truth.
 */
function mapWebsiteProductToSheetRow(product = {}) {
  const images = collectAbsoluteImageUrls(product)
  const primaryImage = images[0] || ''
  const extraImages = images.slice(1).join(', ')
  const { activeIngredient, dosageForm } = parseIngredientsParts(product.ingredients)
  const price = Number(product.price)
  const stock = Number(product.stock) || 0

  return {
    Barcode: cleanText(product.barcode),
    Name: cleanText(product.name),
    Brand: cleanText(product.brand),
    active_ingredient: activeIngredient,
    dosage_form: dosageForm,
    package_ndc: parsePackageNdc(product.moreInfo),
    'price (API)': '',
    'Image URLs': primaryImage,
    'Desc.': cleanText(product.description),
    Stock: stock,
    'Google Category': cleanText(product.category),
    'Price (Local)': Number.isFinite(price) ? Number(price.toFixed(2)) : 0,
    'Stock Alert': '',
    'image (extra)': extraImages,
    MPN: cleanText(product.sku),
  }
}

function sheetRowToValues(row) {
  return PRODUCTS_SHEET_HEADERS.map((header) => {
    const value = row[header]
    if (value == null) return ''
    return value
  })
}

function productsToSheetMatrix(products = []) {
  const rows = products.map((product) => mapWebsiteProductToSheetRow(product))
  return [
    PRODUCTS_SHEET_HEADERS,
    ...rows.map(sheetRowToValues),
  ]
}

module.exports = {
  PRODUCTS_SHEET_HEADERS,
  mapWebsiteProductToSheetRow,
  sheetRowToValues,
  productsToSheetMatrix,
  collectAbsoluteImageUrls,
  parsePackageNdc,
  parseIngredientsParts,
}
