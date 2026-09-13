const axios = require('axios')

function getMapsApiKey() {
  return String(
    process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      ''
  ).trim()
}

function isPlacesConfigured() {
  return Boolean(getMapsApiKey())
}

function parseAddressComponents(components = []) {
  const get = (type, useShort = false) => {
    const match = components.find((c) => Array.isArray(c.types) && c.types.includes(type))
    if (!match) return ''
    return useShort ? match.short_name : match.long_name
  }

  const streetNumber = get('street_number')
  const route = get('route')
  const line1 = [streetNumber, route].filter(Boolean).join(' ').trim()
  const line2 = get('subpremise')
  const city =
    get('locality') ||
    get('sublocality_level_1') ||
    get('neighborhood') ||
    get('administrative_area_level_2')
  const state = get('administrative_area_level_1', true)
  const zip = get('postal_code')
  const zipSuffix = get('postal_code_suffix')

  return {
    line1,
    line2,
    city,
    state,
    zip: zipSuffix ? `${zip}-${zipSuffix}` : zip,
    country: 'United States',
  }
}

/**
 * Google Places Autocomplete (legacy HTTP) — server-side so the key never ships to the browser.
 */
async function suggestAddresses(input, { sessionToken } = {}) {
  const key = getMapsApiKey()
  if (!key) {
    return { configured: false, suggestions: [] }
  }

  const q = String(input || '').trim()
  if (q.length < 3) {
    return { configured: true, suggestions: [] }
  }

  const params = {
    input: q,
    key,
    types: 'address',
    components: 'country:us',
    language: 'en',
  }
  if (sessionToken) params.sessiontoken = sessionToken

  const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
    params,
    timeout: 8000,
  })

  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    const err = new Error(data.error_message || `Places autocomplete failed: ${data.status}`)
    err.code = data.status
    if (/referer restrictions/i.test(String(data.error_message || ''))) {
      err.code = 'REFERER_RESTRICTED_KEY'
      err.message =
        'GOOGLE_MAPS_API_KEY is restricted by HTTP referrer. Create a server key restricted by IP (droplet IP), with Places API enabled.'
    }
    throw err
  }

  const suggestions = (data.predictions || []).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text || p.description,
    secondaryText: p.structured_formatting?.secondary_text || '',
  }))

  return { configured: true, suggestions }
}

async function getAddressDetails(placeId, { sessionToken } = {}) {
  const key = getMapsApiKey()
  if (!key) {
    const err = new Error('Google Maps is not configured')
    err.code = 'NOT_CONFIGURED'
    throw err
  }

  const params = {
    place_id: placeId,
    key,
    fields: 'address_component,formatted_address',
    language: 'en',
  }
  if (sessionToken) params.sessiontoken = sessionToken

  const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
    params,
    timeout: 8000,
  })

  if (data.status !== 'OK' || !data.result) {
    const err = new Error(data.error_message || `Place details failed: ${data.status}`)
    err.code = data.status
    throw err
  }

  const address = parseAddressComponents(data.result.address_components || [])
  if (!address.line1 && data.result.formatted_address) {
    address.line1 = String(data.result.formatted_address).split(',')[0].trim()
  }

  return {
    address,
    formattedAddress: data.result.formatted_address || '',
  }
}

function logPlacesStartupStatus() {
  if (isPlacesConfigured()) {
    console.log('Address autocomplete: Google Places configured (GOOGLE_MAPS_API_KEY)')
  } else {
    console.warn(
      'Address autocomplete: NOT configured — set GOOGLE_MAPS_API_KEY in server/.env and enable Places API'
    )
  }
}

module.exports = {
  isPlacesConfigured,
  suggestAddresses,
  getAddressDetails,
  parseAddressComponents,
  logPlacesStartupStatus,
}
