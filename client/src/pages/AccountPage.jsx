import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { User, Lock, Package, Mail } from 'lucide-react'
import useAuthStore from '../store/useAuthStore'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { formatPrice, formatDate } from '../lib/utils'

const STATUS_COLOR = {
  pending: 'yellow',
  processing: 'blue',
  shipped: 'indigo',
  delivered: 'green',
  cancelled: 'red',
}

const STATUS_LABELS = {
  pending: 'Awaiting Payment',
  processing: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export default function AccountPage() {
  const { user, setUser } = useAuthStore()
  const [form, setForm] = useState({ name: user?.name || '', avatar: user?.avatar || '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [recentOrders, setRecentOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    // Load recent orders
    api.get('/orders/my')
      .then(({ data }) => setRecentOrders(data.slice(0, 3))) // Only show 3 most recent
      .finally(() => setLoadingOrders(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.put('/users/profile', form)
      setUser(data)
      toast.success('Profile updated')
    } catch {
      toast.error('Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error('Passwords do not match')
    }
    
    if (passwordForm.newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters')
    }

    setChangingPassword(true)
    try {
      await api.put('/users/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
      toast.success('Password updated successfully')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password update failed')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
      <h1 className="page-title">My Account</h1>

      <div className="responsive-2col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Profile Information */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #d1f4e0 0%, #a7e9c5 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <User size={18} style={{ color: '#2d7a3a' }} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>Profile Information</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #e8eee8' }}>
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e8eee8' }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e8f4e8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d7a3a', fontWeight: 700, fontSize: 24 }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p style={{ fontWeight: 700, fontSize: 18, color: '#1c2b1c', marginBottom: 4 }}>{user?.name}</p>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={14} /> {user?.email}
              </p>
              <span className={`admin-badge ${user?.role === 'admin' ? 'indigo' : 'gray'}`}>{user?.role}</span>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="auth-field">
              <label>Full Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="auth-field">
              <label>Avatar URL</label>
              <input value={form.avatar} onChange={(e) => setForm((f) => ({ ...f, avatar: e.target.value }))} placeholder="https://example.com/avatar.jpg" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <div className="spinner spinner-sm" /> : <><User size={15} /> Save Changes</>}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #d1f4e0 0%, #a7e9c5 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Lock size={18} style={{ color: '#2d7a3a' }} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>Change Password</h2>
          </div>

          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="auth-field">
              <label>Current Password</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                required
              />
            </div>
            <div className="auth-field">
              <label>New Password</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                required
                minLength={6}
              />
            </div>
            <div className="auth-field">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                required
                minLength={6}
              />
            </div>
            <button type="submit" disabled={changingPassword} className="btn-primary">
              {changingPassword ? <div className="spinner spinner-sm" /> : <><Lock size={15} /> Update Password</>}
            </button>
          </form>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #d1f4e0 0%, #a7e9c5 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Package size={18} style={{ color: '#2d7a3a' }} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>Recent Orders</h2>
          </div>
          <Link to="/orders" style={{ fontSize: 13, color: '#2d7a3a', fontWeight: 600, textDecoration: 'none' }}>
            View all →
          </Link>
        </div>

        {loadingOrders ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            <Package size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p>No orders yet</p>
            <Link to="/shop" className="btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
              Start Shopping
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentOrders.map((order) => (
              <Link
                key={order._id}
                to={`/orders/${order._id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  background: '#f9fafb',
                  borderRadius: 10,
                  border: '1px solid #e8eee8',
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2d7a3a'
                  e.currentTarget.style.background = '#f0f9f4'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e8eee8'
                  e.currentTarget.style.background = '#f9fafb'
                }}
              >
                <div>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, fontFamily: 'monospace' }}>
                    #{order._id.slice(-8).toUpperCase()}
                  </p>
                  <p style={{ fontSize: 13, color: '#6b7280' }}>{formatDate(order.createdAt)}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`admin-badge ${STATUS_COLOR[order.status] || 'gray'}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#1c2b1c' }}>{formatPrice(order.total)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
