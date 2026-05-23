import { Link } from 'react-router-dom'
import { ArrowLeft, HeartPulse, ShieldCheck, Sparkles } from 'lucide-react'

const PHARMACIST_IMAGE =
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80'

export default function AboutPage() {
  return (
    <div className="about-page">
      <div className="info-page-container">
        <Link to="/" className="page-back">
          <ArrowLeft size={15} /> Back to Home
        </Link>

        <section className="about-hero">
          <div className="about-copy-panel">
            <span className="info-eyebrow">About Us</span>
            <h1>Evolve Specialty Pharmacy & Wellness</h1>
            <p>
              We are a patient-focused pharmacy built around personalized care,
              practical wellness support, and reliable service. Our team helps
              patients and families navigate prescriptions, health products, and
              everyday wellness needs with clarity and compassion.
            </p>
            <p>
              This section is intentionally simple for now so you can replace it
              later with the final pharmacy story, pharmacist biography, and
              community mission.
            </p>

            <div className="about-pill-row">
              <span><ShieldCheck size={15} /> Trusted care</span>
              <span><HeartPulse size={15} /> Patient first</span>
              <span><Sparkles size={15} /> Wellness focused</span>
            </div>
          </div>

          <div className="about-pharmacist-wrap" aria-label="Pharmacist portrait placeholder">
            <div className="about-gold-orbit" />
            <img src={PHARMACIST_IMAGE} alt="Pharmacist placeholder portrait" />
            <div className="about-photo-card">
              <strong>Your pharmacist</strong>
              <span>Photo placeholder</span>
            </div>
          </div>
        </section>

        <section className="about-values-grid">
          <div>
            <h2>Personalized guidance</h2>
            <p>Care that considers your medications, goals, routines, and questions.</p>
          </div>
          <div>
            <h2>Wellness support</h2>
            <p>Thoughtful product selection for vitamins, supplements, and daily health needs.</p>
          </div>
          <div>
            <h2>Community service</h2>
            <p>A local pharmacy experience that values relationships and follow-through.</p>
          </div>
        </section>
      </div>
    </div>
  )
}
