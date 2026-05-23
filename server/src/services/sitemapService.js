const Product = require('../models/Product')
const escapeXml = require('../utils/escapeXml')
const { getSiteOrigin, getProductUrl } = require('../utils/productSeoServer')

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const cache = {
  xml: null,
  expiresAt: 0,
}

/** Core storefront paths (not from MongoDB). */
const STATIC_PATHS = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/shop', changefreq: 'daily', priority: '0.9' },
]

function formatLastmod(date) {
  if (!date) return new Date().toISOString().slice(0, 10)
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

function buildUrlEntry(loc, lastmod, changefreq, priority) {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
    `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
    `    <priority>${escapeXml(priority)}</priority>`,
    '  </url>',
  ].join('\n')
}

async function fetchPublishedProducts() {
  return Product.find({
    isPublished: true,
    slug: { $exists: true, $nin: [null, ''] },
  })
    .select('slug updatedAt')
    .sort({ updatedAt: -1 })
    .lean()
}

async function buildSitemapXml() {
  const origin = getSiteOrigin()
  const now = formatLastmod(new Date())
  const products = await fetchPublishedProducts()
  const entries = []

  for (const { path, changefreq, priority } of STATIC_PATHS) {
    entries.push(buildUrlEntry(`${origin}${path}`, now, changefreq, priority))
  }

  for (const product of products) {
    const loc = getProductUrl(product)
    const lastmod = formatLastmod(product.updatedAt)
    entries.push(buildUrlEntry(loc, lastmod, 'weekly', '0.8'))
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
  ].join('\n')
}

function isCacheValid() {
  return cache.xml && Date.now() < cache.expiresAt
}

/**
 * Returns cached sitemap XML or rebuilds from MongoDB (24h TTL).
 */
async function getSitemapXml({ forceRefresh = false } = {}) {
  if (!forceRefresh && isCacheValid()) {
    return cache.xml
  }

  const xml = await buildSitemapXml()
  cache.xml = xml
  cache.expiresAt = Date.now() + CACHE_TTL_MS
  return xml
}

function clearSitemapCache() {
  cache.xml = null
  cache.expiresAt = 0
}

module.exports = {
  getSitemapXml,
  clearSitemapCache,
  buildSitemapXml,
  CACHE_TTL_MS,
}
