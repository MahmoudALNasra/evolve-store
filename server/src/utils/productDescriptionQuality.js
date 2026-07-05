const MIN_WORDS = Number(process.env.PRODUCT_DESC_MIN_WORDS || 40)
const MIN_CHARS = Number(process.env.PRODUCT_DESC_MIN_CHARS || 120)

function countWords(text) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

function analyzeDescriptionQuality(product) {
  const description = String(product?.description || '').trim()
  const wordCount = countWords(description)
  const charCount = description.length
  const hasSeoMeta = Boolean(String(product?.seoMetaDescription || '').trim())
  const hasFaqs = Array.isArray(product?.seoFaqs) && product.seoFaqs.length > 0
  const hasDraft = Boolean(String(product?.descriptionDraft || '').trim())

  const reasons = []
  if (!description) reasons.push('empty')
  else if (wordCount < 10) reasons.push(`very_short_${wordCount}w`)
  else if (wordCount < MIN_WORDS) reasons.push(`thin_${wordCount}w`)
  else if (charCount < MIN_CHARS) reasons.push(`short_${charCount}c`)

  if (!hasSeoMeta) reasons.push('missing_seo_meta')
  if (!hasFaqs) reasons.push('missing_faqs')

  const needsOptimization = reasons.some((r) =>
    r.startsWith('empty')
    || r.startsWith('very_short')
    || r.startsWith('thin')
    || r.startsWith('short')
    || r === 'missing_seo_meta'
    || r === 'missing_faqs'
  )

  return {
    wordCount,
    charCount,
    hasSeoMeta,
    hasFaqs,
    hasDraft,
    needsOptimization,
    reasons,
    optimized: !needsOptimization,
  }
}

function needsDescriptionOptimization(product) {
  return analyzeDescriptionQuality(product).needsOptimization
}

module.exports = {
  MIN_WORDS,
  MIN_CHARS,
  countWords,
  analyzeDescriptionQuality,
  needsDescriptionOptimization,
}
