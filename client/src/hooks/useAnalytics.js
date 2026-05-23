import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackAnalyticsEvent } from '../lib/analyticsApi'
import { captureUtmsFromSearch, getUtmsForPayload } from '../lib/analyticsUtm'

/**
 * First-party analytics: page_view on route change + manual trackEvent().
 * UTM params from the landing URL are stored in sessionStorage and sent on every event.
 */
export default function useAnalytics() {
  const location = useLocation()
  const lastPathKey = useRef(null)
  const utmInitialized = useRef(false)

  // Initial load + any navigation that includes new UTMs in the query string
  useEffect(() => {
    captureUtmsFromSearch(location.search)
    utmInitialized.current = true
  }, [location.search])

  const trackEvent = useCallback((eventName, eventData = {}) => {
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
    const pathKey = `${location.pathname}${location.search}`
    if (lastPathKey.current === pathKey) return
    lastPathKey.current = pathKey

    trackEvent('page_view', {
      path: location.pathname,
      search: location.search,
      hash: location.hash,
    })
  }, [location.pathname, location.search, location.hash, trackEvent])

  return { trackEvent }
}
