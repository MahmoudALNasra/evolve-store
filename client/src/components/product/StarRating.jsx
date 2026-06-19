import { Star } from 'lucide-react'

const STAR_COLOR = '#C9A84C'
const STAR_EMPTY = 'rgba(255,255,255,0.15)'

export default function StarRating({ rating, size = 16, className = '' }) {
  const value = Number(rating) || 0

  return (
    <div className={`star-rating ${className}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((step) => {
        const filled = value >= step
        const half = !filled && value >= step - 0.5
        return (
          <Star
            key={step}
            size={size}
            style={{
              fill: filled || half ? STAR_COLOR : STAR_EMPTY,
              color: filled || half ? STAR_COLOR : STAR_EMPTY,
              opacity: half ? 0.65 : 1,
            }}
          />
        )
      })}
    </div>
  )
}
