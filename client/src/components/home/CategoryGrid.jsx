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
  const showSkeletons = loading || categories.length === 0
  const items = showSkeletons ? [] : categories

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
          {!showSkeletons && (
            <FadeContent delay={0.1}>
              <Link to="/shop" className="section-link">
                View all <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </FadeContent>
          )}
        </div>

        {showSkeletons ? (
          <>
            <SkeletonCategoryGrid count={6} />
            {categories.length === 0 && !loading && (
              <p className="ev-section-placeholder-caption">
                Categories coming soon — we&apos;re stocking the shelves.
              </p>
            )}
          </>
        ) : (
          <div className="category-grid">
            {items.map((cat, i) => {
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
        )}
      </div>
    </section>
    </>
  )
}
