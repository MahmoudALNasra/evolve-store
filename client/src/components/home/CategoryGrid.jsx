import { Link } from 'react-router-dom'
import { ArrowRight, Leaf, FlaskConical, Heart, Dumbbell, Brain, Apple } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import FadeContent from '@/components/ui/FadeContent'
import { SkeletonCategoryGrid } from './SkeletonCategoryCard'

const CATEGORY_ICONS = {
  Vitamins: Apple,
  Supplements: FlaskConical,
  Fitness: Dumbbell,
  Wellness: Heart,
  Nutrition: Leaf,
  'Mental Health': Brain,
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
              const Icon = CATEGORY_ICONS[cat] ?? Leaf
              return (
                <FadeContent key={cat} delay={i * 0.06}>
                  <Link
                    to={`/shop?category=${encodeURIComponent(cat)}`}
                    className="category-card"
                  >
                    <div className="category-card-icon">
                      <Icon size={20} aria-hidden="true" />
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
