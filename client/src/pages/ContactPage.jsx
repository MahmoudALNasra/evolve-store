import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, MapPin, Phone, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

const INITIAL_FORM = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
}

export default function ContactPage() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (e) => {
    setForm((current) => ({ ...current, [field]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.name.trim()) return toast.error('Name is required')
    if (!form.email.trim()) return toast.error('Email address is required')
    if (!form.phone.trim()) return toast.error('Phone number is required')
    if (!form.subject.trim()) return toast.error('Subject is required')

    setSubmitting(true)
    try {
      await api.post('/contact', form)
      toast.success('Message sent. Our team will contact you shortly.')
      setForm(INITIAL_FORM)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to send message right now')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="contact-page">
      <div className="info-page-container">
        <Link to="/" className="page-back">
          <ArrowLeft size={15} /> Back to Home
        </Link>

        <section className="contact-hero">
          <div>
            <span className="info-eyebrow">Contact Us</span>
            <h1>How can we help?</h1>
            <p>
              Send our pharmacy team a message and we will follow up as soon as possible.
              For urgent medical questions, please call the pharmacy directly.
            </p>
          </div>
        </section>

        <div className="contact-grid">
          <aside className="contact-info-card">
            <h2>Reach the pharmacy</h2>
            <div className="contact-info-item">
              <Phone size={18} />
              <div>
                <strong>Phone</strong>
                <a href="tel:+12105550123">(210) 555-0123</a>
              </div>
            </div>
            <div className="contact-info-item">
              <Mail size={18} />
              <div>
                <strong>Email</strong>
                <a href="mailto:info@evolvepharmacy.com">info@evolvepharmacy.com</a>
              </div>
            </div>
            <div className="contact-info-item">
              <MapPin size={18} />
              <div>
                <strong>Location</strong>
                <span>19239 Stone Oak Pkwy Ste #103<br />San Antonio, TX 78258</span>
              </div>
            </div>
          </aside>

          <form className="contact-form-card" onSubmit={handleSubmit}>
            <div className="contact-form-row">
              <div className="auth-field">
                <label>Name *</label>
                <input value={form.name} onChange={update('name')} required autoComplete="name" />
              </div>
              <div className="auth-field">
                <label>Email Address *</label>
                <input type="email" value={form.email} onChange={update('email')} required autoComplete="email" />
              </div>
            </div>

            <div className="contact-form-row">
              <div className="auth-field">
                <label>Phone Number *</label>
                <input type="tel" value={form.phone} onChange={update('phone')} required autoComplete="tel" />
              </div>
              <div className="auth-field">
                <label>Subject *</label>
                <input value={form.subject} onChange={update('subject')} required />
              </div>
            </div>

            <div className="auth-field">
              <label>Message</label>
              <textarea
                value={form.message}
                onChange={update('message')}
                rows={6}
                placeholder="Tell us what you need help with..."
              />
            </div>

            <button type="submit" className="btn-primary contact-submit" disabled={submitting}>
              {submitting ? <div className="spinner spinner-sm" /> : <><Send size={16} /> Send Message</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
