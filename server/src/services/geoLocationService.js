const axios = require('axios')

const CACHE_TTL_MS = 15 * 60 * 1000
const cache = new Map()

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) return String(forwarded).split(',')[0].trim()
  return req.socket?.remoteAddress || req.ip || ''
}

function isPrivateIp(ip) {
  if (!ip) return true
  const normalized = ip.replace(/^::ffff:/, '')
  if (normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost') return true
  if (normalized.startsWith('10.')) return true
  if (normalized.startsWith('192.168.')) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true
  return false
}

function normalizeZip(value) {
  const zip = String(value || '').trim()
  if (/^\d{5}(-\d{4})?$/.test(zip)) return zip.slice(0, 5)
  return ''
}

function getDefaultAddressFromUser(user) {
  const addresses = user?.addresses
  if (!Array.isArray(addresses) || !addresses.length) return null

  const withZip = addresses.find((addr) => normalizeZip(addr?.zip))
  const addr = withZip || addresses[0]
  const zip = normalizeZip(addr?.zip)
  if (!zip) return null

  return {
    zip,
    city: String(addr.city || '').trim(),
    state: String(addr.state || '').trim(),
    source: 'account',
  }
}

async function lookupIpLocation(ip) {
  if (isPrivateIp(ip)) return null

  const cached = cache.get(ip)
  if (cached && Date.now() < cached.expiresAt) return cached.value

  try {
    const { data } = await axios.get(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      timeout: Number(process.env.GEO_LOOKUP_TIMEOUT_MS || 4000),
    })

    if (!data?.success || data.country_code !== 'US') return null

    const zip = normalizeZip(data.postal)
    if (!zip) return null

    const value = {
      zip,
      city: String(data.city || '').trim(),
      state: String(data.region_code || data.region || '').trim(),
      source: 'ip',
    }

    cache.set(ip, { value, expiresAt: Date.now() + CACHE_TTL_MS })
    return value
  } catch {
    return null
  }
}

async function guessShipLocation(req) {
  const account = req.user ? getDefaultAddressFromUser(req.user) : null
  if (account) return account

  const ip = getClientIp(req)
  const ipLocation = await lookupIpLocation(ip)
  if (ipLocation) return ipLocation

  return null
}

module.exports = {
  getClientIp,
  getDefaultAddressFromUser,
  guessShipLocation,
}
