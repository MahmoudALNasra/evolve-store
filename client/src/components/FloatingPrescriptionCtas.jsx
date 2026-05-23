import { Link, useLocation } from 'react-router-dom'
import { ArrowRightLeft, Pill } from 'lucide-react'

const HIDDEN_PATHS = new Set(['/refill-prescription', '/transfer-prescription'])

export default function FloatingPrescriptionCtas() {
  const { pathname } = useLocation()
  if (HIDDEN_PATHS.has(pathname)) return null

  return (
    <div className="floating-rx-ctas" aria-label="Prescription services">
      <Link to="/transfer-prescription" className="floating-rx-btn floating-rx-btn-secondary">
        <ArrowRightLeft size={15} aria-hidden="true" />
        <span>Transfer Prescription</span>
      </Link>
      <Link to="/refill-prescription" className="floating-rx-btn floating-rx-btn-primary">
        <Pill size={15} aria-hidden="true" />
        <span>Refill Prescription</span>
      </Link>
      <div className="floating-rx-note">Compounding pharmacy services available</div>
    </div>
  )
}
