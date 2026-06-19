/** Shared SEO string helpers — keep in sync with server/src/utils/seoUtils.js */

export const SEO_TITLE_SUFFIX = ' | Evolve Pharmacy'
export const SEO_TITLE_SUFFIX_SHORT = ' | Evolve'
export const SEO_STORE_SHORT = 'Evolve Pharmacy'

export function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Product page title — target ≤60 chars.
 * Pattern: "[Product Name] | Evolve Pharmacy"
 */
export function generateSEOTitle(productName, maxLength = 60, customSuffix) {
  const name = String(productName || '').trim()
  if (!name) return SEO_STORE_SHORT

  const suffixes = customSuffix
    ? [customSuffix]
    : [SEO_TITLE_SUFFIX, SEO_TITLE_SUFFIX_SHORT]

  for (const suffix of suffixes) {
    const available = maxLength - suffix.length
    if (name.length <= available) return `${name}${suffix}`
  }

  const suffix = SEO_TITLE_SUFFIX
  const maxName = maxLength - suffix.length - 3
  let truncated = name.slice(0, Math.max(8, maxName))
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > truncated.length * 0.45) {
    truncated = truncated.slice(0, lastSpace)
  }
  return `${truncated.trim()}...${suffix}`
}

/**
 * Meta description — target ~155 chars at sentence or word boundary.
 */
export function generateMetaDescription(sourceText, maxLength = 155) {
  const text = stripHtml(sourceText)
  if (!text) return ''

  if (text.length <= maxLength) return text

  const slice = text.slice(0, maxLength)
  const sentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? ')
  )
  if (sentenceEnd >= maxLength * 0.55) {
    return slice.slice(0, sentenceEnd + 1).trim()
  }

  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace >= maxLength * 0.65) {
    return `${slice.slice(0, lastSpace).trim()}…`
  }

  return `${slice.trim()}…`
}

/** Extract brand from product fields for alt text / keywords. */
export function getProductBrand(product) {
  if (product?.brand?.trim()) return product.brand.trim()
  const tags = Array.isArray(product?.tags) ? product.tags : []
  const brandTag = tags.find((t) => /health|nature|sense|designs|mason|good/i.test(t))
  if (brandTag) return brandTag
  const name = String(product?.name || '')
  const match = name.match(/^([^,]+(?:For Health|Natural|Sense|Health))/i)
  return match ? match[1].trim() : ''
}

export function getProductImageAlt(product, index = 0) {
  const name = product?.name || 'Product'
  const brand = getProductBrand(product)
  const category = product?.category || 'Wellness'
  const parts = [name]
  if (brand) parts.push(brand)
  parts.push(category)
  if (index > 0) parts.push(`image ${index + 1}`)
  return parts.join(' - ')
}

export function hasProductReviews(product) {
  return Number(product?.numReviews) >= 1 && Number(product?.rating) > 0
}

export function buildRelatedSearchChips(product, limit = 6) {
  const chips = []
  const seen = new Set()

  const add = (value) => {
    const label = String(value || '').trim()
    const key = label.toLowerCase()
    if (!label || seen.has(key) || label.length < 2) return
    seen.add(key)
    chips.push(label)
  }

  if (product?.category) add(product.category)
  const brand = getProductBrand(product)
  if (brand) add(brand)
  ;(product?.tags || []).forEach(add)

  const keywords = product?.seoKeywords || product?.tags || []
  if (Array.isArray(keywords)) keywords.forEach(add)

  return chips.slice(0, limit)
}
