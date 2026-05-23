function cleanText(value) {
  if (value == null) return ''
  return String(value).trim()
}

function parseMoney(value) {
  const cleaned = cleanText(value).replace(/[^0-9.-]/g, '')
  const number = Number(cleaned)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function resolvePricing(row) {
  const localPrice = parseMoney(row['Price (Local)'])
  const apiPrice = parseMoney(row['price (API)'])
  const price = localPrice > 0 ? localPrice : apiPrice

  return {
    price,
    comparePrice: apiPrice > price ? apiPrice : 0,
  }
}

function parseStock(value) {
  const number = Number.parseInt(cleanText(value).replace(/[^0-9-]/g, ''), 10)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function splitImageUrls(value) {
  return cleanText(value)
    .split(',')
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url))
}

function uniqueValues(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))]
}

function getGoogleCategory(row) {
  return cleanText(row['Google Category'])
}

function getCategoryLeaf(categoryPath) {
  const parts = cleanText(categoryPath)
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.at(-1) || ''
}

const CATEGORY_RULES = [
  { category: 'Vitamins & Supplements', pattern: /\b(vitamin|supplement|mineral|nutrition|protein|probiotic|turmeric|zinc|magnesium|melatonin|omega|fish oil|herbal)\b/i },
  { category: 'Pain Relief', pattern: /\b(pain|analgesic|ibuprofen|acetaminophen|aspirin|naproxen|arthritis|muscle|joint)\b/i },
  { category: 'Cough Cold & Flu', pattern: /\b(cough|cold|flu|congestion|mucus|throat|decongestant|expectorant)\b/i },
  { category: 'Allergy & Sinus', pattern: /\b(allergy|sinus|antihistamine|loratadine|cetirizine|fexofenadine|nasal)\b/i },
  { category: 'Digestive Health', pattern: /\b(digest|stomach|acid|heartburn|laxative|diarrhea|constipation|nausea|antacid)\b/i },
  { category: 'Skin Care', pattern: /\b(skin|cream|lotion|ointment|eczema|acne|rash|moistur|sunscreen|dermatology)\b/i },
  { category: 'Oral Care', pattern: /\b(oral|dental|tooth|teeth|mouth|gum|floss|toothpaste|mouthwash)\b/i },
  { category: 'Eye & Ear Care', pattern: /\b(eye|ear|vision|contact lens|drops|hearing)\b/i },
  { category: 'First Aid', pattern: /\b(first aid|bandage|gauze|wound|antiseptic|hydrogen peroxide|alcohol prep)\b/i },
  { category: 'Baby & Child Care', pattern: /\b(baby|infant|child|children|kids|pediatric|diaper)\b/i },
  { category: 'Diabetes Care', pattern: /\b(diabetes|diabetic|glucose|blood sugar|lancet|insulin)\b/i },
  { category: 'Medical Supplies', pattern: /\b(medical supplies|thermometer|blood pressure|brace|support|compression|syringe)\b/i },
  { category: 'Personal Care', pattern: /\b(personal care|deodorant|shampoo|soap|body wash|feminine|hygiene|hair care)\b/i },
  { category: 'Sexual Wellness', pattern: /\b(sexual|condom|lubricant|pregnancy|fertility)\b/i },
]

/** One SEO-friendly website category per product — Google taxonomy stays separate. */
function getWebsiteCategory(row) {
  const manualCategory = cleanText(row['Website Category'])
  if (manualCategory) return manualCategory

  const googleCategory = getGoogleCategory(row)
  const haystack = [
    googleCategory,
    row.Name,
    row.Brand,
    row.active_ingredient,
    row.dosage_form,
    row['Desc.'],
  ].map(cleanText).join(' ')

  const match = CATEGORY_RULES.find((rule) => rule.pattern.test(haystack))
  if (match) return match.category

  return getCategoryLeaf(googleCategory) || 'Health & Wellness'
}

function buildTags(row, category) {
  const googleLeaf = getCategoryLeaf(getGoogleCategory(row))
  return uniqueValues([
    category,
    googleLeaf !== category ? googleLeaf : '',
    row.Brand,
    row.active_ingredient,
    row.dosage_form,
  ]).join(', ')
}

function productLinkPathFromValue(value) {
  const link = cleanText(value)
  if (!link) return ''
  if (link.startsWith('/')) return link

  try {
    const url = new URL(link)
    return `${url.pathname}${url.search}${url.hash}` || ''
  } catch {
    return ''
  }
}

function getSheetProductLinkPath(row) {
  return productLinkPathFromValue(
    row.Link ||
      row.link ||
      row['Product Link'] ||
      row['product link'] ||
      row.productUrl
  )
}

/**
 * Exact Google Sheet -> website target mapping.
 *
 * Source columns:
 * Barcode, Name, Brand, active_ingredient, dosage_form, package_ndc,
 * price (API), Image URLs, Desc., Stock, Google Category, Price (Local),
 * Stock Alert, image (extra), MPN
 */
function mapSheetRowToWebsiteProduct(row = {}) {
  const stock = parseStock(row.Stock)
  const pricing = resolvePricing(row)
  const category = getWebsiteCategory(row)
  const imageUrls = uniqueValues([
    ...splitImageUrls(row['Image URLs']),
    ...splitImageUrls(row['image (extra)']),
  ]).join(', ')

  return {
    name: cleanText(row.Name),
    description: cleanText(row['Desc.']),
    price: pricing.price,
    comparePrice: pricing.comparePrice,
    category,
    googleProductCategory: getGoogleCategory(row),
    tags: buildTags(row, category),
    sku: cleanText(row.MPN) || cleanText(row.Barcode),
    barcode: cleanText(row.Barcode),
    stock,
    weight: 0,
    isPublished: stock > 0,
    isFeatured: false,
    imageUrls,
    productLinkPath: getSheetProductLinkPath(row),
  }
}

function websitePayloadToProductDocument(payload = {}) {
  const productDocument = {
    ...payload,
    tags: cleanText(payload.tags)
      ? payload.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [],
    images: splitImageUrls(payload.imageUrls).map((url) => ({
      url,
      source: 'link',
    })),
  }

  delete productDocument.imageUrls
  delete productDocument.productUrl
  delete productDocument.productLinkPath
  delete productDocument.googleProductCategory
  return productDocument
}

module.exports = {
  mapSheetRowToWebsiteProduct,
  websitePayloadToProductDocument,
  parseStock,
  parseMoney,
  resolvePricing,
  productLinkPathFromValue,
  getWebsiteCategory,
  getGoogleCategory,
  getCategoryLeaf,
}
