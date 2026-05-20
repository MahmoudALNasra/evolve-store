import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Leaf } from 'lucide-react'
import useAuthStore from '../store/useAuthStore'
import useCartStore from '../store/useCartStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const { login, loading } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await login(form.email, form.password)
      navigate(redirect)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    }
  }

  const handleGoogleLogin = () => {
    console.log('📍 Redirect parameter:', redirect)
    
    // Save cart to backup BEFORE Google OAuth redirect
    const cartStore = useCartStore.getState()
    let guestCartItems = []
    
    // Check if cart has been rehydrated from localStorage
    if (cartStore._hasHydrated) {
      guestCartItems = [...cartStore.getItems()]
      console.log('🛒 Cart hydrated, using store:', guestCartItems)
    } else {
      // Cart not hydrated yet, read directly from localStorage
      console.log('⚠️ Cart not hydrated yet, reading from localStorage')
      try {
        const persistedCart = localStorage.getItem('estore-cart')
        if (persistedCart) {
          const parsed = JSON.parse(persistedCart)
          guestCartItems = parsed.state?.items || []
          console.log('� Read from localStorage:', guestCartItems)
        }
      } catch (err) {
        console.error('Failed to read cart from localStorage:', err)
      }
    }
    
    if (guestCartItems.length > 0) {
      localStorage.setItem('guest-cart-backup', JSON.stringify(guestCartItems))
      console.log('💾 Cart saved to backup before OAuth redirect')
    }
    
    // Now redirect to Google OAuth
    const oauthUrl = `/api/auth/google${redirect !== '/' ? `?redirect=${redirect}` : ''}`
    console.log('🔗 OAuth URL:', oauthUrl)
    window.location.href = oauthUrl
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Link to="/" className="auth-brand-logo">
            <div className="auth-brand-icon"><Leaf size={20} /></div>
            <span className="auth-brand-name">Evolve<span>Pharmacy</span></span>
          </Link>
          <h1>Welcome back</h1>
          <p>Sign in to your account</p>
        </div>

        <div className="auth-box">
          <button type="button" onClick={handleGoogleLogin} className="auth-google-btn">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="auth-divider"><span>or continue with email</span></div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Email</label>
              <input type="email" required placeholder="you@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <input type="password" required placeholder="••••••••" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <button type="submit" disabled={loading} className="btn-auth-submit">
              {loading ? <div className="spinner spinner-sm" /> : 'Sign In'}
            </button>
          </form>

          <p className="auth-footer">
            Don't have an account? <Link to="/register">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
