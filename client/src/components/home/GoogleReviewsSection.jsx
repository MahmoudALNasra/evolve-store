import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Star, User } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import SectionTitle from '@/components/ui/SectionTitle'
import api from '@/lib/api'

const FALLBACK_MAPS_URL = 'https://share.google/RLz2KuwpRoi58Qmr2'

function Stars({ value = 0 }) {
  const n = Math.round(Number(value) || 0)
  return (
    <span className="google-review-stars" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={13}
          fill={i < n ? 'currentColor' : 'none'}
          strokeWidth={i < n ? 0 : 1.5}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

function ReviewAvatar({ name, photoUrl }) {
  const [failed, setFailed] = useState(false)
  const initial = String(name || 'G').trim().charAt(0).toUpperCase() || 'G'

  if (!photoUrl || failed) {
    return (
      <span className="google-review-avatar google-review-avatar--fallback" aria-hidden="true">
        {initial || <User size={16} />}
      </span>
    )
  }

  return (
    <img
      className="google-review-avatar"
      src={photoUrl}
      alt=""
      width={44}
      height={44}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

function ReviewCard({ review }) {
  return (
    <article className="google-review-card">
      <div className="google-review-author-row">
        <ReviewAvatar name={review.authorName} photoUrl={review.profilePhotoUrl} />
        <div className="google-review-author-meta">
          <p className="google-review-author">{review.authorName}</p>
          <div className="google-review-top">
            <Stars value={review.rating} />
            <span className="google-review-time">{review.relativeTime}</span>
          </div>
        </div>
      </div>
      <p className="google-review-text">{review.text || 'Rated us on Google.'}</p>
    </article>
  )
}

/** Repeat until we have enough cards for a smooth looping track. */
function padReviews(list, minCount = 8) {
  if (!list.length) return []
  const out = [...list]
  let i = 0
  while (out.length < minCount) {
    out.push({ ...list[i % list.length], _pad: `${out.length}` })
    i += 1
  }
  return out
}

function ReviewMarqueeRow({ reviews, direction = 'left', reduced }) {
  const track = useMemo(() => [...reviews, ...reviews], [reviews])

  return (
    <div
      className={`google-reviews-marquee google-reviews-marquee--${direction}${reduced ? ' is-static' : ''}`}
      aria-hidden={false}
    >
      <div className="google-reviews-track">
        {track.map((r, idx) => (
          <ReviewCard
            key={`${r.authorName}-${r.time || r.relativeTime}-${r._pad || ''}-${idx}`}
            review={r}
          />
        ))}
      </div>
    </div>
  )
}

export default function GoogleReviewsSection() {
  const reduced = useReducedMotion()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.get('/reviews/google', { params: { limit: 10 } })
      .then(({ data: payload }) => {
        if (!cancelled) setData(payload)
      })
      .catch(() => {
        if (!cancelled) {
          setData({
            configured: false,
            mapsUrl: FALLBACK_MAPS_URL,
            reviews: [],
            rating: null,
            userRatingsTotal: null,
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const mapsUrl = data?.mapsUrl || FALLBACK_MAPS_URL
  const reviews = data?.reviews || []

  const rowA = useMemo(() => padReviews(reviews, 8), [reviews])
  const rowB = useMemo(() => {
    const flipped = [...reviews].reverse()
    return padReviews(flipped.length ? flipped : reviews, 8)
  }, [reviews])

  return (
    <section className="ev-home-section google-reviews-section">
      <div className="why-inner">
        <div className="ev-trust-header">
          <SectionTitle
            title="What Guests Say on Google"
            subtitle={
              data?.rating
                ? `${data.rating.toFixed(1)} average from ${data.userRatingsTotal || reviews.length}+ Google reviews`
                : 'Real feedback from our San Antonio pharmacy community'
            }
            align="center"
          />
        </div>

        {loading ? (
          <p className="checkout-hint" style={{ textAlign: 'center' }}>Loading Google reviews…</p>
        ) : reviews.length > 0 ? (
          <div className="google-reviews-rotator" aria-label="Google customer reviews">
            <ReviewMarqueeRow reviews={rowA} direction="left" reduced={reduced} />
            <ReviewMarqueeRow reviews={rowB} direction="right" reduced={reduced} />
          </div>
        ) : (
          <div className="google-reviews-empty checkout-card" style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
            <p className="checkout-page-sub" style={{ marginBottom: 16 }}>
              See our latest Google Business Profile reviews and leave your own experience.
            </p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
            style={{ display: 'inline-flex', gap: 8 }}
          >
            Read Google reviews <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </section>
  )
}
