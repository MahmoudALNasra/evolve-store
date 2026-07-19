import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { trackAnalyticsEvent } from '../lib/analyticsApi'
import { captureUtmsFromSearch, getUtmsForPayload } from '../lib/analyticsUtm'
import { allowsAnalytics, getStoredConsent, onConsentChange } from '../lib/cookieConsent'

/**
 * First-party analytics: page_view on route change + manual trackEvent().
 * Only runs after the visitor accepts analytics cookies.
 */
export default function useAnalytics() {
  const location = useLocation()
  const lastPathKey = useRef(null)
  const utmInitialized = useRef(false)
  const [analyticsAllowed, setAnalyticsAllowed] = useState(() => allowsAnalytics(getStoredConsent()))

  useEffect(() => onConsentChange((consent) => {
    setAnalyticsAllowed(allowsAnalytics(consent))
  }), [])

  // Initial load + any navigation that includes new UTMs in the query string
  useEffect(() => {
    if (!analyticsAllowed) return
    captureUtmsFromSearch(location.search)
    utmInitialized.current = true
  }, [location.search, analyticsAllowed])

  const trackEvent = useCallback((eventName, eventData = {}) => {
    if (!allowsAnalytics()) return

    if (!utmInitialized.current) {
      captureUtmsFromSearch(window.location.search)
      utmInitialized.current = true
    }

    const utm = getUtmsForPayload()

    trackAnalyticsEvent({
      event_name: eventName,
      event_data: eventData,
      page_url: window.location.href,
      ...utm,
    })
  }, [])

  useEffect(() => {
    if (!analyticsAllowed) {
      lastPathKey.current = null
      return
    }

    const pathKey = `${location.pathname}${location.search}`
    if (lastPathKey.current === pathKey) return
    lastPathKey.current = pathKey

    trackEvent('page_view', {
      path: location.pathname,
      search: location.search,
      hash: location.hash,
    })
  }, [location.pathname, location.search, location.hash, trackEvent, analyticsAllowed])

  return { trackEvent }
}
