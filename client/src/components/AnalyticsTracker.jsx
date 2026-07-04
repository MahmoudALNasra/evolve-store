import { useEffect } from 'react'
import useAnalytics from '../hooks/useAnalytics'

/** Auto page views + sampled click/scroll tracking for admin heatmaps. */
export default function AnalyticsTracker() {
  const { trackEvent } = useAnalytics()
  const lastClickRef = { t: 0 }
  const lastScrollRef = { t: 0, depth: 0 }

  useEffect(() => {
    const onClick = (event) => {
      const now = Date.now()
      if (now - lastClickRef.t < 400) return
      lastClickRef.t = now

      const docHeight = Math.max(document.documentElement.scrollHeight, 1)
      const xPct = (event.clientX / Math.max(window.innerWidth, 1)) * 100
      const yPct = ((event.clientY + window.scrollY) / docHeight) * 100

      trackEvent('click', {
        x_pct: Number(xPct.toFixed(1)),
        y_pct: Number(yPct.toFixed(1)),
        tag: event.target?.tagName || '',
        path: window.location.pathname,
      })
    }

    const onScroll = () => {
      const now = Date.now()
      if (now - lastScrollRef.t < 2000) return

      const docHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
      const depth = Math.round((window.scrollY / docHeight) * 100)
      if (depth <= lastScrollRef.depth) return

      lastScrollRef.t = now
      lastScrollRef.depth = depth
      trackEvent('scroll_depth', {
        depth,
        path: window.location.pathname,
      })
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('scroll', onScroll)
    }
  }, [trackEvent])

  return null
}
