/**
 * Allowed browser origins for CORS (credentials).
 * Always includes CLIENT_URL, its www/apex twin, and optional CORS_ORIGINS.
 */
function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function wwwTwin(origin) {
  try {
    const url = new URL(origin)
    if (!url.hostname || url.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
      return null
    }
    if (url.hostname.startsWith('www.')) {
      return `${url.protocol}//${url.hostname.slice(4)}`
    }
    return `${url.protocol}//www.${url.hostname}`
  } catch {
    return null
  }
}

function getAllowedOrigins() {
  const allowed = new Set()
  const primary = normalizeOrigin(process.env.CLIENT_URL || 'http://localhost:5173')
  if (primary) allowed.add(primary)

  const twin = wwwTwin(primary)
  if (twin) allowed.add(twin)

  const site = normalizeOrigin(process.env.SITE_URL)
  if (site) {
    allowed.add(site)
    const siteTwin = wwwTwin(site)
    if (siteTwin) allowed.add(siteTwin)
  }

  String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean)
    .forEach((origin) => allowed.add(origin))

  return allowed
}

function corsOriginCallback(origin, callback) {
  // Non-browser / same-origin tools (no Origin header)
  if (!origin) return callback(null, true)

  const allowed = getAllowedOrigins()
  if (allowed.has(normalizeOrigin(origin))) {
    return callback(null, true)
  }
  return callback(null, false)
}

module.exports = {
  getAllowedOrigins,
  corsOriginCallback,
  normalizeOrigin,
}
