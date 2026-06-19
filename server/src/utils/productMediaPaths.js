const path = require('path')

function getMediaRoot() {
  return process.env.MEDIA_ROOT || path.join(__dirname, '../../media')
}

function getPublicMediaBasePath() {
  const base = process.env.PUBLIC_MEDIA_BASE_PATH || '/media'
  return base.endsWith('/') ? base.slice(0, -1) : base
}

function getSiteOrigin() {
  const raw = process.env.PUBLIC_MEDIA_URL
    || process.env.SITE_URL
    || process.env.CLIENT_URL
    || 'http://localhost:5000'
  return raw.replace(/\/$/, '')
}

function getRelativeProductMediaPrefix() {
  return `${getPublicMediaBasePath()}/products/`
}

function buildLocalProductImageUrl(slug, filename) {
  // Relative path — works on IP today and evolvepharmacy.com after DNS cutover
  return `${getRelativeProductMediaPrefix()}${sanitizeSlug(slug)}/${filename}`
}

function isLocalProductMediaUrl(url) {
  if (!url || typeof url !== 'string') return false
  const rel = getRelativeProductMediaPrefix()
  if (url.startsWith(rel)) return true
  // Legacy rows saved with full https://…/media/products/… URLs
  if (url.includes(`${rel}`)) return true
  return false
}

function localPathFromPublicUrl(url) {
  if (!url) return null
  const prefix = getRelativeProductMediaPrefix()
  const idx = url.indexOf(prefix)
  if (idx === -1) return null
  const rel = url.slice(idx + prefix.length)
  return path.join(getMediaRoot(), 'products', rel)
}

/** Absolute URL for sitemaps, Google Merchant, JSON-LD (uses SITE_URL / PUBLIC_MEDIA_URL). */
function toAbsoluteMediaUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  const origin = getSiteOrigin()
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`
}

function sanitizeSlug(value) {
  return String(value || 'product')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'product'
}

function getProductMediaDir(slug) {
  return path.join(getMediaRoot(), 'products', sanitizeSlug(slug))
}

module.exports = {
  getMediaRoot,
  getPublicMediaBasePath,
  getSiteOrigin,
  getRelativeProductMediaPrefix,
  sanitizeSlug,
  getProductMediaDir,
  buildLocalProductImageUrl,
  isLocalProductMediaUrl,
  localPathFromPublicUrl,
  toAbsoluteMediaUrl,
}
