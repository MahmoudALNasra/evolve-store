import { CheckCircle, FlaskConical, Heart, Leaf } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import FadeContent from '@/components/ui/FadeContent'

const FEATURES = [
  {
    icon: FlaskConical,
    title: 'Lab Tested',
    desc: 'Every product is independently tested for purity and potency.',
  },
  {
    icon: Leaf,
    title: 'Natural Ingredients',
    desc: 'No artificial fillers — clean formulas you can trust.',
  },
  {
    icon: CheckCircle,
    title: 'GMP Certified',
    desc: 'Manufactured in certified facilities for the highest standards.',
  },
  {
    icon: Heart,
    title: 'Expert Formulas',
    desc: 'Developed with nutritionists and health professionals.',
  },
]

export default function TrustSection() {
  return (
    <section className="why-section ev-home-section--trust">
      <div className="why-inner">
        <div className="ev-trust-header">
          <SectionTitle
            title="Why Choose Evolve Specialty Pharmacy & Wellness?"
            subtitle="We take your health seriously"
            align="center"
          />
        </div>
        <div className="why-grid">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <FadeContent key={f.title} delay={i * 0.08} className="why-item">
                <div className="why-icon">
                  <Icon size={24} aria-hidden="true" />
                </div>
                <div className="why-title">{f.title}</div>
                <div className="why-desc">{f.desc}</div>
              </FadeContent>
            )
          })}
        </div>
      </div>
    </section>
  )
}
