import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import {
  flushCurrentScroll,
  getCachedScrollPosition,
  initScrollRestoration,
  pathCacheKey,
  rememberScrollPosition,
  restoreScrollPosition,
} from '../lib/scrollRestoration'

/**
 * Saves scroll per route and restores on browser back/forward.
 * New navigations scroll to top; back/forward returns to prior scroll position.
 */
export default function ScrollRestoration() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const prevRef = useRef({
    key: location.key,
    pathname: location.pathname,
    search: location.search,
  })
  const pendingRestoreRef = useRef(null)
  const isRestoringRef = useRef(false)

  useEffect(() => {
    initScrollRestoration()
  }, [])

  useEffect(() => {
    const prev = prevRef.current
    const prevPathKey = pathCacheKey(prev.pathname, prev.search)
    const pathKey = pathCacheKey(location.pathname, location.search)

    // Do NOT read window.scrollY here — it is already 0 on the new page and would wipe saved positions.

    let saved = null
    if (navigationType === 'POP') {
      saved = getCachedScrollPosition(location.key) || getCachedScrollPosition(pathKey)
    }

    if (saved && saved.y > 0) {
      isRestoringRef.current = true
      pendingRestoreRef.current = saved
      restoreScrollPosition(saved.x, saved.y)
      window.setTimeout(() => { isRestoringRef.current = false }, 600)
    } else if (navigationType !== 'POP') {
      pendingRestoreRef.current = null
      isRestoringRef.current = false
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
    const pathKey = pathCacheKey(location.pathname, location.search)

    const persist = () => {
      if (isRestoringRef.current) return
      const x = window.scrollX
      const y = window.scrollY
      rememberScrollPosition(location.key, x, y)
      rememberScrollPosition(pathKey, x, y)
    }

    const onScroll = () => {
      window.clearTimeout(persist._t)
      persist._t = window.setTimeout(persist, 80)
    }

    // Flush when leaving via link click (before navigation resets scroll)
    const onClick = (e) => {
      const anchor = e.target.closest('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      flushCurrentScroll(location.pathname, location.search, location.key)
    }

    const onPageHide = () => {
      flushCurrentScroll(location.pathname, location.search, location.key)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('click', onClick, true)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      flushCurrentScroll(location.pathname, location.search, location.key)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('pagehide', onPageHide)
      window.clearTimeout(persist._t)
    }
  }, [location.key, location.pathname, location.search])

  return null
}
