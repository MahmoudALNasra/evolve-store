/** Placeholder grid matching ProductCard layout (prevents CLS while recommendations load). */
export default function RelatedProductsSkeleton({ count = 4 }) {
  return (
    <div className="products-grid related-products-skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="product-card related-skeleton-card">
          <div className="related-skeleton-img" />
          <div className="related-skeleton-body">
            <div className="related-skeleton-line related-skeleton-line--sm" />
            <div className="related-skeleton-line related-skeleton-line--md" />
            <div className="related-skeleton-line related-skeleton-line--lg" />
            <div className="related-skeleton-btn" />
          </div>
        </div>
      ))}
    </div>
  )
}
