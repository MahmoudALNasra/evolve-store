import '../ui/SkeletonShimmer.css'

export default function SkeletonProductCard() {
  return (
    <div className="product-card product-card--skeleton" aria-hidden="true">
      <div className="product-card-img-wrap shimmer" />
      <div className="product-card-body product-card-body--skeleton">
        <div className="skeleton-line skeleton-line--title shimmer" />
        <div className="skeleton-line skeleton-line--price shimmer" />
        <div className="skeleton-line skeleton-line--btn shimmer" />
      </div>
    </div>
  )
}

export function SkeletonProductGrid({ count = 3 }) {
  return (
    <div className="products-grid products-grid--skeleton">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonProductCard key={i} />
      ))}
    </div>
  )
}
