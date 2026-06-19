import { useEffect, useState } from 'react'
import { MapPin, Package, Store } from 'lucide-react'
import useAuthStore from '../../store/useAuthStore'

const ZIP_KEY = 'evolve_ship_zip'
const CITY_KEY = 'evolve_ship_city'

function readStoredLocation() {
  try {
    return {
      zip: localStorage.getItem(ZIP_KEY) || '',
      city: localStorage.getItem(CITY_KEY) || '',
    }
  } catch {
    return { zip: '', city: '' }
  }
}

export default function FulfillmentBlock() {
  const user = useAuthStore((s) => s.user)
  const [location, setLocation] = useState(readStoredLocation)
  const [editing, setEditing] = useState(false)
  const [zipInput, setZipInput] = useState(location.zip)
  const [selected, setSelected] = useState('shipping')

  useEffect(() => {
    if (user?.address?.zip) {
      setLocation({
        zip: user.address.zip,
        city: user.address.city || user.address.state || '',
      })
    }
  }, [user])

  const saveZip = () => {
    const zip = zipInput.trim().slice(0, 10)
    if (!/^\d{5}(-\d{4})?$/.test(zip)) return
    try {
      localStorage.setItem(ZIP_KEY, zip)
      localStorage.setItem(CITY_KEY, 'your area')
    } catch { /* ignore */ }
    setLocation({ zip, city: 'your area' })
    setEditing(false)
  }

  const shipLabel = location.zip
    ? `${location.city ? `${location.city}, ` : ''}${location.zip}`
    : 'Enter ZIP to check'

  return (
    <section className="product-fulfillment" aria-labelledby="product-fulfillment-heading">
      <h2 id="product-fulfillment-heading" className="sr-only">Shipping and fulfillment</h2>

      <div className="product-ships-to">
        <MapPin size={15} aria-hidden="true" />
        <span>
          Ships to: <strong>{shipLabel}</strong>
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
