import '../ui/SkeletonShimmer.css'

export default function SkeletonCategoryCard() {
  return (
    <div className="category-card category-card--skeleton" aria-hidden="true">
      <div className="category-card-icon shimmer category-skeleton-icon" />
      <div className="skeleton-line skeleton-line--cat shimmer" />
    </div>
  )
}

export function SkeletonCategoryGrid({ count = 6 }) {
  return (
    <div className="category-grid category-grid--skeleton">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCategoryCard key={i} />
      ))}
    </div>
  )
}
