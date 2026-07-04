const STORAGE_KEY = 'evolve-scroll-cache'
const MAX_ENTRIES = 60

function loadCache() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveCache(cache) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    /* storage full — ignore */
  }
}

export function pathCacheKey(pathname, search = '') {
  return `${pathname}${search || ''}`
}

export function cacheScrollPosition(key, x, y) {
  if (!key) return
  const cache = loadCache()
  cache[key] = { x, y, ts: Date.now() }

  const keys = Object.keys(cache)
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((k) => delete cache[k])
  }

  saveCache(cache)
}

export function getCachedScrollPosition(key) {
  if (!key) return null
  const hit = loadCache()[key]
  return hit ? { x: hit.x, y: hit.y } : null
}

/** Call when async page content finishes loading so back-navigation can restore scroll. */
export function notifyScrollRestorationReady() {
  window.dispatchEvent(new CustomEvent('evolve-scroll-restore-retry'))
}

export function restoreScrollPosition(x, y, { maxAttempts = 12, intervalMs = 50 } = {}) {
  let attempts = 0

  const tryRestore = () => {
    window.scrollTo({ left: x, top: y, behavior: 'auto' })

    const heightReady = document.documentElement.scrollHeight >= y + window.innerHeight * 0.25
    const closeEnough = Math.abs(window.scrollY - y) < 4

    if (closeEnough || attempts >= maxAttempts) return
    if (!heightReady) {
      attempts += 1
      window.setTimeout(tryRestore, intervalMs)
      return
    }

    attempts += 1
    window.requestAnimationFrame(tryRestore)
  }

  window.requestAnimationFrame(tryRestore)
}

export function canNavigateBack() {
  const idx = window.history.state?.idx
  return typeof idx === 'number' && idx > 0
}
