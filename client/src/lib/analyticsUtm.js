const UTM_STORAGE_KEY = 'estore_analytics_utm'

export const UTM_PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
]

/** Parse UTM params from a query string (e.g. location.search). */
export function parseUtmsFromSearch(search) {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const utm = {}
  let found = false

  for (const key of UTM_PARAM_KEYS) {
    const value = params.get(key)?.trim()
    if (value) {
      utm[key] = value
      found = true
    }
  }

  return found ? utm : null
}

/** Persist UTM object in sessionStorage (tab-scoped). */
export function saveUtmsToSession(utm) {
  try {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm))
  } catch {
    // Private mode / quota — ignore
  }
}

/** Read stored UTM params; returns {} if none. */
export function getStoredUtms() {
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const utm = {}
    for (const key of UTM_PARAM_KEYS) {
      if (typeof parsed[key] === 'string' && parsed[key]) utm[key] = parsed[key]
    }
    return utm
  } catch {
    return {}
  }
}

/**
 * If the URL contains UTMs, save them; otherwise return whatever is already stored.
 */
export function captureUtmsFromSearch(search) {
  const fromUrl = parseUtmsFromSearch(search)
  if (fromUrl) {
    saveUtmsToSession(fromUrl)
    return fromUrl
  }
  return getStoredUtms()
}

/** Flat object for analytics POST body (only defined keys). */
export function getUtmsForPayload() {
  return getStoredUtms()
}
