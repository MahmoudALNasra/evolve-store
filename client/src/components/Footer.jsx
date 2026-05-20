import { Link } from 'react-router-dom'
import { Leaf, Mail, Shield, Truck, RefreshCw, Pill, ArrowRightLeft } from 'lucide-react'

export default function Footer() {
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
          <Link to="/" className="footer-brand-logo">
            <div className="footer-brand-icon"><Leaf size={17} /></div>
            <span className="footer-brand-name">Evolve<span>Pharmacy</span></span>
          </Link>
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
          <h4>Account</h4>
          <ul>
            <li><Link to="/login">Sign In</Link></li>
            <li><Link to="/register">Create Account</Link></li>
            <li><Link to="/orders">My Orders</Link></li>
            <li><Link to="/account">My Account</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Support</h4>
          <ul>
            <li><a href="mailto:support@evolvepharmacy.com">Contact Us</a></li>
            <li><Link to="/refill-prescription">Refill Prescription</Link></li>
            <li><Link to="/transfer-prescription">Transfer Prescription</Link></li>
            <li><Link to="/privacy-policy">Privacy Policy</Link></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Evolve Pharmacy. All rights reserved.</span>
        <span>Made with care for your health 🌿</span>
      </div>
    </footer>
  )
}
