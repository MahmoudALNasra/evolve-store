import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Mail, Shield, Truck, RefreshCw, Pill, ArrowRightLeft } from 'lucide-react'
import Logo from './Logo'
import api from '../lib/api'
import toast from 'react-hot-toast'

export default function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterLoading, setNewsletterLoading] = useState(false)

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault()
    const email = newsletterEmail.trim()
    if (!email) return toast.error('Please enter your email')

    setNewsletterLoading(true)
    try {
      await api.post('/newsletter/subscribe', { email, source: 'footer' })
      setNewsletterEmail('')
      toast.success('You are subscribed to our newsletter')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Newsletter signup failed')
    } finally {
      setNewsletterLoading(false)
    }
  }

  return (
    <footer className="footer">
      <div className="footer-trust">
        <div className="footer-trust-inner">
          {[
            { icon: <Truck size={20} />, title: 'Free Shipping', desc: 'On all orders over $100' },
            { icon: <Shield size={20} />, title: 'Quality Guaranteed', desc: 'Third-party lab tested products' },
            { icon: <RefreshCw size={20} />, title: 'Easy Returns', desc: '30-day hassle-free returns' },
          ].map((f) => (
            <div key={f.title} className="footer-trust-item">
              <div className="footer-trust-icon">{f.icon}</div>
              <div>
                <div className="footer-trust-title">{f.title}</div>
                <div className="footer-trust-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="footer-main">
        <div>
          <Logo size={48} className="footer-brand" />
          <p className="footer-brand-desc">Premium health supplements and vitamins for your everyday wellness journey.</p>
          <a href="mailto:support@evolvepharmacy.com" className="footer-brand-email">
            <Mail size={13} /> support@evolvepharmacy.com
          </a>

          <div className="footer-rx-buttons">
            <Link to="/refill-prescription" className="footer-rx-btn footer-rx-btn-primary">
              <Pill size={14} /> Refill Prescription
            </Link>
            <Link to="/transfer-prescription" className="footer-rx-btn footer-rx-btn-secondary">
              <ArrowRightLeft size={14} /> Transfer Prescription
            </Link>
          </div>
        </div>

        <div className="footer-col">
          <h4>Shop</h4>
          <ul>
            <li><Link to="/shop">All Products</Link></li>
            <li><Link to="/shop?featured=true">Best Sellers</Link></li>
            <li><Link to="/shop?category=Vitamins">Vitamins</Link></li>
            <li><Link to="/shop?category=Supplements">Supplements</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Company</h4>
          <ul>
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/contact">Contact Us</Link></li>
            <li><Link to="/privacy-policy">Privacy Policy</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Support</h4>
          <ul>
            <li><Link to="/contact">Contact Us</Link></li>
            <li><Link to="/refill-prescription">Refill Prescription</Link></li>
            <li><Link to="/transfer-prescription">Transfer Prescription</Link></li>
            <li><Link to="/orders">My Orders</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Newsletter</h4>
          <p style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            Get wellness updates, pharmacy news, and promotions by email.
          </p>
          <form onSubmit={handleNewsletterSubmit} style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
            <input
              type="email"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="Email address"
              aria-label="Email address for newsletter"
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: 9,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={newsletterLoading}
              style={{
                padding: '11px 14px',
                borderRadius: 9,
                border: 0,
                background: '#c9a227',
                color: '#0d0d0d',
                fontWeight: 800,
                cursor: newsletterLoading ? 'not-allowed' : 'pointer',
                opacity: newsletterLoading ? 0.7 : 1,
              }}
            >
              {newsletterLoading ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Evolve Specialty Pharmacy & Wellness. All rights reserved.</span>
        <span>Made with care for your health 🌿</span>
      </div>
    </footer>
  )
}
