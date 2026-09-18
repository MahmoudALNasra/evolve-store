import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRightLeft, Pill } from 'lucide-react'

const HIDDEN_PATHS = new Set(['/refill-prescription', '/transfer-prescription'])
const LABEL_PEEK_MS = 3800

export default function FloatingPrescriptionCtas() {
  const { pathname } = useLocation()
  const [showLabels, setShowLabels] = useState(false)

  useEffect(() => {
    if (HIDDEN_PATHS.has(pathname)) {
      setShowLabels(false)
      return undefined
    }

    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (!isMobile) {
      setShowLabels(false)
      return undefined
    }

    // Peek labels on every page change so users learn what the icons mean
    setShowLabels(true)
    const timer = window.setTimeout(() => setShowLabels(false), LABEL_PEEK_MS)
    return () => window.clearTimeout(timer)
  }, [pathname])

  if (HIDDEN_PATHS.has(pathname)) return null

  return (
    <div
      className={`floating-rx-ctas${showLabels ? ' is-label-peek' : ''}`}
      aria-label="Prescription services"
    >
      <Link
        to="/transfer-prescription"
        className="floating-rx-btn floating-rx-btn-secondary"
        aria-label="Transfer Prescription"
      >
        <ArrowRightLeft size={15} aria-hidden="true" />
        <span>Transfer Prescription</span>
      </Link>
      <Link
        to="/refill-prescription"
        className="floating-rx-btn floating-rx-btn-primary"
        aria-label="Refill Prescription"
      >
        <Pill size={15} aria-hidden="true" />
        <span>Refill Prescription</span>
      </Link>
      <div className="floating-rx-note">Compounding pharmacy services available</div>
    </div>
  )
}
