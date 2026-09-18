import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import FadeContent from '@/components/ui/FadeContent'
import ProductCard from '@/components/shop/ProductCard'
import { SkeletonProductGrid } from './SkeletonProductCard'

export default function BestSellers({ products = [], loading = false }) {
  const hasProducts = products.length > 0

  return (
    <section className="ev-home-section ev-home-section--bestsellers">
      <div className="container">
        <div className="section-header">
          <SectionTitle
            title="Best Sellers"
            subtitle="Top-rated by our community"
          />
          {hasProducts && !loading && (
            <FadeContent delay={0.1}>
              <Link to="/shop?featured=true" className="section-link">
                View all <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </FadeContent>
          )}
        </div>

        {loading ? (
          <SkeletonProductGrid count={6} />
        ) : hasProducts ? (
          <div className="products-grid products-grid--home">
            {products.map((p, i) => (
              <FadeContent key={p._id} delay={Math.min(i * 0.04, 0.2)} className="products-grid__item">
                <ProductCard product={p} />
              </FadeContent>
            ))}
          </div>
        ) : (
          <>
            <SkeletonProductGrid count={6} />
            <p className="ev-section-placeholder-caption">
              Our bestsellers are on their way — check back soon.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
