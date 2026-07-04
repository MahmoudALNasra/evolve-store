const axios = require('axios')
const { searchWeb, searchImages } = require('./serperService')

const PHARMACY_CATEGORIES = [
  'Vitamins & Supplements',
  'Personal Care',
  'Medical Supplies',
  'Over-the-Counter',
  'Wellness',
  'Uncategorized',
]

function normalizeBarcode(value) {
  return String(value || '').trim().toUpperCase()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function mapOffCategory(categoriesTag) {
  const tag = String(categoriesTag || '').toLowerCase()
  if (/vitamin|supplement|mineral|dietary|probiotic|herbal|omega|collagen/.test(tag)) {
    return 'Vitamins & Supplements'
  }
  if (/personal care|cosmetic|skin|hair|soap|shampoo|lotion|deodorant/.test(tag)) {
    return 'Personal Care'
  }
  if (/medical|first aid|bandage|health care|healthcare device/.test(tag)) {
    return 'Medical Supplies'
  }
  if (/otc|over-the-counter|pain relief|cold|cough|allergy/.test(tag)) {
    return 'Over-the-Counter'
  }
  if (/beverage|food|snack|grocery/.test(tag)) {
    return 'Wellness'
  }
  return 'Uncategorized'
}

const JUNK_TITLE_PATTERNS = [
  /\bupc\s*(lookup|search|database|index|finder)\b/i,
  /\bbarcode\s*(lookup|search|database|finder)\b/i,
  /\blook\s*up\s*any\s*(upc|ean|barcode)\b/i,
  /\bscandit\b/i,
  /\bgo-upc\b/i,
  /\bbarcodes?\s*inc\b/i,
  /^product\s+\w+$/i,
]

const JUNK_LINK_DOMAINS = [
  'scandit.com',
  'go-upc.com',
  'barcodelookup.com',
  'upcitemdb.com',
  'barcodesinc.com',
  'upcindex.com',
  'eandata.info',
  'upcdatabase.org',
  'barcode-list.com',
]

const PREFERRED_RETAIL_DOMAINS = [
  'amazon.com',
  'walmart.com',
  'target.com',
  'cvs.com',
  'walgreens.com',
  'iherb.com',
  'vitacost.com',
  'swansonvitamins.com',
  'riteaid.com',
  'heb.com',
  'costco.com',
  'drugstore.com',
  'vitaminshoppe.com',
]

function cleanProductTitle(title) {
  return String(title || '')
    .replace(/\s*[-|–]\s*(Amazon|Walmart|Target|eBay|CVS|Walgreens).*$/i, '')
    .replace(/\bUPC\s*\d+/gi, '')
    .replace(/\bEAN\s*\d+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 180)
}

function isJunkLookupTitle(title) {
  const cleaned = cleanProductTitle(title)
  if (!cleaned || cleaned.length < 5) return true
  return JUNK_TITLE_PATTERNS.some((pattern) => pattern.test(cleaned))
}

function linkDomain(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function scoreWebResult(result) {
  const title = cleanProductTitle(result.title)
  if (!title || title.length < 5 || isJunkLookupTitle(title)) return -1

  const domain = linkDomain(result.link)
  if (JUNK_LINK_DOMAINS.some((d) => domain.includes(d))) return -1

  let score = 0
  if (PREFERRED_RETAIL_DOMAINS.some((d) => domain.includes(d))) score += 10
  if (result.snippet && !/\bupc\s*\d{8,}/i.test(result.snippet)) score += 2
  if (title.length >= 20) score += 2
  if (/\b(vitamin|supplement|cream|lotion|soap|shampoo|medicine|tablet|capsule|oz|ml|mg)\b/i.test(title)) {
    score += 3
  }

  return score
}

function pickBestWebResult(webResults) {
  let best = null
  let bestScore = -1

  for (const result of webResults) {
    const score = scoreWebResult(result)
    if (score > bestScore) {
      bestScore = score
      best = result
    }
  }

  return best
}

async function lookupOpenFoodFacts(barcode) {
  const digits = String(barcode).replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 14) return null

  try {
    const { data } = await axios.get(
      `https://world.openfoodfacts.org/api/v2/product/${digits}.json`,
      { timeout: 10000 }
    )
    if (data?.status !== 1 || !data.product) return null

    const p = data.product
    const name = cleanProductTitle(p.product_name || p.generic_name)
    if (!name) return null

    return {
      name,
      brand: String(p.brands || '').split(',')[0].trim(),
      description: [
        p.generic_name && p.generic_name !== name ? p.generic_name : '',
        p.ingredients_text ? `Ingredients: ${String(p.ingredients_text).slice(0, 400)}` : '',
        p.quantity ? `Size: ${p.quantity}` : '',
      ].filter(Boolean).join('\n\n'),
      category: mapOffCategory(p.categories),
      images: [p.image_url, p.image_front_url, p.image_front_small_url].filter(Boolean),
      source: 'openfoodfacts',
    }
  } catch {
    return null
  }
}

async function lookupOpenBeautyFacts(barcode) {
  const digits = String(barcode).replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 14) return null

  try {
    const { data } = await axios.get(
      `https://world.openbeautyfacts.org/api/v2/product/${digits}.json`,
      { timeout: 10000 }
    )
    if (data?.status !== 1 || !data.product) return null

    const p = data.product
    const name = cleanProductTitle(p.product_name || p.generic_name)
    if (!name) return null

    return {
      name,
      brand: String(p.brands || '').split(',')[0].trim(),
      description: [
        p.generic_name && p.generic_name !== name ? p.generic_name : '',
        p.ingredients_text ? `Ingredients: ${String(p.ingredients_text).slice(0, 400)}` : '',
      ].filter(Boolean).join('\n\n'),
      category: mapOffCategory(p.categories),
      images: [p.image_url, p.image_front_url].filter(Boolean),
      source: 'openbeautyfacts',
    }
  } catch {
    return null
  }
}

async function lookupViaSerper(barcode) {
  const queries = [
    `${barcode} product`,
    `"${barcode}"`,
    `${barcode} UPC pharmacy wellness`,
  ]

  for (const q of queries) {
    const [web, images] = await Promise.all([
      searchWeb(q, { num: 10 }),
      searchImages(`${barcode} product`, { num: 8 }),
    ])

    const hit = pickBestWebResult(web)
    if (!hit) continue

    const name = cleanProductTitle(hit.title)
    if (!name || name.length < 4 || isJunkLookupTitle(name)) continue

    const snippet = web
      .filter((r) => !isJunkLookupTitle(r.title))
      .map((r) => r.snippet)
      .filter(Boolean)
      .slice(0, 3)
      .join(' ')
    const imageUrls = images.map((i) => i.imageUrl).filter(Boolean)

    return {
      name,
      brand: '',
      description: snippet.slice(0, 600) || `${name}. Available at Evolve Specialty Pharmacy & Wellness.`,
      category: 'Uncategorized',
      images: imageUrls,
      source: 'serper',
    }
  }

  return null
}

async function lookupBarcodeProduct(barcode, options = {}) {
  const normalized = normalizeBarcode(barcode)
  if (!normalized) return null

  const delayMs = Number(options.delayMs || process.env.BARCODE_LOOKUP_DELAY_MS || 400)

  let result = await lookupOpenFoodFacts(normalized)
  if (result) return { ...result, barcode: normalized }

  result = await lookupOpenBeautyFacts(normalized)
  if (result) return { ...result, barcode: normalized }

  if (process.env.SERPER_API_KEY) {
    await sleep(delayMs)
    result = await lookupViaSerper(normalized)
    if (result) return { ...result, barcode: normalized }
  }

  return {
    barcode: normalized,
    name: `Product ${normalized}`,
    brand: '',
    description: `Barcode ${normalized}. Product details pending — update name and description in admin.`,
    category: 'Uncategorized',
    images: [],
    source: 'fallback',
  }
}

module.exports = {
  normalizeBarcode,
  lookupBarcodeProduct,
  PHARMACY_CATEGORIES,
}
