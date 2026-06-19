/** Shared SEO string helpers — mirrors client/src/lib/seoUtils.js */

const SEO_TITLE_SUFFIX = ' | Evolve Pharmacy'
const SEO_TITLE_SUFFIX_SHORT = ' | Evolve'
const SEO_STORE_SHORT = 'Evolve Pharmacy'

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function generateSEOTitle(productName, maxLength = 60, customSuffix) {
  const name = String(productName || '').trim()
  if (!name) return SEO_STORE_SHORT

  const suffixes = customSuffix ? [customSuffix] : [SEO_TITLE_SUFFIX, SEO_TITLE_SUFFIX_SHORT]

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

function generateMetaDescription(sourceText, maxLength = 155) {
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

function getProductBrand(product) {
  if (product?.brand?.trim()) return product.brand.trim()
  const tags = Array.isArray(product?.tags) ? product.tags : []
  const brandTag = tags.find((t) => /health|nature|sense|designs|mason|good/i.test(t))
  if (brandTag) return brandTag
  const name = String(product?.name || '')
  const match = name.match(/^([^,]+(?:For Health|Natural|Sense|Health))/i)
  return match ? match[1].trim() : ''
}

function hasProductReviews(product) {
  return Number(product?.numReviews) >= 1 && Number(product?.rating) > 0
}

module.exports = {
  SEO_TITLE_SUFFIX,
  SEO_STORE_SHORT,
  stripHtml,
  generateSEOTitle,
  generateMetaDescription,
  getProductBrand,
  hasProductReviews,
}
