import { ShieldCheck, Truck, RotateCcw, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: 'Licensed pharmacy retailer' },
  { icon: Lock, label: 'Secure Stripe payments' },
  { icon: Truck, label: 'Fast UPS shipping' },
  { icon: RotateCcw, label: '14-day returns', to: '/return-policy' },
]

export default function ProductTrustStrip() {
  return (
    <ul className="product-trust-strip" aria-label="Shopping guarantees">
      {TRUST_ITEMS.map(({ icon: Icon, label, to }) => (
        <li key={label}>
          <Icon size={16} aria-hidden="true" />
          {to ? <Link to={to}>{label}</Link> : <span>{label}</span>}
        </li>
      ))}
    </ul>
  )
}
