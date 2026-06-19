import { useEffect, useState, useCallback } from 'react'
import { MapPin, Package, Store } from 'lucide-react'
import api from '../../lib/api'
import useAuthStore from '../../store/useAuthStore'
import useCartStore from '../../store/useCartStore'
import {
  readStoredLocation,
  saveStoredLocation,
  getDefaultUserAddress,
  formatShipLabel,
} from '../../lib/shipLocation'
import { PICKUP_ADDRESS } from '../../lib/pickupTimes'
import { formatDateRange, formatCutoffCountdown } from '../../lib/deliveryEstimate'
import { prefersReducedMotion } from '../../lib/animation'

const STATIC_SHIPPING_DETAIL = 'Free shipping over $150 · Estimated delivery 2–4 business days'

export default function FulfillmentBlock() {
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  const preferredFulfillment = useCartStore((s) => s.preferredFulfillment)
  const setPreferredFulfillment = useCartStore((s) => s.setPreferredFulfillment)

  const [location, setLocation] = useState(readStoredLocation)
  const [editing, setEditing] = useState(false)
  const [zipInput, setZipInput] = useState(location.zip)
  const [selected, setSelected] = useState(preferredFulfillment || 'shipping')
  const [loadingLocation, setLoadingLocation] = useState(!location.zip)
  const [estimate, setEstimate] = useState(null)
  const [loadingEstimate, setLoadingEstimate] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const reduceMotion = prefersReducedMotion()

  const fetchEstimate = useCallback(async (loc) => {
    if (!loc?.zip) {
      setEstimate({ fallback: true, message: STATIC_SHIPPING_DETAIL })
      return
    }

    setLoadingEstimate(true)
    try {
      const { data } = await api.get('/shipping/estimate', {
        params: {
          zip: loc.zip,
          city: loc.city || undefined,
          state: loc.state || undefined,
        },
      })
      setEstimate(data)
      if (data?.minutesUntilCutoff != null) {
        setCountdown(formatCutoffCountdown(data.minutesUntilCutoff))
      }
    } catch {
      setEstimate({ fallback: true, message: STATIC_SHIPPING_DETAIL })
    } finally {
      setLoadingEstimate(false)
    }
  }, [])

  useEffect(() => {
    if (!initialized) return undefined

    let cancelled = false

    async function resolveLocation() {
      const account = getDefaultUserAddress(user)
      if (account) {
        if (!cancelled) {
          setLocation(account)
          saveStoredLocation(account)
          setLoadingLocation(false)
        }
        return
      }

      const stored = readStoredLocation()
      if (stored.zip) {
        if (!cancelled) {
          setLocation(stored)
          setLoadingLocation(false)
        }
        return
      }

      try {
        const { data } = await api.get('/shipping/guess-location')
        const guessed = data?.location
        if (!cancelled && guessed?.zip) {
          setLocation(guessed)
          saveStoredLocation(guessed)
        }
      } catch {
        /* manual fallback */
      } finally {
        if (!cancelled) setLoadingLocation(false)
      }
    }

    resolveLocation()
    return () => { cancelled = true }
  }, [user, initialized])

  useEffect(() => {
    if (selected === 'shipping' && location.zip) {
      fetchEstimate(location)
    }
  }, [selected, location, fetchEstimate])

  useEffect(() => {
    setPreferredFulfillment(selected)
  }, [selected, setPreferredFulfillment])

  useEffect(() => {
    if (selected !== 'shipping' || !estimate?.isNextDay || reduceMotion) return undefined

    const tick = () => {
      if (estimate.minutesUntilCutoff == null) return
      const mins = estimate.minutesUntilCutoff
      setCountdown(formatCutoffCountdown(mins))
    }

    tick()
    const id = window.setInterval(() => {
      setEstimate((prev) => {
        if (!prev || prev.fallback || prev.minutesUntilCutoff == null) return prev
        const nextMins = Math.max(0, prev.minutesUntilCutoff - 1)
        setCountdown(formatCutoffCountdown(nextMins))
        return { ...prev, minutesUntilCutoff: nextMins }
      })
    }, 60_000)

    return () => window.clearInterval(id)
  }, [selected, estimate?.isNextDay, reduceMotion])

  const selectOption = (option) => {
    setSelected(option)
  }

  const saveZip = () => {
    const zip = zipInput.trim().slice(0, 10)
    if (!/^\d{5}(-\d{4})?$/.test(zip)) return
    const next = { zip: zip.slice(0, 5), city: '', state: '', source: 'manual' }
    saveStoredLocation(next)
    setLocation(next)
    setEditing(false)
  }

  const shipLabel = loadingLocation ? 'Detecting location…' : formatShipLabel(location)
  const cutoffTime = estimate?.cutoffTime || '4:50 PM CT'
  const dateRange = estimate?.fallback
    ? null
    : formatDateRange(estimate?.minDate, estimate?.maxDate)

  const shippingCardDetail = loadingEstimate
    ? 'Calculating delivery…'
    : estimate?.fallback
      ? STATIC_SHIPPING_DETAIL
      : dateRange
        ? `Arrives ${dateRange}`
        : STATIC_SHIPPING_DETAIL

  return (
    <section className="product-fulfillment" aria-labelledby="product-fulfillment-heading">
      <h2 id="product-fulfillment-heading" className="sr-only">Shipping and fulfillment</h2>

      <div className="product-fulfillment-cards" role="radiogroup" aria-label="Fulfillment options">
        <button
          type="button"
          role="radio"
          aria-checked={selected === 'shipping'}
          className={`product-fulfillment-card${selected === 'shipping' ? ' is-selected' : ''}`}
          onClick={() => selectOption('shipping')}
        >
          <Package size={18} aria-hidden="true" />
          <span className="product-fulfillment-card-label">Shipping</span>
          <span className="product-fulfillment-card-detail">{shippingCardDetail}</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={selected === 'pickup'}
          className={`product-fulfillment-card${selected === 'pickup' ? ' is-selected' : ''}`}
          onClick={() => selectOption('pickup')}
        >
          <Store size={18} aria-hidden="true" />
          <span className="product-fulfillment-card-label">Pharmacy Pickup</span>
          <span className="product-fulfillment-card-detail">Ready at our pharmacy location</span>
        </button>
      </div>

      {selected === 'shipping' && (
        <div className="product-fulfillment-panel product-fulfillment-panel--shipping">
          <div className="product-ships-to">
            <MapPin size={15} aria-hidden="true" />
            <span>
              Ships to: <strong>{shipLabel || 'Enter ZIP to check'}</strong>
            </span>
            {!editing ? (
              <button type="button" className="product-ships-to-change" onClick={() => setEditing(true)}>
                Change location
              </button>
            ) : (
              <span className="product-ships-to-edit">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="ZIP code"
                  value={zipInput}
                  onChange={(e) => setZipInput(e.target.value)}
                  aria-label="ZIP code"
                />
                <button type="button" onClick={saveZip}>Save</button>
                <button type="button" onClick={() => setEditing(false)}>Cancel</button>
              </span>
            )}
          </div>

          {!estimate?.fallback && dateRange && (
            <p className="product-delivery-range">
              Arrives <strong>{dateRange}</strong>
            </p>
          )}

          {estimate?.isNextDay && countdown && (
            <span className="product-delivery-badge">
              ⚡ Arrives tomorrow if ordered in the next {countdown}
            </span>
          )}

          <p className="product-fulfillment-secondary">
            {estimate?.fallback ? estimate.message : 'Free shipping over $150'}
          </p>
        </div>
      )}

      {selected === 'pickup' && (
        <div className="product-fulfillment-panel product-fulfillment-panel--pickup">
          <p className="product-pickup-line">
            📍 Ready for pickup at our pharmacy · Typically same business day if ordered before {cutoffTime}
          </p>
          <p className="product-pickup-address">
            {PICKUP_ADDRESS.name}<br />
            {PICKUP_ADDRESS.line1}<br />
            {PICKUP_ADDRESS.city}, {PICKUP_ADDRESS.state} {PICKUP_ADDRESS.zip}
          </p>
        </div>
      )}
    </section>
  )
}
