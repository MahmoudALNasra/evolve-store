import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Leaf, Check, X } from 'lucide-react'
import useAuthStore from '../store/useAuthStore'
import toast from 'react-hot-toast'

const RULES = [
  { id: 'len',     label: 'At least 8 characters',             test: (p) => p.length >= 8 },
  { id: 'upper',   label: 'One uppercase letter (A–Z)',         test: (p) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'One lowercase letter (a–z)',         test: (p) => /[a-z]/.test(p) },
  { id: 'digit',   label: 'One number (0–9)',                   test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character (!@#$%…)',     test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(p) },
  { id: 'space',   label: 'No spaces',                          test: (p) => !/\s/.test(p) && p.length > 0 },
]

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [touched, setTouched] = useState(false)
  const { register, loading } = useAuthStore()
  const navigate = useNavigate()

  const checks = useMemo(() => RULES.map((r) => ({ ...r, pass: r.test(form.password) })), [form.password])
  const allPass = checks.every((c) => c.pass)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!allPass) return toast.error('Password does not meet all requirements')
    if (form.password !== form.confirm) return toast.error('Passwords do not match')
    try {
      await register(form.name, form.email, form.password)
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Link to="/" className="auth-brand-logo">
            <div className="auth-brand-icon"><Leaf size={20} /></div>
            <span className="auth-brand-name">Evolve<span>Pharmacy</span></span>
          </Link>
          <h1>Create an account</h1>
          <p>Start shopping today</p>
        </div>

        <div className="auth-box">
          <a href="/api/auth/google" className="auth-google-btn">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </a>

          <div className="auth-divider"><span>or sign up with email</span></div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Full Name</label>
              <input required placeholder="John Doe" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="auth-field">
              <label>Email</label>
              <input type="email" required placeholder="you@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <input
                type="password"
                required
                placeholder="Create a strong password"
                value={form.password}
                onFocus={() => setTouched(true)}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              {touched && (
                <div className="pw-checklist">
                  {checks.map((c) => (
                    <div key={c.id} className={`pw-check-item${c.pass ? ' pass' : ''}`}>
                      {c.pass ? <Check size={11} /> : <X size={11} />}
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="auth-field">
              <label>Confirm Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
              />
              {form.confirm && (
                <div className={`pw-match-msg${form.password === form.confirm ? ' match' : ' no-match'}`}>
                  {form.password === form.confirm ? <><Check size={11} /> Passwords match</> : <><X size={11} /> Passwords do not match</>}
                </div>
              )}
            </div>
            <button type="submit" disabled={loading || !allPass || form.password !== form.confirm} className="btn-auth-submit">
              {loading ? <div className="spinner spinner-sm" /> : 'Create Account'}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
