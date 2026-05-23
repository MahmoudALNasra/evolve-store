/**
 * Auto-generate product tags from name, description, and category.
 * Used when tags are empty (manual tags in admin are always kept).
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'with', 'from', 'to', 'of', 'in', 'on', 'at', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
  'it', 'its', 'your', 'our', 'their', 'they', 'them', 'you', 'we', 'as', 'if', 'but', 'not', 'no',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very',
  'just', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'into', 'over', 'after', 'before', 'between',
  'about', 'above', 'below', 'up', 'down', 'out', 'off', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'while', 'during', 'through', 'under',
  'help', 'helps', 'support', 'supports', 'provide', 'provides', 'including', 'include', 'includes',
  'made', 'make', 'made', 'using', 'use', 'used', 'designed', 'formulated', 'premium', 'quality',
  'natural', 'dietary', 'supplement', 'supplements', 'healthcare', 'health', 'wellness', 'product', 'products',
  'shop', 'buy', 'best', 'new', 'free', 'daily', 'per', 'serving', 'servings', 'size', 'count', 'ct',
  'tablets', 'tablet', 'capsules', 'capsule', 'caps', 'cap', 'bottle', 'bottles', 'powder', 'formula',
  'complex', 'blend', 'advanced', 'complete', 'comprehensive', 'high', 'potency', 'strength',
])

const MAX_TAGS = 6

function normalizeTag(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
}

function extractTokens(text) {
  if (!text || typeof text !== 'string') return []

  const lowered = text.toLowerCase()
  const tokens = []

  const unitMatches = lowered.match(/\b\d+\s?(?:mg|mcg|g|iu|ml|oz|lb)\b/g)
  if (unitMatches) tokens.push(...unitMatches.map((m) => m.replace(/\s+/g, '')))

  const words = lowered
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))

  tokens.push(...words)

  return tokens
}

function scoreTokens(nameTokens, descriptionTokens) {
  const scores = new Map()

  nameTokens.forEach((token, index) => {
    const weight = 3 - Math.min(index, 2)
    scores.set(token, (scores.get(token) || 0) + weight)
  })

  descriptionTokens.forEach((token) => {
    scores.set(token, (scores.get(token) || 0) + 1)
  })

  return scores
}

/**
 * @param {object} input
 * @param {string} input.name
 * @param {string} [input.description]
 * @param {string} [input.category]
 * @param {string[]} [input.tags] - if non-empty, returned normalized (manual override)
 * @returns {string[]}
 */
function generateProductTags({ name, description = '', category = '', tags = [] } = {}) {
  const manual = (Array.isArray(tags) ? tags : [])
    .map(normalizeTag)
    .filter(Boolean)

  if (manual.length > 0) {
    return [...new Set(manual)].slice(0, MAX_TAGS)
  }

  if (!name || typeof name !== 'string') return []

  const result = []
  const seen = new Set()

  const add = (raw) => {
    const tag = normalizeTag(raw)
    if (!tag || tag.length < 2 || seen.has(tag)) return
    seen.add(tag)
    result.push(tag)
  }

  const categoryTag = normalizeTag(category)
  if (categoryTag && categoryTag !== 'uncategorized') {
    add(categoryTag)
  }

  const nameTokens = extractTokens(name)
  const descriptionTokens = extractTokens(description)
  const scores = scoreTokens(nameTokens, descriptionTokens)

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)

  for (const token of ranked) {
    if (result.length >= MAX_TAGS) break
    add(token)
  }

  if (result.length < 3) {
    for (const token of nameTokens) {
      if (result.length >= MAX_TAGS) break
      add(token)
    }
  }

  return result.slice(0, MAX_TAGS)
}

module.exports = { generateProductTags, normalizeTag, MAX_TAGS }
