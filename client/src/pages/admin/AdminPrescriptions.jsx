import { useEffect, useState, useCallback } from 'react'
import { Search, Pill, ArrowRightLeft, Trash2, Eye, X } from 'lucide-react'
import api from '../../lib/api'
import { formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'in_review', label: 'In Review', color: 'blue' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
]

const TYPE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'refill', label: 'Refills' },
  { key: 'transfer', label: 'Transfers' },
]

export default function AdminPrescriptions() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')
  const [pendingStatus, setPendingStatus] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api
      .get('/prescriptions', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          type: typeFilter || undefined,
          status: statusFilter || undefined,
        },
      })
      .then(({ data }) => {
        setItems(data.prescriptions)
        setTotal(data.total)
        setPages(data.pages)
      })
      .finally(() => setLoading(false))
  }, [page, search, typeFilter, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const openDetails = (item) => {
    setSelected(item)
    setAdminNotes(item.adminNotes || '')
    setPendingStatus(item.status)
  }

  const closeDetails = () => {
    setSelected(null)
    setAdminNotes('')
    setPendingStatus('')
  }

  const saveChanges = async () => {
    if (!selected) return
    setSavingStatus(true)
    try {
      const { data } = await api.put(`/prescriptions/${selected._id}`, {
        status: pendingStatus,
        adminNotes,
      })
      toast.success('Updated')
      setItems((arr) => arr.map((p) => (p._id === data._id ? { ...p, ...data } : p)))
      setSelected({ ...selected, ...data })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setSavingStatus(false)
    }
  }

  const handleDelete = async () => {
    try {
      await api.delete(`/prescriptions/${deleteId}`)
      toast.success('Deleted')
      setDeleteId(null)
      if (selected?._id === deleteId) closeDetails()
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    }
  }

  const statusBadge = (status) => {
    const opt = STATUS_OPTIONS.find((s) => s.value === status)
    return <span className={`admin-badge ${opt?.color || 'gray'}`}>{opt?.label || status}</span>
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">
          Prescriptions{' '}
          <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 18 }}>({total})</span>
        </h1>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              onClick={() => {
                setTypeFilter(f.key)
                setPage(1)
              }}
              className={`btn-admin btn-admin-sm ${typeFilter === f.key ? 'btn-admin-primary' : 'btn-admin-secondary'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1.5px solid #e0e7e0',
            fontSize: 13,
            background: '#f7faf7',
          }}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <div className="admin-search" style={{ marginLeft: 'auto' }}>
          <Search size={15} className="admin-search-icon" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search name, email, phone, Rx#…"
          />
        </div>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Patient</th>
                <th>Contact</th>
                <th>Submitted</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-empty">No prescription requests</td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: p.type === 'refill' ? '#e8f4e8' : '#dbeafe',
                          color: p.type === 'refill' ? '#2d7a3a' : '#1e40af',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {p.type === 'refill' ? <Pill size={15} /> : <ArrowRightLeft size={15} />}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{p.type}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1c2b1c' }}>{p.patientName}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>DOB: {p.dateOfBirth}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{p.email}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{p.phone}</div>
                    </td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(p.createdAt)}</td>
                    <td style={{ textAlign: 'center' }}>{statusBadge(p.status)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <button onClick={() => openDetails(p)} title="View" className="btn-admin btn-admin-sm btn-admin-secondary">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => setDeleteId(p._id)} title="Delete" className="btn-admin btn-admin-sm btn-admin-danger">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
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

      {/* Details modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16, overflowY: 'auto' }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c', display: 'flex', alignItems: 'center', gap: 10 }}>
                {selected.type === 'refill' ? <Pill size={18} /> : <ArrowRightLeft size={18} />}
                {selected.type === 'refill' ? 'Refill Request' : 'Transfer Request'}
              </h2>
              <button onClick={closeDetails} className="btn-admin btn-admin-sm btn-admin-secondary">
                <X size={16} />
              </button>
            </div>

            <Section title="Patient">
              <Field label="Name" value={selected.patientName} />
              <Field label="Date of Birth" value={selected.dateOfBirth} />
              <Field label="Phone" value={selected.phone} />
              <Field label="Email" value={selected.email} />
              <Field label="Preferred Contact" value={selected.preferredContactMethod} />
              {selected.user && <Field label="Linked Account" value={`${selected.user.name} (${selected.user.email})`} />}
            </Section>

            {selected.type === 'refill' && (
              <Section title="Refill Details">
                <Field label="Prescription #" value={selected.prescriptionNumber || '—'} />
                <Field label="Medication" value={selected.medicationName || '—'} />
              </Section>
            )}

            {selected.type === 'transfer' && (
              <>
                <Section title="Current Pharmacy">
                  <Field label="Name" value={selected.currentPharmacyName} />
                  <Field label="Phone" value={selected.currentPharmacyPhone || '—'} />
                  <Field label="Address" value={selected.currentPharmacyAddress || '—'} />
                </Section>
                <Section title={`Medications (${selected.medications?.length || 0})`}>
                  {selected.medications?.length ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selected.medications.map((m, i) => (
                        <li key={i} style={{ background: '#f7faf7', padding: 10, borderRadius: 8, fontSize: 13 }}>
                          <strong>{m.name}</strong>{m.dosage && ` — ${m.dosage}`}
                          {m.prescriptionNumber && <span style={{ color: '#6b7280', marginLeft: 8 }}>Rx# {m.prescriptionNumber}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 13, color: '#9ca3af' }}>None listed</p>
                  )}
                </Section>
              </>
            )}

            {selected.notes && (
              <Section title="Patient Notes">
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.notes}</p>
              </Section>
            )}

            <Section title="Admin Controls">
              <div className="auth-field">
                <label>Status</label>
                <select value={pendingStatus} onChange={(e) => setPendingStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="auth-field">
                <label>Internal Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Notes visible to admins only"
                  style={{ resize: 'vertical' }}
                />
              </div>
              <button
                onClick={saveChanges}
                disabled={savingStatus}
                className="btn-admin btn-admin-primary"
                style={{ alignSelf: 'flex-start' }}
              >
                {savingStatus ? 'Saving…' : 'Save Changes'}
              </button>
            </Section>

            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 12, textAlign: 'right' }}>
              Submitted {formatDate(selected.createdAt)}
            </p>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c', marginBottom: 8 }}>Delete request?</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              This permanently removes the prescription request and cannot be undone.
            </p>
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

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: '#1c2b1c', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
