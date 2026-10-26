import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRightLeft, Navigation, Phone, Pill } from 'lucide-react'
import { PHARMACY_DIRECTIONS_URL, PHARMACY_PHONE_DISPLAY, PHARMACY_PHONE_TEL } from '../lib/pharmacyContact'

const HIDDEN_PATHS = new Set(['/refill-prescription', '/transfer-prescription'])
const LABEL_PEEK_MS = 3800
const PEEK_SESSION_KEY = 'evolve-rx-cta-peeked'

function peekAlreadyShown() {
  try {
    return sessionStorage.getItem(PEEK_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function markPeekShown() {
  try {
    sessionStorage.setItem(PEEK_SESSION_KEY, '1')
  } catch {
    /* private mode */
  }
}

export default function FloatingPrescriptionCtas() {
  const { pathname } = useLocation()
  const [showLabels, setShowLabels] = useState(false)

  useEffect(() => {
    if (HIDDEN_PATHS.has(pathname)) {
      setShowLabels(false)
      return undefined
    }

    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (!isMobile || pathname !== '/' || peekAlreadyShown()) {
      setShowLabels(false)
      return undefined
    }

    markPeekShown()
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
      <a
        href={`tel:${PHARMACY_PHONE_TEL}`}
        className="floating-rx-btn floating-rx-btn-call"
        aria-label={`Call pharmacy at ${PHARMACY_PHONE_DISPLAY}`}
      >
        <Phone size={15} aria-hidden="true" />
        <span>Call Now</span>
      </a>
      <a
        href={PHARMACY_DIRECTIONS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-rx-btn floating-rx-btn-directions"
        aria-label="Get directions to the pharmacy"
      >
        <Navigation size={15} aria-hidden="true" />
        <span>Get directions</span>
      </a>
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
