import { ShieldCheck, Truck, RotateCcw, Lock } from 'lucide-react'

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: 'Licensed pharmacy retailer' },
  { icon: Lock, label: 'Secure checkout' },
  { icon: Truck, label: 'Fast shipping' },
  { icon: RotateCcw, label: 'Quality guaranteed' },
]

export default function ProductTrustStrip() {
  return (
    <ul className="product-trust-strip" aria-label="Shopping guarantees">
      {TRUST_ITEMS.map(({ icon: Icon, label }) => (
        <li key={label}>
          <Icon size={16} aria-hidden="true" />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  )
}
