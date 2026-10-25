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

/** Hosts that must never appear in Merchant Center / public sheet feeds. */
const LEGACY_MEDIA_HOST_RE = /^https?:\/\/(138\.197\.107\.137|localhost(?::\d+)?)(?=\/|$)/i

function rewritePublicMediaHost(url) {
  const cleaned = cleanText(url)
  if (!cleaned) return ''
  // Force feed URLs onto the public site origin (SITE_URL / PUBLIC_MEDIA_URL).
  if (LEGACY_MEDIA_HOST_RE.test(cleaned)) {
    return toAbsoluteMediaUrl(cleaned.replace(LEGACY_MEDIA_HOST_RE, ''))
  }
  if (/^https?:\/\//i.test(cleaned)) return cleaned
  return toAbsoluteMediaUrl(cleaned)
}

function isMerchantSafeImageUrl(url) {
  // GMC does not accept AVIF (or HEIC). Prefer jpeg/png/webp/gif.
  return /\.(jpe?g|png|webp|gif|bmp|tiff?)(\?|#|$)/i.test(url)
}

function collectAbsoluteImageUrls(product) {
  const urls = (product.images || [])
    .map((img) => rewritePublicMediaHost(img?.url))
    .map(cleanText)
    .filter((url) => /^https?:\/\//i.test(url))

  const unique = [...new Set(urls)]
  // Put Merchant-safe formats first so column H / image_link is crawlable.
  return unique.sort((a, b) => Number(isMerchantSafeImageUrl(b)) - Number(isMerchantSafeImageUrl(a)))
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
  const roundedPrice = Number.isFinite(price) ? Number(price.toFixed(2)) : 0
  const stock = Number(product.stock) || 0

  return {
    Barcode: cleanText(product.barcode),
    Name: cleanText(product.name),
    Brand: cleanText(product.brand),
    active_ingredient: activeIngredient,
    dosage_form: dosageForm,
    package_ndc: parsePackageNdc(product.moreInfo),
    'price (API)': roundedPrice,
    'Image URLs': primaryImage,
    'Desc.': cleanText(product.description),
    Stock: stock,
    'Google Category': cleanText(product.category),
    'Price (Local)': roundedPrice,
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
  rewritePublicMediaHost,
  isMerchantSafeImageUrl,
  parsePackageNdc,
  parseIngredientsParts,
}
