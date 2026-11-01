import { useEffect, useRef } from 'react'
import useAnalytics from '../hooks/useAnalytics'
import { pushPhoneCall } from '../lib/gtm'

function phoneFromTelHref(href) {
  return String(href || '').replace(/^tel:/i, '').trim()
}

function labelFromTelLink(telLink) {
  return (telLink.getAttribute('aria-label') || telLink.textContent || 'Call Now')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

/** Auto page views + sampled click/scroll tracking for admin heatmaps. */
export default function AnalyticsTracker() {
  const { trackEvent } = useAnalytics()
  const lastClickRef = useRef(0)
  const lastScrollRef = useRef({ t: 0, depth: 0 })
  const lastPhoneRef = useRef(0)

  useEffect(() => {
    const trackTelClick = (telLink) => {
      if (!telLink) return
      const now = Date.now()
      if (now - lastPhoneRef.current < 800) return
      lastPhoneRef.current = now
      pushPhoneCall({
        phone: phoneFromTelHref(telLink.getAttribute('href')),
        label: labelFromTelLink(telLink),
        location: window.location.pathname,
      })
    }

    const onPointerDown = (event) => {
      // pointerdown fires before navigation / dialer handoff on mobile
      const telLink = event.target?.closest?.('a[href^="tel:"]')
      if (telLink) trackTelClick(telLink)
    }

    const onClick = (event) => {
      const telLink = event.target?.closest?.('a[href^="tel:"]')
      if (telLink) trackTelClick(telLink)

      const now = Date.now()
      if (now - lastClickRef.current < 400) return
      lastClickRef.current = now

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
      const scrollState = lastScrollRef.current
      if (now - scrollState.t < 2000) return

      const docHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
      const depth = Math.round((window.scrollY / docHeight) * 100)
      if (depth <= scrollState.depth) return

      scrollState.t = now
      scrollState.depth = depth
      trackEvent('scroll_depth', {
        depth,
        path: window.location.pathname,
      })
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('click', onClick, true)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('scroll', onScroll)
    }
  }, [trackEvent])

  return null
}
