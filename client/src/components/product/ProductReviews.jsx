import { useEffect, useState } from 'react'
import api from '../../lib/api'
import useAuthStore from '../../store/useAuthStore'
import StarRating from './StarRating'
import { hasProductReviews } from '../../lib/seoUtils'

function formatRelativeDate(dateStr) {
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}

export default function ProductReviews({ slug, product }) {
  const user = useAuthStore((s) => s.user)
  const [reviews, setReviews] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ rating: 5, title: '', body: '', authorName: user?.name || '' })

  useEffect(() => {
    if (!slug) return
    api.get(`/products/${slug}/reviews`)
      .then(({ data }) => setReviews(data.reviews || []))
      .catch(() => setReviews([]))
      .finally(() => setLoaded(true))
  }, [slug])

  useEffect(() => {
    if (user?.name) setForm((f) => ({ ...f, authorName: user.name }))
  }, [user?.name])

  if (!loaded) return null

  const showAggregate = hasProductReviews(product)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { data } = await api.post(`/products/${slug}/reviews`, form)
      setReviews((prev) => [data.review, ...prev])
      setForm({ rating: 5, title: '', body: '', authorName: user?.name || '' })
    } catch {
      /* graceful — form stays visible */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="product-reviews" className="product-reviews" aria-labelledby="product-reviews-heading">
      <h2 id="product-reviews-heading" className="product-section-heading">Customer Reviews</h2>

      {showAggregate && (
        <div className="product-reviews-summary">
          <StarRating rating={product.rating} size={18} />
          <span>{product.rating.toFixed(1)} · {product.numReviews} review{product.numReviews !== 1 ? 's' : ''}</span>
        </div>
      )}

      <form className="product-review-form" onSubmit={handleSubmit}>
        <fieldset className="product-review-stars-input">
          <legend className="sr-only">Your rating</legend>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`product-review-star-btn${form.rating >= n ? ' active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, rating: n }))}
              aria-label={`Rate ${n} stars`}
            >
              ★
            </button>
          ))}
        </fieldset>
        <input
          type="text"
          placeholder="Review title (optional)"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <textarea
          placeholder="Share your experience…"
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          required
          minLength={10}
          rows={4}
        />
        {!user && (
          <input
            type="text"
            placeholder="Your name"
            value={form.authorName}
            onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
            required
          />
        )}
        <button type="submit" className="btn-add-to-cart-lg" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
      </form>

      {reviews.length > 0 && (
        <ul className="product-review-list">
          {reviews.map((review) => (
            <li key={review._id} className="product-review-card">
              <div className="product-review-card-header">
                <StarRating rating={review.rating} size={14} />
                {review.title && <strong>{review.title}</strong>}
              </div>
              <p>{review.body}</p>
              <footer>
                {review.authorName} · {formatRelativeDate(review.createdAt)}
                {review.isVerifiedPurchase && ' · Verified purchase'}
              </footer>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function ProductReviewLink({ product }) {
  if (!hasProductReviews(product)) return null

  return (
    <a href="#product-reviews" className="product-details-stars-link">
      <StarRating rating={product.rating} size={16} />
      <span className="product-details-stars-text">
        {product.rating.toFixed(1)} ({product.numReviews} review{product.numReviews !== 1 ? 's' : ''})
      </span>
    </a>
  )
}
