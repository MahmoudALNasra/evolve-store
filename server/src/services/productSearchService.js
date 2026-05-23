const Product = require('../models/Product')
const { minDistanceToText } = require('../utils/levenshtein')

const MAX_DISTANCE = 2
const MAX_CANDIDATES = 150
const DEFAULT_SUGGESTION_LIMIT = 8

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toSuggestion(product) {
  const image = product.images?.[0]?.url || ''
  return {
    id: String(product._id),
    slug: product.slug,
    name: product.name,
    category: product.category || '',
    price: product.price,
    image,
  }
}

function scoreProduct(query, product) {
  const nameDist = minDistanceToText(query, product.name, MAX_DISTANCE)
  const categoryDist = minDistanceToText(query, product.category, MAX_DISTANCE)
  const descDist = minDistanceToText(
    query,
    (product.description || '').slice(0, 280),
    MAX_DISTANCE
  )

  const distance = Math.min(nameDist, categoryDist, descDist)
  if (distance > MAX_DISTANCE) return null

  // Lower distance wins; name matches rank above category/description.
  const fieldWeight = nameDist <= MAX_DISTANCE ? 0 : categoryDist <= MAX_DISTANCE ? 1 : 2
  const textScore = product._textScore ?? 0

  return {
    product,
    distance,
    fieldWeight,
    textScore,
  }
}

async function fetchCandidates(query) {
  const escaped = escapeRegex(query)
  const prefix = escaped.slice(0, Math.min(3, escaped.length))
  const prefixRe = new RegExp(prefix, 'i')
  const containsRe = new RegExp(escaped, 'i')

  const baseFilter = { isPublished: true }
  const select = 'name slug description category price images'

  const queries = [
    Product.find(
      { ...baseFilter, $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .select(select)
      .sort({ score: { $meta: 'textScore' } })
      .limit(80)
      .lean(),
    Product.find({
      ...baseFilter,
      $or: [
        { name: prefixRe },
        { category: prefixRe },
        { name: containsRe },
        { category: containsRe },
        { description: containsRe },
      ],
    })
      .select(select)
      .limit(80)
      .lean(),
  ]

  const [textHits, regexHits] = await Promise.all(queries)

  const byId = new Map()
  for (const doc of [...textHits, ...regexHits]) {
    const id = String(doc._id)
    if (!byId.has(id)) {
      byId.set(id, { ...doc, _textScore: doc.score ?? 0 })
    } else if (doc.score != null) {
      const existing = byId.get(id)
      existing._textScore = Math.max(existing._textScore ?? 0, doc.score)
    }
  }

  return Array.from(byId.values()).slice(0, MAX_CANDIDATES)
}

/**
 * Typo-tolerant product search (Levenshtein distance <= 2 on name, description, category).
 */
async function searchProducts(query, { limit = DEFAULT_SUGGESTION_LIMIT, skip = 0 } = {}) {
  const q = String(query || '').trim().toLowerCase()
  if (q.length < 2) {
    return { suggestions: [], total: 0, query: q }
  }

  const cappedLimit = Math.min(Math.max(Number(limit) || DEFAULT_SUGGESTION_LIMIT, 1), 50)
  const candidates = await fetchCandidates(q)

  const ranked = candidates
    .map((product) => scoreProduct(q, product))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance
      if (a.fieldWeight !== b.fieldWeight) return a.fieldWeight - b.fieldWeight
      return (b.textScore || 0) - (a.textScore || 0)
    })

  const total = ranked.length
  const page = ranked.slice(skip, skip + cappedLimit).map(({ product }) => toSuggestion(product))

  return { suggestions: page, total, query: q }
}

function applyListingFilters(products, { category, minPrice, maxPrice, featured } = {}) {
  let list = products
  if (category) {
    const catRe = new RegExp(String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    list = list.filter((p) => catRe.test(p.category || ''))
  }
  if (minPrice != null && minPrice !== '') {
    list = list.filter((p) => p.price >= Number(minPrice))
  }
  if (maxPrice != null && maxPrice !== '') {
    list = list.filter((p) => p.price <= Number(maxPrice))
  }
  if (featured === 'true' || featured === true) {
    list = list.filter((p) => p.isFeatured)
  }
  return list
}

function sortProducts(products, sort = '-createdAt') {
  if (!sort || sort === '-createdAt') {
    return [...products].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    )
  }
  const desc = sort.startsWith('-')
  const field = desc ? sort.slice(1) : sort
  return [...products].sort((a, b) => {
    const av = a[field] ?? 0
    const bv = b[field] ?? 0
    if (av === bv) return 0
    return desc ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1)
  })
}

/**
 * Full product documents for shop listing (fuzzy search + pagination).
 */
async function searchProductsPaginated(query, {
  page = 1,
  limit = 20,
  sort = '-createdAt',
  category,
  minPrice,
  maxPrice,
  featured,
} = {}) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return { products: [], total: 0 }

  const candidates = await fetchCandidates(q)
  let ranked = candidates
    .map((product) => scoreProduct(q, product))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance
      if (a.fieldWeight !== b.fieldWeight) return a.fieldWeight - b.fieldWeight
      return (b.textScore || 0) - (a.textScore || 0)
    })
    .map(({ product }) => product)

  ranked = applyListingFilters(ranked, { category, minPrice, maxPrice, featured })

  if (sort && sort !== '-createdAt') {
    ranked = sortProducts(ranked, sort)
  }

  const total = ranked.length
  const skip = (Number(page) - 1) * Number(limit)
  const pageItems = ranked.slice(skip, skip + Number(limit))

  if (!pageItems.length) return { products: [], total: 0 }

  const ids = pageItems.map((p) => p._id)
  const products = await Product.find({ _id: { $in: ids } }).lean()
  const order = new Map(ids.map((id, i) => [String(id), i]))
  products.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)))

  return { products, total }
}

module.exports = {
  searchProducts,
  searchProductsPaginated,
  MAX_DISTANCE,
}
