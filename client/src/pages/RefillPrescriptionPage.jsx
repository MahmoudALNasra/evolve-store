import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pill, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/useAuthStore'

export default function RefillPrescriptionPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [form, setForm] = useState({
    patientName: user?.name || '',
    dateOfBirth: '',
    phone: '',
    email: user?.email || '',
    preferredContactMethod: 'phone',
    prescriptionNumber: '',
    medicationName: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.prescriptionNumber.trim() && !form.medicationName.trim()) {
      toast.error('Please provide a prescription number or medication name')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/prescriptions', { type: 'refill', ...form })
      setSubmitted(true)
      toast.success('Refill request submitted')
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
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1c2b1c', marginBottom: 12 }}>Refill Request Received</h1>
        <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
          Thanks, {form.patientName.split(' ')[0]}! Our pharmacy team will review your request and contact you via{' '}
          <strong>{form.preferredContactMethod}</strong> within one business day.
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
          <Pill size={22} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1c2b1c', margin: 0 }}>
          Refill Your Prescription
        </h1>
      </div>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
        Submit a refill request and our pharmacist will reach out to confirm. Have your prescription number handy when possible.
      </p>

      <form onSubmit={handleSubmit} className="auth-box" style={{ padding: 24 }}>
        <div className="auth-form">
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

          <div className="auth-field">
            <label>Prescription Number (Rx #)</label>
            <input value={form.prescriptionNumber} onChange={update('prescriptionNumber')} placeholder="e.g. 1234567" />
            <small style={{ color: '#9ca3af', fontSize: 12 }}>Found on your prescription bottle label.</small>
          </div>

          <div className="auth-field">
            <label>Medication Name {form.prescriptionNumber ? '' : '*'}</label>
            <input value={form.medicationName} onChange={update('medicationName')} placeholder="e.g. Lisinopril 10mg" />
            <small style={{ color: '#9ca3af', fontSize: 12 }}>Required if you don't have the Rx number.</small>
          </div>

          <div className="auth-field">
            <label>Additional Notes</label>
            <textarea
              value={form.notes}
              onChange={update('notes')}
              rows={4}
              placeholder="Any allergies, dosage changes, or special instructions"
              style={{ resize: 'vertical' }}
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-auth-submit">
            {submitting ? <div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} /> : 'Submit Refill Request'}
          </button>
        </div>
      </form>

      <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
        Your information is kept confidential and only used to process your refill.
      </p>
    </div>
  )
}
