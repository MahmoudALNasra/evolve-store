import useAnalytics from '../hooks/useAnalytics'

/** Mount inside BrowserRouter to auto-track page_view on navigation. */
export default function AnalyticsTracker() {
  useAnalytics()
  return null
}
