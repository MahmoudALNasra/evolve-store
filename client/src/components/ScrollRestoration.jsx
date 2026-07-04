import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import {
  cacheScrollPosition,
  getCachedScrollPosition,
  pathCacheKey,
  restoreScrollPosition,
} from '../lib/scrollRestoration'

/**
 * Saves scroll per history entry and restores on browser back/forward.
 * New navigations (link clicks) scroll to top; returning via back restores prior position.
 */
export default function ScrollRestoration() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const prevRef = useRef({ key: location.key, pathname: location.pathname, search: location.search })
  const pendingRestoreRef = useRef(null)

  useEffect(() => {
    const prev = prevRef.current
    const prevPathKey = pathCacheKey(prev.pathname, prev.search)

    cacheScrollPosition(prev.key, window.scrollX, window.scrollY)
    cacheScrollPosition(prevPathKey, window.scrollX, window.scrollY)

    const pathKey = pathCacheKey(location.pathname, location.search)
    let saved = null

    if (navigationType === 'POP') {
      saved = getCachedScrollPosition(location.key) || getCachedScrollPosition(pathKey)
    }

    if (saved) {
      pendingRestoreRef.current = saved
      restoreScrollPosition(saved.x, saved.y)
    } else if (navigationType !== 'POP') {
      pendingRestoreRef.current = null
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }

    prevRef.current = {
      key: location.key,
      pathname: location.pathname,
      search: location.search,
    }
  }, [location.key, location.pathname, location.search, navigationType])

  useEffect(() => {
    const onRetry = () => {
      const saved = pendingRestoreRef.current
      if (saved) restoreScrollPosition(saved.x, saved.y)
    }

    window.addEventListener('evolve-scroll-restore-retry', onRetry)
    return () => window.removeEventListener('evolve-scroll-restore-retry', onRetry)
  }, [])

  useEffect(() => {
    const saveCurrent = () => {
      const pathKey = pathCacheKey(location.pathname, location.search)
      cacheScrollPosition(location.key, window.scrollX, window.scrollY)
      cacheScrollPosition(pathKey, window.scrollX, window.scrollY)
    }

    const onScroll = () => {
      window.clearTimeout(saveCurrent._t)
      saveCurrent._t = window.setTimeout(saveCurrent, 120)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(saveCurrent._t)
    }
  }, [location.key, location.pathname, location.search])

  return null
}
