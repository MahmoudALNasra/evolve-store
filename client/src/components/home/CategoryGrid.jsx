import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Baby,
  Bandage,
  Bone,
  Brain,
  Droplets,
  Eye,
  FlaskConical,
  HandHeart,
  Heart,
  HeartPulse,
  Leaf,
  Pill,
  ShieldPlus,
  Smile,
  Sparkles,
  Stethoscope,
  Syringe,
  Thermometer,
  Wind,
} from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import FadeContent from '@/components/ui/FadeContent'
import { SkeletonCategoryGrid } from './SkeletonCategoryCard'

const EXACT_ICONS = {
  Vitamins: Pill,
  'Vitamins & Supplements': Pill,
  Supplements: FlaskConical,
  Fitness: Bone,
  Wellness: Heart,
  'Health & Wellness': Heart,
  Nutrition: Leaf,
  'Mental Health': Brain,
  'Personal Care': HandHeart,
  'Medical Supplies': Stethoscope,
  'Medicine & Drugs': Syringe,
  'Over-the-Counter': Pill,
  'Skin Care': Sparkles,
  'Oral Care': Smile,
  'First Aid': Bandage,
  'Respiratory Care': Wind,
  'Incontinence Aids': ShieldPlus,
  'Digestive Health': Leaf,
  'Eye & Ear Care': Eye,
  'Health & Beauty': Sparkles,
  'Baby & Child Care': Baby,
  'Diabetes Care': Droplets,
  'Pain Relief': Thermometer,
}

const RULE_ICONS = [
  { icon: Pill, pattern: /vitamin|supplement|mineral|omega|probiotic/i },
  { icon: Stethoscope, pattern: /medical|equipment|supply|supplies|dme/i },
  { icon: Syringe, pattern: /medicine|drug|otc|prescription|pharmacy/i },
  { icon: HandHeart, pattern: /personal\s*care|hygiene|bath/i },
  { icon: Sparkles, pattern: /skin|beauty|cosmetic|lotion|cream/i },
  { icon: Smile, pattern: /oral|dental|tooth|mouth/i },
  { icon: Bandage, pattern: /first\s*aid|wound|bandage/i },
  { icon: Wind, pattern: /respirat|inhaler|nebulizer|oxygen|cough/i },
  { icon: Eye, pattern: /eye|ear|vision|hearing/i },
  { icon: Baby, pattern: /baby|infant|child|pediatric/i },
  { icon: Droplets, pattern: /diabetes|glucose|insulin/i },
  { icon: Thermometer, pattern: /pain|fever|cold|flu/i },
  { icon: HeartPulse, pattern: /heart|cardio|blood\s*pressure/i },
  { icon: Leaf, pattern: /digest|gut|nutrition|herbal|natural/i },
  { icon: Brain, pattern: /mental|sleep|mood|focus/i },
  { icon: Bone, pattern: /fitness|sport|muscle|joint/i },
]

function resolveCategoryIcon(name) {
  if (EXACT_ICONS[name]) return EXACT_ICONS[name]
  for (const rule of RULE_ICONS) {
    if (rule.pattern.test(name)) return rule.icon
  }
  return Heart
}

export default function CategoryGrid({ categories = [], loading = false }) {
  const hasCategories = categories.length > 0

  return (
    <>
      <div className="ev-section-divider" aria-hidden="true" />
      <section className="ev-home-section ev-home-section--categories">
        <div className="container">
          <div className="section-header">
            <SectionTitle
              title="Shop by Category"
              subtitle="Find exactly what your body needs"
            />
            {!loading && hasCategories && (
              <FadeContent delay={0.1}>
                <Link to="/shop" className="section-link">
                  View all <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </FadeContent>
            )}
          </div>

          {loading ? (
            <SkeletonCategoryGrid count={6} />
          ) : hasCategories ? (
            <div className="category-grid">
              {categories.map((cat, i) => {
                const Icon = resolveCategoryIcon(cat)
                return (
                  <FadeContent key={cat} delay={i * 0.04} className="category-grid__item">
                    <Link
                      to={`/shop?category=${encodeURIComponent(cat)}`}
                      className="category-card"
                    >
                      <div className="category-card-icon">
                        <Icon size={22} aria-hidden="true" />
                      </div>
                      <span className="category-card-name">{cat}</span>
                    </Link>
                  </FadeContent>
                )
              })}
            </div>
          ) : (
            <>
              <SkeletonCategoryGrid count={6} />
              <p className="ev-section-placeholder-caption">
                Categories coming soon — we&apos;re stocking the shelves.
              </p>
            </>
          )}
        </div>
      </section>
    </>
  )
}
