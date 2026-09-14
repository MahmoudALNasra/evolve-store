import { useEffect, useState } from 'react'
import { ExternalLink, Star } from 'lucide-react'
import SectionTitle from '@/components/ui/SectionTitle'
import FadeContent from '@/components/ui/FadeContent'
import api from '@/lib/api'

const FALLBACK_MAPS_URL = 'https://share.google/RLz2KuwpRoi58Qmr2'

function Stars({ value = 0 }) {
  const n = Math.round(Number(value) || 0)
  return (
    <span className="google-review-stars" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < n ? 'currentColor' : 'none'}
          strokeWidth={i < n ? 0 : 1.5}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

export default function GoogleReviewsSection() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.get('/reviews/google')
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
          <div className="google-reviews-grid">
            {reviews.map((r) => (
              <FadeContent key={`${r.authorName}-${r.time || r.relativeTime}`} className="google-review-card">
                <div className="google-review-top">
                  <Stars value={r.rating} />
                  <span className="google-review-time">{r.relativeTime}</span>
                </div>
                <p className="google-review-text">{r.text || 'Rated us on Google.'}</p>
                <p className="google-review-author">{r.authorName}</p>
              </FadeContent>
            ))}
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
