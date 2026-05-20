import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRightLeft, CheckCircle, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/useAuthStore'

const emptyMed = () => ({ name: '', dosage: '', prescriptionNumber: '' })

export default function TransferPrescriptionPage() {
  const user = useAuthStore((s) => s.user)

  const [form, setForm] = useState({
    patientName: user?.name || '',
    dateOfBirth: '',
    phone: '',
    email: user?.email || '',
    preferredContactMethod: 'phone',
    currentPharmacyName: '',
    currentPharmacyPhone: '',
    currentPharmacyAddress: '',
    notes: '',
  })
  const [medications, setMedications] = useState([emptyMed()])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const updateMed = (idx, key) => (e) => {
    setMedications((meds) => meds.map((m, i) => (i === idx ? { ...m, [key]: e.target.value } : m)))
  }
  const addMed = () => setMedications((meds) => [...meds, emptyMed()])
  const removeMed = (idx) => setMedications((meds) => meds.filter((_, i) => i !== idx))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const cleanedMeds = medications.filter((m) => m.name.trim())
    if (cleanedMeds.length === 0) {
      toast.error('Please add at least one medication to transfer')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/prescriptions', {
        type: 'transfer',
        ...form,
        medications: cleanedMeds,
      })
      setSubmitted(true)
      toast.success('Transfer request submitted')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #d1f4e0 0%, #a7e9c5 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', color: '#2d7a3a'
        }}>
          <CheckCircle size={36} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1c2b1c', marginBottom: 12 }}>Transfer Request Received</h1>
        <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
          Thanks, {form.patientName.split(' ')[0]}! Our pharmacy team will contact your current pharmacy and reach out to you via{' '}
          <strong>{form.preferredContactMethod}</strong> with next steps.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" className="btn-primary">Back to Home</Link>
          <Link to="/shop" className="btn-green-outline">Continue Shopping</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 64px' }}>
      <Link to="/" className="page-back" style={{ marginBottom: 16, display: 'inline-flex' }}>
        <ArrowLeft size={15} /> Back to Home
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, #d1f4e0 0%, #a7e9c5 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d7a3a',
        }}>
          <ArrowRightLeft size={22} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1c2b1c', margin: 0 }}>
          Transfer a Prescription
        </h1>
      </div>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
        Move your prescriptions from another pharmacy to Evolve. We'll handle the transfer for you — just provide the details below.
      </p>

      <form onSubmit={handleSubmit} className="auth-box" style={{ padding: 24 }}>
        <div className="auth-form">
          {/* Patient info */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: -4 }}>
            Patient Information
          </h3>

          <div className="auth-field">
            <label>Patient Full Name *</label>
            <input value={form.patientName} onChange={update('patientName')} required placeholder="John Doe" autoComplete="name" />
          </div>

          <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="auth-field">
              <label>Date of Birth *</label>
              <input type="date" value={form.dateOfBirth} onChange={update('dateOfBirth')} required max={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="auth-field">
              <label>Preferred Contact *</label>
              <select value={form.preferredContactMethod} onChange={update('preferredContactMethod')}>
                <option value="phone">Phone Call</option>
                <option value="text">Text Message</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>

          <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="auth-field">
              <label>Phone *</label>
              <input type="tel" value={form.phone} onChange={update('phone')} required placeholder="(555) 123-4567" autoComplete="tel" />
            </div>
            <div className="auth-field">
              <label>Email *</label>
              <input type="email" value={form.email} onChange={update('email')} required placeholder="you@example.com" autoComplete="email" />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e8eee8', margin: '6px 0' }} />

          {/* Current pharmacy */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: -4 }}>
            Current Pharmacy
          </h3>

          <div className="auth-field">
            <label>Pharmacy Name *</label>
            <input value={form.currentPharmacyName} onChange={update('currentPharmacyName')} required placeholder="e.g. CVS, Walgreens" />
          </div>

          <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="auth-field">
              <label>Pharmacy Phone</label>
              <input type="tel" value={form.currentPharmacyPhone} onChange={update('currentPharmacyPhone')} placeholder="(555) 555-1212" />
            </div>
            <div className="auth-field">
              <label>Pharmacy Address</label>
              <input value={form.currentPharmacyAddress} onChange={update('currentPharmacyAddress')} placeholder="Street, City, State" />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e8eee8', margin: '6px 0' }} />

          {/* Medications */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: -4 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Medications to Transfer *
            </h3>
            <button
              type="button"
              onClick={addMed}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: '#2d7a3a', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Plus size={14} /> Add medication
            </button>
          </div>

          {medications.map((m, idx) => (
            <div
              key={idx}
              style={{
                background: '#f7faf7',
                border: '1px solid #e0e7e0',
                borderRadius: 10,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Medication {idx + 1}</span>
                {medications.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMed(idx)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>
              <div className="auth-field">
                <label>Name *</label>
                <input value={m.name} onChange={updateMed(idx, 'name')} placeholder="e.g. Lisinopril" />
              </div>
              <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="auth-field">
                  <label>Dosage</label>
                  <input value={m.dosage} onChange={updateMed(idx, 'dosage')} placeholder="e.g. 10mg" />
                </div>
                <div className="auth-field">
                  <label>Rx #</label>
                  <input value={m.prescriptionNumber} onChange={updateMed(idx, 'prescriptionNumber')} placeholder="optional" />
                </div>
              </div>
            </div>
          ))}

          <div className="auth-field">
            <label>Additional Notes</label>
            <textarea
              value={form.notes}
              onChange={update('notes')}
              rows={4}
              placeholder="Any allergies or special instructions"
              style={{ resize: 'vertical' }}
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-auth-submit">
            {submitting ? <div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} /> : 'Submit Transfer Request'}
          </button>
        </div>
      </form>

      <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
        Your information is kept confidential and only used to process your transfer.
      </p>
    </div>
  )
}
