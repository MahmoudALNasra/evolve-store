const axios = require('axios')

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map()

async function lookupZip(zip) {
  const clean = String(zip || '').trim().slice(0, 5)
  if (!/^\d{5}$/.test(clean)) return null

  const cached = cache.get(clean)
  if (cached && Date.now() < cached.expiresAt) return cached.value

  try {
    const { data } = await axios.get(`https://api.zippopotam.us/us/${clean}`, {
      timeout: Number(process.env.ZIP_LOOKUP_TIMEOUT_MS || 4000),
    })
    const place = data?.places?.[0]
    if (!place) return null

    const value = {
      zip: clean,
      city: String(place['place name'] || '').trim(),
      state: String(place['state abbreviation'] || '').trim().toUpperCase(),
    }

    cache.set(clean, { value, expiresAt: Date.now() + CACHE_TTL_MS })
    return value
  } catch {
    return null
  }
}

async function resolveDestination({ zip, city, state }) {
  const cleanZip = String(zip || '').trim().slice(0, 5)
  if (!/^\d{5}$/.test(cleanZip)) return null

  let resolvedCity = String(city || '').trim()
  let resolvedState = String(state || '').trim().toUpperCase().slice(0, 2)

  if (!resolvedCity || !resolvedState) {
    const lookedUp = await lookupZip(cleanZip)
    if (lookedUp) {
      resolvedCity = resolvedCity || lookedUp.city
      resolvedState = resolvedState || lookedUp.state
    }
  }

  return {
    zip: cleanZip,
    city: resolvedCity,
    state: resolvedState,
  }
}

module.exports = {
  lookupZip,
  resolveDestination,
}
