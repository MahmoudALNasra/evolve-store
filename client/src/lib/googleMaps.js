const MAPS_SCRIPT_ID = 'evolve-google-maps-places'

let loadPromise = null

export function getGoogleMapsApiKey() {
  return String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim()
}

export function hasGoogleMapsApiKey() {
  return Boolean(getGoogleMapsApiKey())
}

/** Load Maps JS + Places once. Resolves null when no API key is configured. */
export function loadGoogleMapsPlaces() {
  if (typeof window === 'undefined') return Promise.resolve(null)

  const key = getGoogleMapsApiKey()
  if (!key) return Promise.resolve(null)

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google)
  }

  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(MAPS_SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google))
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')))
      return
    }

    const script = document.createElement('script')
    script.id = MAPS_SCRIPT_ID
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly`
    script.onload = () => resolve(window.google)
    script.onerror = () => {
      loadPromise = null
      reject(new Error('Google Maps failed to load'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}

/**
 * Parse a Google Place result into our shipping address shape.
 */
export function placeToShippingAddress(place) {
  const components = place?.address_components || []
  const get = (type, useShort = false) => {
    const match = components.find((c) => c.types.includes(type))
    if (!match) return ''
    return useShort ? match.short_name : match.long_name
  }

  const streetNumber = get('street_number')
  const route = get('route')
  const line1 = [streetNumber, route].filter(Boolean).join(' ').trim()
    || place?.formatted_address?.split(',')[0]?.trim()
    || ''

  const line2 = get('subpremise')
  const city = get('locality')
    || get('sublocality')
    || get('neighborhood')
    || get('administrative_area_level_2')
  const state = get('administrative_area_level_1', true)
  const zip = get('postal_code')
  const zipSuffix = get('postal_code_suffix')
  const fullZip = zipSuffix ? `${zip}-${zipSuffix}` : zip

  return {
    line1,
    line2,
    city,
    state,
    zip: fullZip,
    country: 'United States',
  }
}
