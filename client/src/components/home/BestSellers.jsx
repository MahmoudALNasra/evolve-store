import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import SectionTitle from '@/components/ui/SectionTitle'
import FadeContent from '@/components/ui/FadeContent'
import ProductCard from '@/components/shop/ProductCard'
import { SkeletonProductGrid } from './SkeletonProductCard'

function SkeletonCaption() {
  const reduced = useReducedMotion()
  return (
    <motion.p
      className="ev-section-placeholder-caption"
      initial={{ opacity: reduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.6 }}
    >
      Our bestsellers are on their way — check back soon.
    </motion.p>
  )
}

export default function BestSellers({ products = [], loading = false }) {
  const showSkeletons = loading || products.length === 0

  return (
    <section className="ev-home-section ev-home-section--bestsellers">
      <div className="container">
        <div className="section-header">
          <SectionTitle
            title="Best Sellers"
            subtitle="Top-rated by our community"
          />
          {!showSkeletons && (
            <FadeContent delay={0.1}>
              <Link to="/shop?featured=true" className="section-link">
                View all <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </FadeContent>
          )}
        </div>

        {showSkeletons ? (
          <>
            <SkeletonProductGrid count={3} />
            {products.length === 0 && !loading && <SkeletonCaption />}
          </>
        ) : (
          <div className="products-grid">
            {products.map((p, i) => (
              <FadeContent key={p._id} delay={i * 0.05}>
                <ProductCard product={p} />
              </FadeContent>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
