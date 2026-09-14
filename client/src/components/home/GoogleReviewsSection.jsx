import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Star, User } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import SectionTitle from '@/components/ui/SectionTitle'
import api from '@/lib/api'

const FALLBACK_MAPS_URL = 'https://share.google/RLz2KuwpRoi58Qmr2'
const PAGE_SIZE_DESKTOP = 6
const PAGE_SIZE_MOBILE = 4
const ROTATE_MS = 7000

function usePageSize() {
  const [size, setSize] = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
      ? PAGE_SIZE_MOBILE
      : PAGE_SIZE_DESKTOP
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const apply = () => setSize(mq.matches ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return size
}

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

function chunkReviews(list, size) {
  if (!list.length) return []
  const pages = []
  for (let i = 0; i < list.length; i += size) {
    pages.push(list.slice(i, i + size))
  }
  // If only one page and few cards, still show them in the grid
  return pages
}

export default function GoogleReviewsSection() {
  const reduced = useReducedMotion()
  const pageSize = usePageSize()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get('/reviews/google', { params: { limit: 12 } })
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
  const pages = useMemo(() => chunkReviews(reviews, pageSize), [reviews, pageSize])
  const pageCount = pages.length
  const safePage = pageCount ? page % pageCount : 0
  const visible = pages[safePage] || []

  useEffect(() => {
    setPage(0)
  }, [pageSize])

  useEffect(() => {
    if (reduced || paused || pageCount <= 1) return undefined
    const id = setInterval(() => {
      setPage((p) => (p + 1) % pageCount)
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [reduced, paused, pageCount])

  const goPrev = () => setPage((p) => (p - 1 + pageCount) % pageCount)
  const goNext = () => setPage((p) => (p + 1) % pageCount)

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
          <div
            className="google-reviews-rotator"
            aria-label="Google customer reviews"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={safePage}
                className="google-reviews-grid"
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                {visible.map((r) => (
                  <ReviewCard
                    key={`${r.authorName}-${r.time || r.relativeTime}-${r.text?.slice(0, 24)}`}
                    review={r}
                  />
                ))}
              </motion.div>
            </AnimatePresence>

            {pageCount > 1 && (
              <div className="google-reviews-controls">
                <button type="button" className="google-reviews-nav" onClick={goPrev} aria-label="Previous reviews">
                  <ChevronLeft size={18} />
                </button>
                <div className="google-reviews-dots" role="tablist" aria-label="Review pages">
                  {pages.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={i === safePage}
                      className={`google-reviews-dot${i === safePage ? ' is-active' : ''}`}
                      onClick={() => setPage(i)}
                      aria-label={`Show reviews page ${i + 1}`}
                    />
                  ))}
                </div>
                <button type="button" className="google-reviews-nav" onClick={goNext} aria-label="Next reviews">
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
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
