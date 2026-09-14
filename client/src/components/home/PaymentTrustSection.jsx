import { Link } from 'react-router-dom'
import { CreditCard, Landmark, Link2, Lock, RefreshCw, ShieldCheck } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import FadeContent from '@/components/ui/FadeContent'

const METHODS = [
  { icon: CreditCard, title: 'Credit & debit cards', desc: 'Visa, Mastercard, Amex, Discover and more via Stripe' },
  { icon: Link2, title: 'Stripe Link', desc: 'Faster checkout with saved Stripe Link details' },
  { icon: Landmark, title: 'Bank transfers', desc: 'Supported US bank / ACH methods when offered by Stripe' },
]

const PROMISES = [
  { icon: Lock, title: 'Secure payments', desc: 'Card data is encrypted and processed by Stripe — never stored on our servers.' },
  { icon: ShieldCheck, title: 'Protected checkout', desc: 'HTTPS, fraud tools, and PCI-compliant payment handling.' },
  { icon: RefreshCw, title: '14-day returns', desc: 'Eligible unopened items within 14 days — refund after we receive and inspect.' },
]

export default function PaymentTrustSection() {
  return (
    <section className="ev-home-section payment-trust-section">
      <div className="why-inner">
        <SectionTitle
          title="Secure Payments & Easy Returns"
          subtitle="Shop confidently with trusted payment methods and a clear pharmacy return policy"
          align="center"
        />

        <div className="why-grid" style={{ marginTop: 28 }}>
          {METHODS.map((m, i) => {
            const Icon = m.icon
            return (
              <FadeContent key={m.title} delay={i * 0.06} className="why-item">
                <div className="why-icon"><Icon size={22} aria-hidden="true" /></div>
                <div className="why-title">{m.title}</div>
                <div className="why-desc">{m.desc}</div>
              </FadeContent>
            )
          })}
        </div>

        <div className="why-grid" style={{ marginTop: 20 }}>
          {PROMISES.map((m, i) => {
            const Icon = m.icon
            return (
              <FadeContent key={m.title} delay={0.1 + i * 0.06} className="why-item">
                <div className="why-icon"><Icon size={22} aria-hidden="true" /></div>
                <div className="why-title">{m.title}</div>
                <div className="why-desc">{m.desc}</div>
              </FadeContent>
            )
          })}
        </div>

        <p className="checkout-hint" style={{ textAlign: 'center', marginTop: 24 }}>
          Opened or unsealed products are not eligible for return.{' '}
          <Link to="/return-policy" style={{ color: 'var(--brand-primary-light)' }}>
            Read the full return policy
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
