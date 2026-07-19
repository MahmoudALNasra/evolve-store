import { useEffect, useState } from 'react'
import { Search, ScrollText, RefreshCw } from 'lucide-react'
import api from '../../lib/api'
import { formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'

const ACTOR_FILTERS = [
  { value: '', label: 'All actors' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
  { value: 'system', label: 'System' },
]

function actorBadge(type) {
  if (type === 'admin') return 'indigo'
  if (type === 'user') return 'green'
  return 'gray'
}

function statusBadge(status) {
  if (status === 'success') return 'green'
  if (status === 'denied') return 'yellow'
  if (status === 'error') return 'red'
  return 'gray'
}

export default function AdminActivity() {
  const [events, setEvents] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [actorType, setActorType] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    api.get('/admin/audit', {
      params: {
        page,
        limit: 40,
        search: search.trim() || undefined,
        actorType: actorType || undefined,
      },
    })
      .then(({ data }) => {
        setEvents(data.events || [])
        setTotal(data.total || 0)
        setPages(data.pages || 1)
      })
      .catch((err) => {
        const message = err.response?.data?.message || 'Failed to load activity log'
        setError(message)
        setEvents([])
        toast.error(message)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, actorType])

  return (
    <div className="admin-page">
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="admin-page-title">
            Activity Log{' '}
            <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 18 }}>({total})</span>
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>
            Durable backup of admin, user, and system changes (stored in Supabase).
          </p>
        </div>
        <button type="button" className="btn-admin btn-admin-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="admin-search" style={{ flex: 1, minWidth: 220, margin: 0 }}>
          <Search size={15} className="admin-search-icon" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search action, email, summary…"
          />
        </div>
        <select
          value={actorType}
          onChange={(e) => { setActorType(e.target.value); setPage(1) }}
          className="auth-field"
          style={{ margin: 0, width: 160, fontSize: 13 }}
        >
          {ACTOR_FILTERS.map((f) => (
            <option key={f.value || 'all'} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>
        ) : error ? (
          <div className="admin-empty">
            <ScrollText size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p>{error}</p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
              If the table is missing, run <code>npm run setup:audit</code> on the server
              (or paste <code>server/sql/audit_events.sql</code> in the Supabase SQL editor).
            </p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Summary</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={5} className="admin-empty">No activity logged yet</td></tr>
              ) : events.map((event) => (
                <tr
                  key={event.id}
                  onClick={() => setSelected(event)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                    {formatDate(event.created_at)}
                  </td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{event.actor_name || event.actor_email || '—'}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{event.actor_email || event.actor_id || ''}</div>
                    <span className={`admin-badge ${actorBadge(event.actor_type)}`} style={{ marginTop: 4 }}>
                      {event.actor_type}
                    </span>
                  </td>
                  <td>
                    <code style={{ fontSize: 11 }}>{event.action}</code>
                    {event.entity_type && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        {event.entity_type}{event.entity_id ? ` · ${String(event.entity_id).slice(-8)}` : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 13, maxWidth: 320 }}>
                    {event.summary || '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`admin-badge ${statusBadge(event.status)}`}>{event.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="admin-pagination">
          {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 20).map((p) => (
            <button key={p} type="button" onClick={() => setPage(p)} className={page === p ? 'active' : ''}>
              {p}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Event detail</h2>
              <button type="button" className="btn-admin btn-admin-sm btn-admin-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
              <div><strong>Action:</strong> <code>{selected.action}</code></div>
              <div><strong>When:</strong> {formatDate(selected.created_at)}</div>
              <div><strong>Actor:</strong> {selected.actor_name || '—'} ({selected.actor_email || selected.actor_id || '—'}) · {selected.actor_type}</div>
              <div><strong>Summary:</strong> {selected.summary || '—'}</div>
              <div><strong>Request:</strong> {selected.request_method} {selected.request_path}</div>
              <div><strong>IP:</strong> {selected.ip || '—'}</div>
              <div>
                <strong>Before</strong>
                <pre style={{ marginTop: 6, padding: 12, background: '#f8faf8', borderRadius: 8, overflow: 'auto', fontSize: 11 }}>
                  {JSON.stringify(selected.before_data || {}, null, 2)}
                </pre>
              </div>
              <div>
                <strong>After</strong>
                <pre style={{ marginTop: 6, padding: 12, background: '#f8faf8', borderRadius: 8, overflow: 'auto', fontSize: 11 }}>
                  {JSON.stringify(selected.after_data || {}, null, 2)}
                </pre>
              </div>
              <div>
                <strong>Meta</strong>
                <pre style={{ marginTop: 6, padding: 12, background: '#f8faf8', borderRadius: 8, overflow: 'auto', fontSize: 11 }}>
                  {JSON.stringify(selected.meta || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
