import { useEffect, useState } from 'react'
import api from '../lib/api'
import useInView from '../hooks/useInView'
import ProductCard from './ProductCard'
import RelatedProductsSkeleton from './RelatedProductsSkeleton'

/**
 * Lazy-loaded related products (fetches when scrolled into view).
 * @param {{ slug: string }} props
 */
export default function RelatedProducts({ slug }) {
  const [sentinelRef, inView] = useInView({ rootMargin: '240px 0px' })
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setProducts([])
    setLoaded(false)
    setError(false)
    setLoading(false)
  }, [slug])

  useEffect(() => {
    if (!slug || !inView || loaded) return

    let cancelled = false
    setLoading(true)
    setError(false)

    api
      .get(`/products/${slug}/recommendations`)
      .then(({ data }) => {
        if (cancelled) return
        setProducts(data.products || [])
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug, inView, loaded])

  return (
    <section
      ref={sentinelRef}
      className="related-products"
      aria-labelledby="related-products-heading"
    >
      <h2 id="related-products-heading" className="related-products-title">
        You may also like
      </h2>

      {loading && <RelatedProductsSkeleton count={4} />}

      {!loading && error && (
        <p className="related-products-empty" role="status">
          Unable to load recommendations right now.
        </p>
      )}

      {!loading && !error && loaded && products.length === 0 && (
        <p className="related-products-empty" role="status">
          No related products found.
        </p>
      )}

      {!loading && products.length > 0 && (
        <div className="products-grid">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </section>
  )
}
