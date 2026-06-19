import { useEffect, useState } from 'react'
import { MapPin, Package, Store } from 'lucide-react'
import api from '../../lib/api'
import useAuthStore from '../../store/useAuthStore'
import {
  readStoredLocation,
  saveStoredLocation,
  getDefaultUserAddress,
  formatShipLabel,
} from '../../lib/shipLocation'

export default function FulfillmentBlock() {
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  const [location, setLocation] = useState(readStoredLocation)
  const [editing, setEditing] = useState(false)
  const [zipInput, setZipInput] = useState(location.zip)
  const [selected, setSelected] = useState('shipping')
  const [loading, setLoading] = useState(!location.zip)

  useEffect(() => {
    if (!initialized) return undefined

    let cancelled = false

    async function resolveLocation() {
      const account = getDefaultUserAddress(user)
      if (account) {
        if (!cancelled) {
          setLocation(account)
          saveStoredLocation(account)
          setLoading(false)
        }
        return
      }

      const stored = readStoredLocation()
      if (stored.zip) {
        if (!cancelled) {
          setLocation(stored)
          setLoading(false)
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
        /* keep manual fallback */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    resolveLocation()
    return () => { cancelled = true }
  }, [user, initialized])

  const saveZip = () => {
    const zip = zipInput.trim().slice(0, 10)
    if (!/^\d{5}(-\d{4})?$/.test(zip)) return
    const next = { zip: zip.slice(0, 5), city: '', state: '', source: 'manual' }
    saveStoredLocation(next)
    setLocation(next)
    setEditing(false)
  }

  const shipLabel = loading ? 'Detecting location…' : formatShipLabel(location)

  return (
    <section className="product-fulfillment" aria-labelledby="product-fulfillment-heading">
      <h2 id="product-fulfillment-heading" className="sr-only">Shipping and fulfillment</h2>

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

      <div className="product-fulfillment-cards" role="radiogroup" aria-label="Fulfillment options">
        <button
          type="button"
          role="radio"
          aria-checked={selected === 'shipping'}
          className={`product-fulfillment-card${selected === 'shipping' ? ' is-selected' : ''}`}
          onClick={() => setSelected('shipping')}
        >
          <Package size={18} aria-hidden="true" />
          <span className="product-fulfillment-card-label">Shipping</span>
          <span className="product-fulfillment-card-detail">Free over $150 · 2–4 business days</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={selected === 'pickup'}
          className={`product-fulfillment-card${selected === 'pickup' ? ' is-selected' : ''}`}
          onClick={() => setSelected('pickup')}
        >
          <Store size={18} aria-hidden="true" />
          <span className="product-fulfillment-card-label">Pharmacy Pickup</span>
          <span className="product-fulfillment-card-detail">Available at our location</span>
        </button>
      </div>
    </section>
  )
}
