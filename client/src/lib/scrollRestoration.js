const STORAGE_KEY = 'evolve-scroll-cache'
const MAX_ENTRIES = 60

/** In-memory latest scroll per route — avoids overwriting with 0 after navigation. */
const liveScroll = new Map()

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

export function rememberScrollPosition(key, x, y) {
  if (!key) return
  liveScroll.set(key, { x, y, ts: Date.now() })

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

/** @deprecated use rememberScrollPosition */
export function cacheScrollPosition(key, x, y) {
  rememberScrollPosition(key, x, y)
}

export function getCachedScrollPosition(key) {
  if (!key) return null
  const live = liveScroll.get(key)
  if (live) return { x: live.x, y: live.y }
  const hit = loadCache()[key]
  return hit ? { x: hit.x, y: hit.y } : null
}

export function flushCurrentScroll(pathname, search, historyKey) {
  const x = window.scrollX
  const y = window.scrollY
  const pathKey = pathCacheKey(pathname, search)
  rememberScrollPosition(historyKey, x, y)
  rememberScrollPosition(pathKey, x, y)
}

export function notifyScrollRestorationReady() {
  window.dispatchEvent(new CustomEvent('evolve-scroll-restore-retry'))
}

export function restoreScrollPosition(x, y, { maxAttempts = 24, intervalMs = 50 } = {}) {
  let attempts = 0

  const tryRestore = () => {
    window.scrollTo({ left: x, top: y, behavior: 'auto' })

    const heightReady = document.documentElement.scrollHeight >= y + window.innerHeight * 0.2
    const closeEnough = Math.abs(window.scrollY - y) < 4

    if (closeEnough || attempts >= maxAttempts) return

    attempts += 1
    if (!heightReady) {
      window.setTimeout(tryRestore, intervalMs)
    } else {
      window.requestAnimationFrame(tryRestore)
    }
  }

  window.requestAnimationFrame(tryRestore)
}

export function canNavigateBack() {
  const idx = window.history.state?.idx
  return typeof idx === 'number' && idx > 0
}

export function initScrollRestoration() {
  if (typeof window === 'undefined') return
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual'
  }
}
