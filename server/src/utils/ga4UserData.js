const crypto = require('crypto')

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

/** SHA-256 hex digest (GA4 / Google Ads enhanced measurement format). */
function sha256Hex(value) {
  if (!value) return null
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex')
}

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null
  let normalized = email.trim().toLowerCase()
  const at = normalized.indexOf('@')
  if (at === -1) return normalized

  const local = normalized.slice(0, at)
  const domain = normalized.slice(at + 1)
  if (GMAIL_DOMAINS.has(domain)) {
    normalized = `${local.replace(/\./g, '')}@${domain}`
  }
  return normalized
}

function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return digits.startsWith('+') ? `+${digits.replace(/^\+/, '')}` : `+${digits}`
}

function normalizeName(value) {
  if (!value || typeof value !== 'string') return null
  return value
    .trim()
    .toLowerCase()
    .replace(/[0-9!@#$%^&*()_+=[\]{};':"\\|,.<>/?`~\-]/g, '')
    .replace(/\s+/g, ' ')
}

function normalizeStreet(value) {
  if (!value || typeof value !== 'string') return null
  return value
    .trim()
    .toLowerCase()
    .replace(/[!@#$%^&*()_+=[\]{};':"\\|,.<>/?`~]/g, '')
    .replace(/\s+/g, ' ')
}

function hashNormalized(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return null
  return sha256Hex(normalized)
}

function hashEmail(email) {
  const normalized = normalizeEmail(email)
  return normalized ? hashNormalized(normalized) : null
}

function hashPhone(phone) {
  const normalized = normalizePhone(phone)
  return normalized ? hashNormalized(normalized) : null
}

/** Hash IP for custom diagnostics; GA4 geo matching uses plain `ip_override` instead. */
function hashIpAddress(ip) {
  const normalized = normalizeIp(ip)
  return normalized ? hashNormalized(normalized) : null
}

function hashUserAgent(userAgent) {
  const normalized = userAgent?.trim()
  return normalized ? hashNormalized(normalized) : null
}

function normalizeIp(ip) {
  if (!ip || typeof ip !== 'string') return null
  const trimmed = ip.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('::ffff:')) return trimmed.slice(7)
  return trimmed
}

/**
 * Build GA4 Measurement Protocol `user_data` with hashed PII.
 * @see https://developers.google.com/analytics/devguides/collection/ga4/uid-data
 */
function buildGa4UserData({ email, phone, shippingAddress, name }) {
  const userData = {}
  const emailHash = hashEmail(email)
  if (emailHash) userData.sha256_email_address = [emailHash]

  const phoneHash = hashPhone(phone)
  if (phoneHash) userData.sha256_phone_number = [phoneHash]

  const addr = shippingAddress || {}
  const addressEntry = {}
  if (name) {
    const parts = name.trim().split(/\s+/)
    const first = hashNormalized(normalizeName(parts[0]))
    const last =
      parts.length > 1 ? hashNormalized(normalizeName(parts.slice(1).join(' '))) : null
    if (first) addressEntry.sha256_first_name = first
    if (last) addressEntry.sha256_last_name = last
  }
  const streetHash = hashNormalized(normalizeStreet(addr.line1))
  if (streetHash) addressEntry.sha256_street = streetHash
  if (addr.city) addressEntry.city = addr.city.trim().toLowerCase()
  if (addr.state) addressEntry.region = addr.state.trim().toLowerCase()
  if (addr.zip) addressEntry.postal_code = addr.zip.trim().replace(/[.~]/g, '')
  if (addr.country) addressEntry.country = (addr.country || 'US').trim().toUpperCase().slice(0, 2)

  if (Object.keys(addressEntry).length > 0) {
    userData.address = [addressEntry]
  }

  return Object.keys(userData).length > 0 ? userData : undefined
}

/** Lightweight UA → GA4 `device` hints (browser name/version). */
function parseDeviceFromUserAgent(userAgent) {
  if (!userAgent) return undefined
  const ua = userAgent
  const device = { category: /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop' }

  const chrome = ua.match(/Chrome\/([\d.]+)/)
  const firefox = ua.match(/Firefox\/([\d.]+)/)
  const safari = ua.match(/Version\/([\d.]+).*Safari/)
  const edge = ua.match(/Edg\/([\d.]+)/)

  if (edge) {
    device.browser = 'Edge'
    device.browser_version = edge[1]
  } else if (chrome && !/Edg\//.test(ua)) {
    device.browser = 'Chrome'
    device.browser_version = chrome[1]
  } else if (firefox) {
    device.browser = 'Firefox'
    device.browser_version = firefox[1]
  } else if (safari) {
    device.browser = 'Safari'
    device.browser_version = safari[1]
  }

  return Object.keys(device).length > 0 ? device : undefined
}

function getClientIp(req) {
  if (!req) return null
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim()
    if (first) return normalizeIp(first)
  }
  return normalizeIp(req.ip || req.socket?.remoteAddress)
}

module.exports = {
  sha256Hex,
  hashEmail,
  hashPhone,
  hashIpAddress,
  hashUserAgent,
  normalizeIp,
  buildGa4UserData,
  parseDeviceFromUserAgent,
  getClientIp,
}
