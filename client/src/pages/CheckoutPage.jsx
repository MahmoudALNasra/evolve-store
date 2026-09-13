import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, CreditCard, Clock, PackageCheck, Truck, X, Minus, Plus, Tag } from 'lucide-react'
import useCartStore from '../store/useCartStore'
import useAuthStore from '../store/useAuthStore'
import { useShipLocation } from '../hooks/useShipLocation'
import { formatPrice } from '../lib/utils'
import ProductImage from '../components/ProductImage'
import AddressAutocomplete from '../components/checkout/AddressAutocomplete'
import CheckoutProgress from '../components/checkout/CheckoutProgress'
import { US_STATES, isValidUSZip, isValidStreetAddress, isValidCity } from '../lib/usStates'
import {
  buildPickupDateTime,
  formatPickupAddress,
  getPickupDateBounds,
  getPickupDefaults,
  getPickupTimeOptionsForDate,
  PICKUP_ADDRESS,
} from '../lib/pickupTimes'
import { calculateSalesTaxFromItems, formatSalesTaxRate } from '../lib/salesTax'
import { saveStoredLocation } from '../lib/shipLocation'
import api from '../lib/api'
import toast from 'react-hot-toast'

function isAddressReady(addr) {
  return (
    addr.line1?.trim() &&
    isValidStreetAddress(addr.line1) &&
    addr.city?.trim() &&
    isValidCity(addr.city) &&
    addr.state &&
    addr.zip?.trim() &&
    isValidUSZip(addr.zip)
  )
}

function getApiErrorPayload(err) {
  const data = err.response?.data
  if (data && typeof data === 'object') {
    return {
      message: data.message || 'Something went wrong',
      resolution: data.resolution || '',
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
      code: data.code || '',
    }
  }

  return {
    message: err.response?.data?.message || err.message || 'Something went wrong',
    resolution: '',
    suggestions: [],
    code: '',
  }
}

function showHelpfulErrorToast(err, fallback) {
  const payload = getApiErrorPayload(err)
  const details = [payload.resolution, ...payload.suggestions].filter(Boolean)
  toast.error(
    `${payload.message || fallback}${details.length ? `\n\n${details.slice(0, 2).join('\n')}` : ''}`,
    { duration: 9000 },
  )
  return payload
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, removeItem, updateQty } = useCartStore()
  const user = useAuthStore((s) => s.user)
  const { location: shipLocation } = useShipLocation()

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [shippingAddress, setShippingAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
  })
  const [prefilled, setPrefilled] = useState(false)
  const [fulfillmentMethod, setFulfillmentMethod] = useState('shipping')
  const preferredFulfillment = useCartStore((s) => s.preferredFulfillment)

  useEffect(() => {
    if (preferredFulfillment === 'pickup' || preferredFulfillment === 'shipping') {
      setFulfillmentMethod(preferredFulfillment)
    }
  }, [preferredFulfillment])

  // Prefill city/state/zip from product-page ship-to or saved location once
  useEffect(() => {
    if (prefilled) return
    if (!shipLocation?.zip && !shipLocation?.city) return
    setShippingAddress((prev) => ({
      ...prev,
      city: prev.city || shipLocation.city || '',
      state: prev.state || shipLocation.state || '',
      zip: prev.zip || shipLocation.zip || '',
    }))
    setPrefilled(true)
  }, [shipLocation, prefilled])

  const pickupDefaults = useMemo(() => getPickupDefaults(), [])
  const pickupDateBounds = useMemo(() => getPickupDateBounds(), [])
  const [pickupDate, setPickupDate] = useState(pickupDefaults.date)
  const [pickupTimeValue, setPickupTimeValue] = useState(pickupDefaults.time)
  const pickupTimeOptions = useMemo(() => getPickupTimeOptionsForDate(pickupDate), [pickupDate])
  const pickupTime = buildPickupDateTime(pickupDate, pickupTimeValue)
  const [shippingRates, setShippingRates] = useState([])
  const [selectedRate, setSelectedRate] = useState(null)
  const [ratesLoading, setRatesLoading] = useState(false)
  const [dispatchMessage, setDispatchMessage] = useState('')
  const [shippingRateError, setShippingRateError] = useState(null)
  const [promotionCode, setPromotionCode] = useState('')

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const isPickup = fulfillmentMethod === 'pickup'
  const hasValidZip = isValidUSZip(shippingAddress.zip)
  const hasSelectedShippingRate = Boolean(selectedRate?.token)
  const shipping = isPickup || !hasSelectedShippingRate ? 0 : selectedRate.amount
  const shippingLabel = isPickup ? 'Pharmacy Pickup' : (selectedRate?.label || 'Shipping')
  const shippingSummary = isPickup
    ? 'Free'
    : !hasValidZip
      ? 'Enter ZIP to calculate'
      : ratesLoading
        ? 'Calculating...'
        : hasSelectedShippingRate
          ? selectedRate.amount === 0
            ? 'Free'
            : formatPrice(selectedRate.amount)
          : 'Select option'
  const totalLabel = !isPickup && !hasSelectedShippingRate ? 'Total before shipping' : 'Total'
  const tax = calculateSalesTaxFromItems(items)
  const total = subtotal + shipping + tax

  useEffect(() => {
    if (!pickupTimeOptions.length) {
      setPickupTimeValue('')
      return
    }

    if (!pickupTimeOptions.some((option) => option.value === pickupTimeValue)) {
      setPickupTimeValue(pickupTimeOptions[0].value)
    }
  }, [pickupTimeOptions, pickupTimeValue])

  useEffect(() => {
    if (isPickup || !isAddressReady(shippingAddress)) {
      setShippingRates([])
      setSelectedRate(null)
      setDispatchMessage('')
      setShippingRateError(null)
      return
    }

    const timer =       setTimeout(async () => {
      setRatesLoading(true)
      try {
        const { data } = await api.post('/shipping/rates', {
          shippingAddress,
          items: items.map((i) => ({ product: i._id, quantity: i.quantity })),
        })
        setDispatchMessage(data.dispatch?.message || '')
        setShippingRateError(null)
        const rates = data.rates || []
        setShippingRates(rates)
        if (data.note) {
          setDispatchMessage((prev) => [prev, data.note].filter(Boolean).join(' '))
        }
        setSelectedRate((prev) => {
          if (prev) {
            const refreshedRate = rates.find((r) => r.objectId === prev.objectId)
            if (refreshedRate) return refreshedRate
          }
          return rates[0] || null
        })
      } catch (err) {
        setShippingRates([])
        setSelectedRate(null)
        setShippingRateError(showHelpfulErrorToast(err, 'Could not load shipping rates'))
      } finally {
        setRatesLoading(false)
      }
    }, 1200)

    return () => clearTimeout(timer)
  }, [isPickup, shippingAddress, items, subtotal])

  const handleChange = (e) => {
    let { name, value } = e.target

    if (name === 'zip') {
      value = value.replace(/[^\d-]/g, '').slice(0, 10)
    }

    if (name === 'city') {
      value = value.replace(/[^a-zA-Z\s\-'.]/g, '')
    }

    setShippingAddress((prev) => ({ ...prev, [name]: value }))

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleAddressSelect = useCallback((parsed) => {
    setShippingAddress((prev) => ({
      ...prev,
      line1: parsed.line1 || prev.line1,
      line2: parsed.line2 || prev.line2,
      city: parsed.city || prev.city,
      state: parsed.state || prev.state,
      zip: parsed.zip || prev.zip,
      country: 'United States',
    }))
    if (parsed.zip) {
      saveStoredLocation({
        zip: String(parsed.zip).slice(0, 5),
        city: parsed.city || '',
        state: parsed.state || '',
        source: 'google',
      })
    }
    setErrors((prev) => ({
      ...prev,
      line1: '',
      city: '',
      state: '',
      zip: '',
    }))
    toast.success('Address filled from Google — confirm apt/suite if needed')
  }, [])

  const validateForm = () => {
    const newErrors = {}

    if (isPickup) {
      if (!pickupDate) newErrors.pickupDate = 'Please select a pickup date'
      if (!pickupTimeValue || !pickupTime) newErrors.pickupTime = 'Please select a pickup time'
      if (pickupDate && !pickupTimeOptions.length) {
        newErrors.pickupDate = 'Pickup is available Monday through Friday only'
      }
      setErrors(newErrors)
      return Object.keys(newErrors).length === 0
    }

    if (!shippingAddress.line1.trim()) {
      newErrors.line1 = 'Street address is required'
    } else if (!isValidStreetAddress(shippingAddress.line1)) {
      newErrors.line1 = 'Enter the house/building number before the street name, e.g., 123 Main St'
    }

    if (!shippingAddress.city.trim()) {
      newErrors.city = 'City is required'
    } else if (!isValidCity(shippingAddress.city)) {
      newErrors.city = 'Please enter a valid city name'
    }

    if (!shippingAddress.state) {
      newErrors.state = 'Please select a state'
    }

    if (!shippingAddress.zip.trim()) {
      newErrors.zip = 'ZIP code is required'
    } else if (!isValidUSZip(shippingAddress.zip)) {
      newErrors.zip = 'Enter a valid US ZIP (12345 or 12345-6789)'
    }

    if (!ratesLoading && !selectedRate?.token) {
      newErrors.shipping = isAddressReady(shippingAddress)
        ? 'Please select a shipping option'
        : 'Enter your full address to see shipping options'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error('Please fix the errors in the form')
      return
    }

    setLoading(true)
    try {
      const { data } = await api.post('/checkout', {
        items: items.map((item) => ({ product: item._id, quantity: item.quantity })),
        shippingAddress,
        fulfillmentMethod,
        pickupTime: isPickup ? pickupTime : undefined,
        shippingRateToken: isPickup ? undefined : selectedRate?.token,
        promotionCode: promotionCode.trim() || undefined,
      })

      window.location.href = data.url
    } catch (err) {
      showHelpfulErrorToast(err, 'Checkout failed')
      setLoading(false)
    }
  }

  if (!user) {
    navigate('/login?redirect=/checkout')
    return null
  }

  if (items.length === 0) {
    navigate('/cart')
    return null
  }

  return (
    <div className="checkout-page">
      <div className="checkout-page-header">
        <button type="button" className="checkout-back" onClick={() => navigate('/cart')}>
          <ArrowLeft size={16} /> Back to Cart
        </button>
        <h1 className="checkout-page-title">Checkout</h1>
        <p className="checkout-page-sub">Review your order, add delivery details, then pay securely.</p>
      </div>

      <CheckoutProgress current="details" />

      <div className="checkout-layout responsive-side-grid">
        <div>
          <form onSubmit={handleSubmit}>
            <div className="checkout-card">
              <h2 style={{ marginBottom: 14 }}>Delivery Method</h2>
              <div className="checkout-method-grid">
                <button
                  type="button"
                  className={`checkout-method-btn${!isPickup ? ' is-active' : ''}`}
                  onClick={() => setFulfillmentMethod('shipping')}
                >
                  <strong><Truck size={16} /> Ship to me</strong>
                  <span>Delivery to your address</span>
                </button>
                <button
                  type="button"
                  className={`checkout-method-btn${isPickup ? ' is-active' : ''}`}
                  onClick={() => setFulfillmentMethod('pickup')}
                >
                  <strong><PackageCheck size={16} /> Pick up</strong>
                  <span>Free pickup at the pharmacy</span>
                </button>
              </div>
            </div>

            {isPickup && (
              <div className="checkout-card">
                <div className="checkout-card-title-row">
                  <div className="checkout-card-icon"><Clock size={20} /></div>
                  <div>
                    <h2>Pickup Details</h2>
                    <p className="checkout-card-sub">Monday – Friday, 9:00 AM – 5:00 PM</p>
                  </div>
                </div>
                <div className="checkout-notice checkout-notice--pickup">
                  <strong>{PICKUP_ADDRESS.name}</strong>
                  <br />
                  {formatPickupAddress()}
                </div>
                <div className="checkout-row-2">
                  <div className="checkout-field">
                    <label className="checkout-label" htmlFor="pickup-date">Pickup Date *</label>
                    <input
                      id="pickup-date"
                      type="date"
                      className={`checkout-input${errors.pickupDate ? ' checkout-input--error' : ''}`}
                      value={pickupDate}
                      min={pickupDateBounds.min}
                      max={pickupDateBounds.max}
                      onChange={(e) => {
                        const nextDate = e.target.value
                        const nextOptions = getPickupTimeOptionsForDate(nextDate)
                        setPickupDate(nextDate)
                        setPickupTimeValue(nextOptions[0]?.value || '')
                        if (errors.pickupDate) setErrors({ ...errors, pickupDate: '' })
                      }}
                    />
                    {errors.pickupDate && <p className="checkout-error">{errors.pickupDate}</p>}
                  </div>
                  <div className="checkout-field">
                    <label className="checkout-label" htmlFor="pickup-time">Pickup Time *</label>
                    <select
                      id="pickup-time"
                      className={`checkout-select${errors.pickupTime ? ' checkout-input--error' : ''}`}
                      value={pickupTimeValue}
                      onChange={(e) => {
                        setPickupTimeValue(e.target.value)
                        if (errors.pickupTime) setErrors({ ...errors, pickupTime: '' })
                      }}
                      disabled={!pickupTimeOptions.length}
                    >
                      {pickupTimeOptions.length ? (
                        pickupTimeOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))
                      ) : (
                        <option value="">Closed this day</option>
                      )}
                    </select>
                    {errors.pickupTime && <p className="checkout-error">{errors.pickupTime}</p>}
                  </div>
                </div>
                <p className="checkout-hint" style={{ marginTop: 8 }}>
                  Earliest pickup is at least 1 hour from now; late orders move to the next business day.
                </p>
              </div>
            )}

            {!isPickup && (
              <div className="checkout-card">
                <div className="checkout-card-title-row">
                  <div className="checkout-card-icon"><MapPin size={20} /></div>
                  <div>
                    <h2>Shipping Address</h2>
                    <p className="checkout-card-sub">Where should we deliver your order?</p>
                  </div>
                </div>

                <div className="checkout-notice checkout-notice--info">
                  We currently ship to addresses within the United States only.
                </div>

                <div className="checkout-fields">
                  <AddressAutocomplete
                    value={shippingAddress.line1}
                    onChange={handleChange}
                    onAddressSelect={handleAddressSelect}
                    error={errors.line1}
                    disabled={loading}
                  />

                  <div className="checkout-field">
                    <label className="checkout-label" htmlFor="line2">Apartment, suite, etc. (optional)</label>
                    <input
                      id="line2"
                      type="text"
                      name="line2"
                      className="checkout-input"
                      value={shippingAddress.line2}
                      onChange={handleChange}
                      placeholder="Apt 4B"
                      autoComplete="address-line2"
                      disabled={loading}
                    />
                  </div>

                  <div className="checkout-field">
                    <label className="checkout-label" htmlFor="city">City *</label>
                    <input
                      id="city"
                      type="text"
                      name="city"
                      className={`checkout-input${errors.city ? ' checkout-input--error' : ''}`}
                      value={shippingAddress.city}
                      onChange={handleChange}
                      placeholder="San Antonio"
                      autoComplete="address-level2"
                      disabled={loading}
                    />
                    {errors.city && <p className="checkout-error">{errors.city}</p>}
                  </div>

                  <div className="checkout-row-2">
                    <div className="checkout-field">
                      <label className="checkout-label" htmlFor="state">State *</label>
                      <select
                        id="state"
                        name="state"
                        className={`checkout-select${errors.state ? ' checkout-input--error' : ''}`}
                        value={shippingAddress.state}
                        onChange={handleChange}
                        autoComplete="address-level1"
                        disabled={loading}
                      >
                        <option value="">Select state…</option>
                        {US_STATES.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                      {errors.state && <p className="checkout-error">{errors.state}</p>}
                    </div>

                    <div className="checkout-field">
                      <label className="checkout-label" htmlFor="zip">ZIP Code *</label>
                      <input
                        id="zip"
                        type="text"
                        name="zip"
                        className={`checkout-input${errors.zip ? ' checkout-input--error' : ''}`}
                        value={shippingAddress.zip}
                        onChange={handleChange}
                        placeholder="78201 or 78201-1234"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        maxLength={10}
                        disabled={loading}
                      />
                      {errors.zip && <p className="checkout-error">{errors.zip}</p>}
                    </div>
                  </div>

                  <div className="checkout-field">
                    <label className="checkout-label" htmlFor="country">Country</label>
                    <input
                      id="country"
                      type="text"
                      name="country"
                      className="checkout-input"
                      value={shippingAddress.country}
                      readOnly
                    />
                  </div>

                  {isAddressReady(shippingAddress) && (
                    <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                        Shipping options
                      </h4>
                      {dispatchMessage && <p className="checkout-hint" style={{ marginBottom: 12 }}>{dispatchMessage}</p>}
                      {ratesLoading ? (
                        <p className="checkout-hint">Loading carrier rates…</p>
                      ) : shippingRateError ? (
                        <div className="checkout-alert" role="alert">
                          <strong style={{ display: 'block', marginBottom: 4 }}>
                            {shippingRateError.message || 'Could not load shipping rates'}
                          </strong>
                          {shippingRateError.resolution && <p style={{ margin: '0 0 8px' }}>{shippingRateError.resolution}</p>}
                          {shippingRateError.suggestions?.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {shippingRateError.suggestions.map((suggestion) => (
                                <li key={suggestion}>{suggestion}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : shippingRates.length === 0 ? (
                        <p className="checkout-hint">No shipping options available.</p>
                      ) : (
                        <div className="checkout-rate-list">
                          {shippingRates.map((rate) => (
                            <label
                              key={rate.objectId}
                              className={`checkout-rate${selectedRate?.objectId === rate.objectId ? ' is-active' : ''}`}
                            >
                              <input
                                type="radio"
                                name="shippingRate"
                                checked={selectedRate?.objectId === rate.objectId}
                                onChange={() => {
                                  setSelectedRate(rate)
                                  if (errors.shipping) setErrors({ ...errors, shipping: '' })
                                }}
                              />
                              <span className="checkout-rate-meta">
                                {rate.label}
                                {rate.estimatedDays != null && (
                                  <small>
                                    {' '}
                                    · est. {rate.estimatedDays} day{rate.estimatedDays === 1 ? '' : 's'}
                                  </small>
                                )}
                              </span>
                              <span className="checkout-rate-price">
                                {rate.amount === 0 ? 'Free' : formatPrice(rate.amount)}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                      {errors.shipping && <p className="checkout-error" style={{ marginTop: 8 }}>{errors.shipping}</p>}
                    </div>
                  )}
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary checkout-submit">
              {loading ? 'Processing…' : (<><CreditCard size={18} /> Continue to Payment</>)}
            </button>
          </form>
        </div>

        <aside>
          <div className="checkout-card checkout-summary">
            <h3 style={{ marginBottom: 16 }}>Order preview</h3>

            <div className="checkout-summary-items">
              {items.map((item) => (
                <div key={item._id} className="checkout-summary-row">
                  <ProductImage
                    images={item.images}
                    alt={item.name}
                    variant="checkout"
                    width={60}
                    height={60}
                    className="checkout-item-img"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="checkout-summary-name">{item.name}</p>
                    <div className="checkout-qty" aria-label={`Quantity for ${item.name}`}>
                      <button
                        type="button"
                        onClick={() => {
                          updateQty(item._id, item.quantity - 1)
                          setSelectedRate(null)
                        }}
                        disabled={loading || item.quantity <= 1}
                        aria-label={`Decrease ${item.name} quantity`}
                      >
                        <Minus size={12} />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          updateQty(item._id, item.quantity + 1)
                          setSelectedRate(null)
                        }}
                        disabled={loading}
                        aria-label={`Increase ${item.name} quantity`}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <p className="checkout-summary-price">{formatPrice(item.price * item.quantity)}</p>
                    <button
                      type="button"
                      className="checkout-remove"
                      onClick={() => removeItem(item._id)}
                      disabled={loading}
                      aria-label={`Remove ${item.name} from cart`}
                      title="Remove"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <label className="checkout-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Tag size={14} /> Promo code
              </label>
              <input
                type="text"
                className="checkout-input"
                value={promotionCode}
                onChange={(e) => setPromotionCode(e.target.value.toUpperCase())}
                placeholder="e.g. WELCOME15"
                autoComplete="off"
                disabled={loading}
              />
              <p className="checkout-hint" style={{ marginTop: 6 }}>
                Optional. You can also enter a code on the secure payment page.
              </p>
            </div>

            <div className="checkout-totals">
              <div className="checkout-totals-line">
                <span>Subtotal</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <div className="checkout-totals-line">
                <span>{shippingLabel}</span>
                <strong>{shippingSummary}</strong>
              </div>
              {isPickup && (
                <p className="checkout-hint" style={{ marginTop: -4 }}>Pickup at {formatPickupAddress()}.</p>
              )}
              {!isPickup && dispatchMessage && (
                <p className="checkout-hint" style={{ marginTop: -4 }}>{dispatchMessage}</p>
              )}
              <div className="checkout-totals-line">
                <span>Sales Tax ({formatSalesTaxRate()})</span>
                <strong>{formatPrice(tax)}</strong>
              </div>
            </div>

            <div className="checkout-total">
              <span>{totalLabel}</span>
              <span>{formatPrice(total)}</span>
            </div>

            <div className="checkout-secure">
              <strong>Secure checkout</strong>
              <br />
              Next you’ll pay on Stripe. Your card details never touch our servers.
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
