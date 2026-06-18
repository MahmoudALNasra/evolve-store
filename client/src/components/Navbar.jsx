import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { ShoppingCart, User, Menu, X } from 'lucide-react'
import useAuthStore from '../store/useAuthStore'
import useCartStore from '../store/useCartStore'
import Logo from './Logo'
import SearchBar from './SearchBar'

function navLinkClass({ isActive }) {
  return `navbar-link${isActive ? ' navbar-link--active' : ''}`
}

export default function Navbar() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const isShopRoute = pathname === '/shop' || pathname.startsWith('/product')
  const { user, logout } = useAuthStore()
  const items = useCartStore((s) => s.items)
  const openCart = useCartStore((s) => s.openCart)
  const cartCount = items.reduce((s, i) => s + i.quantity, 0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const userMenuRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const closeAll = () => { setMenuOpen(false); setUserMenuOpen(false) }

  const navbarClass = [
    'navbar',
    isHome && !scrolled ? 'navbar--transparent' : 'navbar--solid',
    scrolled ? 'navbar--scrolled' : '',
  ].filter(Boolean).join(' ')

  const mobileLinks = [
    { to: '/shop', label: 'Shop All Products', end: false },
    { to: '/blog', label: 'Blog', end: false },
    { to: '/about', label: 'About Us', end: true },
    { to: '/contact', label: 'Contact Us', end: true },
  ]

  return (
    <nav className={navbarClass}>
      <div className="navbar-inner">
        <Logo size={42} className="navbar-brand" />

        <SearchBar />

        <div className="navbar-actions">
          <NavLink
            to="/shop"
            className={({ isActive }) =>
              `navbar-link${isActive || isShopRoute ? ' navbar-link--active' : ''}`
            }
            end={false}
          >
            Shop
          </NavLink>
          <NavLink to="/blog" className={navLinkClass} end={false}>Blog</NavLink>
          <NavLink to="/about" className={navLinkClass}>About</NavLink>
          <NavLink to="/contact" className={navLinkClass}>Contact</NavLink>

          <button type="button" onClick={openCart} className="navbar-cart-btn" aria-label="Open cart">
            <ShoppingCart size={21} />
            {cartCount > 0 && <span className="navbar-cart-badge">{cartCount}</span>}
          </button>

          {user ? (
            <div className={`navbar-user${userMenuOpen ? ' open' : ''}`} ref={userMenuRef}>
              <button
                type="button"
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
                <button type="button" className="dropdown-danger" onClick={() => { setUserMenuOpen(false); logout() }}>Sign Out</button>
              </div>
            </div>
          ) : (
            <Link to="/login" className="navbar-signin">
              <User size={15} />
              <span>Sign In</span>
            </Link>
          )}

          <button type="button" className="navbar-mobile-toggle" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="navbar-mobile-menu">
          <div className="navbar-mobile-menu-header">
            <span className="navbar-mobile-menu-title">Menu</span>
            <button type="button" className="navbar-mobile-close" onClick={closeAll} aria-label="Close menu">
              <X size={22} />
            </button>
          </div>
          <SearchBar className="navbar-search--mobile" inputProps={{ style: { width: '100%' } }} onNavigate={closeAll} />
          {mobileLinks.map((link, i) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `navbar-mobile-link${isActive ? ' navbar-mobile-link--active' : ''}${i === mobileLinks.length - 1 ? ' navbar-mobile-link--last' : ''}`
              }
              onClick={closeAll}
            >
              {link.label}
            </NavLink>
          ))}
          <button
            type="button"
            className="navbar-mobile-link navbar-mobile-link--last"
            onClick={() => { closeAll(); openCart() }}
          >
            Cart ({cartCount})
          </button>
          {user ? (
            <>
              <NavLink to="/account" className="navbar-mobile-link" onClick={closeAll}>My Account</NavLink>
              <NavLink to="/orders" className="navbar-mobile-link" onClick={closeAll}>My Orders</NavLink>
              {user.role === 'admin' && <NavLink to="/admin" className="navbar-mobile-link" onClick={closeAll}>Admin Panel</NavLink>}
              <button type="button" className="navbar-mobile-link navbar-mobile-link--last navbar-mobile-signout" onClick={() => { closeAll(); logout() }}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="navbar-mobile-link" onClick={closeAll}>Sign In</NavLink>
              <NavLink to="/register" className="navbar-mobile-link navbar-mobile-link--last" onClick={closeAll}>Create Account</NavLink>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
