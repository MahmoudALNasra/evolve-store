const path = require('path')

function getMediaRoot() {
  return process.env.MEDIA_ROOT || path.join(__dirname, '../../media')
}

function getPublicMediaBasePath() {
  const base = process.env.PUBLIC_MEDIA_BASE_PATH || '/media'
  return base.endsWith('/') ? base.slice(0, -1) : base
}

function getSiteOrigin() {
  const raw = process.env.SITE_URL || process.env.CLIENT_URL || 'http://localhost:5000'
  return raw.replace(/\/$/, '')
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

function buildLocalProductImageUrl(slug, filename) {
  return `${getSiteOrigin()}${getPublicMediaBasePath()}/products/${sanitizeSlug(slug)}/${filename}`
}

function isLocalProductMediaUrl(url) {
  if (!url || typeof url !== 'string') return false
  const base = `${getSiteOrigin()}${getPublicMediaBasePath()}/products/`
  if (url.startsWith(base)) return true
  const rel = `${getPublicMediaBasePath()}/products/`
  return url.startsWith(rel)
}

function localPathFromPublicUrl(url) {
  if (!url) return null
  const prefix = `${getPublicMediaBasePath()}/products/`
  const idx = url.indexOf(prefix)
  if (idx === -1) return null
  const rel = url.slice(idx + prefix.length)
  return path.join(getMediaRoot(), 'products', rel)
}

module.exports = {
  getMediaRoot,
  getPublicMediaBasePath,
  getSiteOrigin,
  sanitizeSlug,
  getProductMediaDir,
  buildLocalProductImageUrl,
  isLocalProductMediaUrl,
  localPathFromPublicUrl,
}
