export const ZIP_KEY = 'evolve_ship_zip'
export const CITY_KEY = 'evolve_ship_city'
export const STATE_KEY = 'evolve_ship_state'
export const SOURCE_KEY = 'evolve_ship_source'

export function readStoredLocation() {
  try {
    return {
      zip: localStorage.getItem(ZIP_KEY) || '',
      city: localStorage.getItem(CITY_KEY) || '',
      state: localStorage.getItem(STATE_KEY) || '',
      source: localStorage.getItem(SOURCE_KEY) || 'manual',
    }
  } catch {
    return { zip: '', city: '', state: '', source: 'manual' }
  }
}

export function saveStoredLocation({ zip, city = '', state = '', source = 'manual' }) {
  try {
    localStorage.setItem(ZIP_KEY, zip)
    localStorage.setItem(CITY_KEY, city)
    localStorage.setItem(STATE_KEY, state)
    localStorage.setItem(SOURCE_KEY, source)
  } catch {
    /* ignore */
  }
}

export function getDefaultUserAddress(user) {
  const addresses = user?.addresses
  if (!Array.isArray(addresses) || !addresses.length) return null

  const withZip = addresses.find((addr) => /^\d{5}/.test(String(addr?.zip || '').trim()))
  const addr = withZip || addresses[0]
  const zip = String(addr?.zip || '').trim().slice(0, 5)
  if (!/^\d{5}$/.test(zip)) return null

  return {
    zip,
    city: String(addr.city || '').trim(),
    state: String(addr.state || '').trim(),
    source: 'account',
  }
}

export function formatShipLabel(location) {
  if (!location?.zip) return 'Enter ZIP to check'
  const place = [location.city, location.state].filter(Boolean).join(', ')
  return place ? `${place} ${location.zip}` : location.zip
}
