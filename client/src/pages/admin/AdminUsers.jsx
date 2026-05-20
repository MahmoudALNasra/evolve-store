import { useEffect, useState } from 'react'
import { Search, Shield, User, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState(null)
  const [roleChangeUser, setRoleChangeUser] = useState(null)

  const load = () => {
    setLoading(true)
    api.get('/users', { params: { page, limit: 20, search: search || undefined } })
      .then(({ data }) => { setUsers(data.users); setTotal(data.total); setPages(data.pages) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, search])

  const confirmRoleChange = async () => {
    if (!roleChangeUser) return
    const newRole = roleChangeUser.role === 'admin' ? 'user' : 'admin'
    await api.put(`/users/${roleChangeUser._id}/role`, { role: newRole })
    toast.success(`${roleChangeUser.name} is now ${newRole}`)
    setRoleChangeUser(null)
    load()
  }

  const handleDelete = async () => {
    await api.delete(`/users/${deleteId}`)
    toast.success('User deleted')
    setDeleteId(null)
    load()
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Users <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 18 }}>({total})</span></h1>
      </div>

      <div className="admin-search">
        <Search size={15} className="admin-search-icon" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search by name or email…" />
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Joined</th>
                <th>Auth</th>
                <th style={{ textAlign: 'center' }}>Role</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={5} className="admin-empty">No users found</td></tr>
              ) : users.map((user) => (
                <tr key={user._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e8eee8' }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e8f4e8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d7a3a', fontWeight: 700, fontSize: 13 }}>
                          {user.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: '#1c2b1c' }}>{user.name}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(user.createdAt)}</td>
                  <td><span className={`admin-badge ${user.googleId ? 'blue' : 'gray'}`}>{user.googleId ? 'Google' : 'Email'}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`admin-badge ${user.role === 'admin' ? 'indigo' : 'gray'}`}>{user.role}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <button
                        onClick={() => setRoleChangeUser(user)}
                        title={user.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                        className="btn-admin btn-admin-sm btn-admin-secondary"
                      >
                        {user.role === 'admin' ? <User size={14} /> : <Shield size={14} />}
                      </button>
                      <button onClick={() => setDeleteId(user._id)} title="Delete user" className="btn-admin btn-admin-sm btn-admin-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="admin-pagination">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={page === p ? 'active' : ''}>{p}</button>
          ))}
        </div>
      )}

      {roleChangeUser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c', marginBottom: 8 }}>
              {roleChangeUser.role === 'admin' ? 'Remove Admin Access?' : 'Grant Admin Access?'}
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              {roleChangeUser.role === 'admin' 
                ? `${roleChangeUser.name} will lose admin privileges and become a regular user.`
                : `${roleChangeUser.name} will gain full admin access to manage products, orders, and users.`
              }
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setRoleChangeUser(null)} className="btn-admin btn-admin-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={confirmRoleChange} className="btn-admin btn-admin-primary" style={{ flex: 1 }}>
                {roleChangeUser.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c', marginBottom: 8 }}>Delete User?</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>This will permanently remove the user and their data.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteId(null)} className="btn-admin btn-admin-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleDelete} className="btn-admin btn-admin-danger" style={{ flex: 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
