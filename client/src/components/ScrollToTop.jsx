import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Resets scroll position to the top whenever the route pathname changes.
// React Router does NOT do this by default.
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])
  return null
}
