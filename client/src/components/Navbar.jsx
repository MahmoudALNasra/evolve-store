import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, User, Menu, X } from 'lucide-react'
import useAuthStore from '../store/useAuthStore'
import useCartStore from '../store/useCartStore'
import Logo from './Logo'
import SearchBar from './SearchBar'

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const items = useCartStore((s) => s.items)
  const openCart = useCartStore((s) => s.openCart)
  const cartCount = items.reduce((s, i) => s + i.quantity, 0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  // Close user dropdown on outside click / escape (touch-friendly)
  useEffect(() => {
    if (!userMenuOpen) return
    const onDocClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setUserMenuOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('touchstart', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('touchstart', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [userMenuOpen])

  const closeAll = () => { setMenuOpen(false); setUserMenuOpen(false) }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Logo size={42} className="navbar-brand" />

        <SearchBar />

        <div className="navbar-actions">
          <Link to="/shop" className="navbar-link">Shop</Link>
          <Link to="/blog" className="navbar-link">Blog</Link>
          <Link to="/about" className="navbar-link">About</Link>
          <Link to="/contact" className="navbar-link">Contact</Link>

          <button type="button" onClick={openCart} className="navbar-cart-btn" aria-label="Open cart">
            <ShoppingCart size={21} />
            {cartCount > 0 && <span className="navbar-cart-badge">{cartCount}</span>}
          </button>

          {user ? (
            <div className={`navbar-user${userMenuOpen ? ' open' : ''}`} ref={userMenuRef}>
              <button
                className="navbar-user-btn"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <div className="navbar-avatar">
                  {user.avatar ? <img src={user.avatar} alt={user.name} /> : user.name?.[0]?.toUpperCase()}
                </div>
                <span>{user.name?.split(' ')[0]}</span>
              </button>
              <div className="navbar-dropdown" role="menu">
                <div className="navbar-dropdown-header">
                  <div className="navbar-dropdown-name">{user.name}</div>
                  <div className="navbar-dropdown-email">{user.email}</div>
                </div>
                <Link to="/account" onClick={() => setUserMenuOpen(false)}>My Account</Link>
                <Link to="/orders" onClick={() => setUserMenuOpen(false)}>My Orders</Link>
                {user.role === 'admin' && <Link to="/admin" onClick={() => setUserMenuOpen(false)}>Admin Panel</Link>}
                <hr className="navbar-dropdown-divider" />
                <button className="dropdown-danger" onClick={() => { setUserMenuOpen(false); logout() }}>Sign Out</button>
              </div>
            </div>
          ) : (
            <Link to="/login" className="navbar-signin">
              <User size={15} />
              <span>Sign In</span>
            </Link>
          )}

          <button className="navbar-mobile-toggle" onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="navbar-mobile-menu">
          <SearchBar className="navbar-search--mobile" inputProps={{ style: { width: '100%' } }} onNavigate={closeAll} />
          <Link to="/shop" onClick={closeAll}>Shop All Products</Link>
          <Link to="/about" onClick={closeAll}>About Us</Link>
          <Link to="/contact" onClick={closeAll}>Contact Us</Link>
          <button
            onClick={() => { closeAll(); openCart() }}
            style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 7, fontSize: 14, fontWeight: 500, color: '#374151', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Cart ({cartCount})
          </button>
          {user ? (
            <>
              <Link to="/account" onClick={closeAll}>My Account</Link>
              <Link to="/orders" onClick={closeAll}>My Orders</Link>
              {user.role === 'admin' && <Link to="/admin" onClick={closeAll}>Admin Panel</Link>}
              <button
                onClick={() => { closeAll(); logout() }}
                style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 7, fontSize: 14, fontWeight: 500, color: '#d93025', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={closeAll}>Sign In</Link>
              <Link to="/register" onClick={closeAll}>Create Account</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
