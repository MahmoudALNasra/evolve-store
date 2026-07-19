import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, CreditCard, Clock, PackageCheck, Truck, X, Minus, Plus, Tag } from 'lucide-react'
import useCartStore from '../store/useCartStore'
import useAuthStore from '../store/useAuthStore'
import { formatPrice } from '../lib/utils'
import ProductImage from '../components/ProductImage'
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
    { duration: 9000 }
  )
  return payload
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, removeItem, updateQty } = useCartStore()
  const user = useAuthStore((s) => s.user)
  
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
  const [fulfillmentMethod, setFulfillmentMethod] = useState('shipping')
  const preferredFulfillment = useCartStore((s) => s.preferredFulfillment)

  useEffect(() => {
    if (preferredFulfillment === 'pickup' || preferredFulfillment === 'shipping') {
      setFulfillmentMethod(preferredFulfillment)
    }
  }, [preferredFulfillment])

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

    const timer = setTimeout(async () => {
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
    }, 600)

    return () => clearTimeout(timer)
  }, [isPickup, shippingAddress, items, subtotal])

  const handleChange = (e) => {
    let { name, value } = e.target
    
    // Auto-format ZIP: only digits and optional hyphen, max 10 chars (12345-6789)
    if (name === 'zip') {
      value = value.replace(/[^\d-]/g, '').slice(0, 10)
    }
    
    // City: strip numbers and most special chars as typed
    if (name === 'city') {
      value = value.replace(/[^a-zA-Z\s\-'.]/g, '')
    }
    
    setShippingAddress({ ...shippingAddress, [name]: value })
    
    // Clear error for this field on change
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' })
    }
  }

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
    
    // Street address
    if (!shippingAddress.line1.trim()) {
      newErrors.line1 = 'Street address is required'
    } else if (!isValidStreetAddress(shippingAddress.line1)) {
      newErrors.line1 = 'Enter the house/building number before the street name, e.g., 123 Main St'
    }
    
    // City
    if (!shippingAddress.city.trim()) {
      newErrors.city = 'City is required'
    } else if (!isValidCity(shippingAddress.city)) {
      newErrors.city = 'Please enter a valid city name'
    }
    
    // State
    if (!shippingAddress.state) {
      newErrors.state = 'Please select a state'
    }
    
    // ZIP code
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
      console.log('💳 Creating Stripe checkout session with address:', shippingAddress)
      
      const { data } = await api.post('/checkout', {
        items: items.map(item => ({ product: item._id, quantity: item.quantity })),
        shippingAddress,
        fulfillmentMethod,
        pickupTime: isPickup ? pickupTime : undefined,
        shippingRateToken: isPickup ? undefined : selectedRate?.token,
        promotionCode: promotionCode.trim() || undefined,
      })
      
      console.log('✅ Stripe session created:', data.url)
      
      // Redirect to Stripe
      window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
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
    <div style={{ background: '#f9fafb', minHeight: '100vh', padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <button
            onClick={() => navigate('/cart')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: '#2d7a3a',
              fontWeight: 600,
              fontSize: 14,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginBottom: 16
            }}
          >
            <ArrowLeft size={16} /> Back to Cart
          </button>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Checkout</h1>
          <p style={{ color: '#6b7280', fontSize: 15 }}>Complete your order by providing shipping details</p>
        </div>

        <div className="responsive-side-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 32 }}>
          {/* Left: Shipping Form */}
          <div>
            <form onSubmit={handleSubmit}>
              <div className="card" style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>Delivery Method</h2>
                <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod('shipping')}
                    style={{
                      textAlign: 'left',
                      padding: 16,
                      borderRadius: 12,
                      border: `1.5px solid ${!isPickup ? '#2d7a3a' : '#e5e7eb'}`,
                      background: !isPickup ? '#f0f9f4' : '#fff',
                      color: '#1a1a1a',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, marginBottom: 6 }}>
                      <Truck size={16} /> Ship to me
                    </span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Delivery to your address</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod('pickup')}
                    style={{
                      textAlign: 'left',
                      padding: 16,
                      borderRadius: 12,
                      border: `1.5px solid ${isPickup ? '#2d7a3a' : '#e5e7eb'}`,
                      background: isPickup ? '#f0f9f4' : '#fff',
                      color: '#1a1a1a',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, marginBottom: 6 }}>
                      <PackageCheck size={16} /> Pick up
                    </span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Free pickup at the pharmacy</span>
                  </button>
                </div>
              </div>

              {isPickup && (
                <div className="card" style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                    <div style={{ width: 40, height: 40, background: '#f0f9f4', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={20} style={{ color: '#2d7a3a' }} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>Pickup Details</h2>
                      <p style={{ fontSize: 13, color: '#9ca3af' }}>Monday - Friday, 9:00 AM - 5:00 PM</p>
                    </div>
                  </div>
                  <div style={{ background: '#f8f6f0', border: '1px solid #ede5d3', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    <strong>{PICKUP_ADDRESS.name}</strong><br />
                    {formatPickupAddress()}
                  </div>
                  <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        Pickup Date *
                      </label>
                      <input
                        type="date"
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
                        style={{ width: '100%', padding: '12px 16px', fontSize: 14, border: `1.5px solid ${errors.pickupDate ? '#dc2626' : '#e5e7eb'}`, borderRadius: 10, background: '#fff' }}
                      />
                      {errors.pickupDate && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.pickupDate}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        Pickup Time *
                      </label>
                      <select
                        value={pickupTimeValue}
                        onChange={(e) => {
                          setPickupTimeValue(e.target.value)
                          if (errors.pickupTime) setErrors({ ...errors, pickupTime: '' })
                        }}
                        disabled={!pickupTimeOptions.length}
                        style={{ width: '100%', padding: '12px 16px', fontSize: 14, border: `1.5px solid ${errors.pickupTime ? '#dc2626' : '#e5e7eb'}`, borderRadius: 10, background: '#fff' }}
                      >
                        {pickupTimeOptions.length ? (
                          pickupTimeOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))
                        ) : (
                          <option value="">Closed this day</option>
                        )}
                      </select>
                      {errors.pickupTime && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.pickupTime}</p>}
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                    Choose any weekday. Earliest pickup is at least 1 hour from now; late orders move to the next business day.
                  </p>
                </div>
              )}

              {!isPickup && (
              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    background: 'linear-gradient(135deg, #d1f4e0 0%, #a7e9c5 100%)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <MapPin size={20} style={{ color: '#2d7a3a' }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>Shipping Address</h2>
                    <p style={{ fontSize: 13, color: '#9ca3af' }}>Where should we deliver your order?</p>
                  </div>
                </div>

                {/* US-only notice */}
                <div style={{
                  padding: '10px 14px',
                  background: '#fef9e7',
                  border: '1px solid #fde68a',
                  borderRadius: 8,
                  marginBottom: 20,
                  fontSize: 12,
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span style={{ fontSize: 14 }}>🇺🇸</span>
                  We currently ship to addresses within the United States only.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Street Address *
                    </label>
                    <input
                      type="text"
                      name="line1"
                      value={shippingAddress.line1}
                      onChange={handleChange}
                      placeholder="123 Main St (number first)"
                      autoComplete="address-line1"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 14,
                        border: `1.5px solid ${errors.line1 ? '#dc2626' : '#e5e7eb'}`,
                        borderRadius: '10px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => !errors.line1 && (e.target.style.borderColor = '#2d7a3a')}
                      onBlur={(e) => !errors.line1 && (e.target.style.borderColor = '#e5e7eb')}
                    />
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6, lineHeight: 1.45 }}>
                      Use the carrier format: house/building number first, then street name.
                      Example: <strong>123 Main St</strong>, not <strong>Main St 123</strong>.
                    </p>
                    {errors.line1 && (
                      <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.line1}</p>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Apartment, suite, etc. (optional)
                    </label>
                    <input
                      type="text"
                      name="line2"
                      value={shippingAddress.line2}
                      onChange={handleChange}
                      placeholder="Apt 4B"
                      autoComplete="address-line2"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 14,
                        border: '1.5px solid #e5e7eb',
                        borderRadius: '10px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#2d7a3a'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      City *
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={shippingAddress.city}
                      onChange={handleChange}
                      placeholder="New York"
                      autoComplete="address-level2"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 14,
                        border: `1.5px solid ${errors.city ? '#dc2626' : '#e5e7eb'}`,
                        borderRadius: '10px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => !errors.city && (e.target.style.borderColor = '#2d7a3a')}
                      onBlur={(e) => !errors.city && (e.target.style.borderColor = '#e5e7eb')}
                    />
                    {errors.city && (
                      <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.city}</p>
                    )}
                  </div>

                  <div className="responsive-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        State *
                      </label>
                      <select
                        name="state"
                        value={shippingAddress.state}
                        onChange={handleChange}
                        autoComplete="address-level1"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          fontSize: 14,
                          border: `1.5px solid ${errors.state ? '#dc2626' : '#e5e7eb'}`,
                          borderRadius: '10px',
                          outline: 'none',
                          background: 'white',
                          cursor: 'pointer',
                          transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => !errors.state && (e.target.style.borderColor = '#2d7a3a')}
                        onBlur={(e) => !errors.state && (e.target.style.borderColor = '#e5e7eb')}
                      >
                        <option value="">Select state...</option>
                        {US_STATES.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                      {errors.state && (
                        <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.state}</p>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        ZIP Code *
                      </label>
                      <input
                        type="text"
                        name="zip"
                        value={shippingAddress.zip}
                        onChange={handleChange}
                        placeholder="10001 or 10001-1234"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        maxLength={10}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          fontSize: 14,
                          border: `1.5px solid ${errors.zip ? '#dc2626' : '#e5e7eb'}`,
                          borderRadius: '10px',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => !errors.zip && (e.target.style.borderColor = '#2d7a3a')}
                        onBlur={(e) => !errors.zip && (e.target.style.borderColor = '#e5e7eb')}
                      />
                      {errors.zip && (
                        <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errors.zip}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Country
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={shippingAddress.country}
                      readOnly
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 14,
                        border: '1.5px solid #e5e7eb',
                        borderRadius: '10px',
                        outline: 'none',
                        backgroundColor: '#f9fafb',
                        color: '#6b7280',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>

                  {isAddressReady(shippingAddress) && (
                    <div style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid #e8eee8' }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
                        Shipping options
                      </h4>
                      {dispatchMessage && (
                        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>
                          {dispatchMessage}
                        </p>
                      )}
                      {ratesLoading ? (
                        <p style={{ fontSize: 13, color: '#6b7280' }}>Loading carrier rates…</p>
                      ) : shippingRateError ? (
                        <div
                          role="alert"
                          style={{
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#7f1d1d',
                            borderRadius: 10,
                            padding: 14,
                            fontSize: 13,
                            lineHeight: 1.5,
                          }}
                        >
                          <strong style={{ display: 'block', marginBottom: 4 }}>
                            {shippingRateError.message || 'Could not load shipping rates'}
                          </strong>
                          {shippingRateError.resolution && (
                            <p style={{ margin: '0 0 8px' }}>{shippingRateError.resolution}</p>
                          )}
                          {shippingRateError.suggestions?.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {shippingRateError.suggestions.map((suggestion) => (
                                <li key={suggestion}>{suggestion}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : shippingRates.length === 0 ? (
                        <p style={{ fontSize: 13, color: '#6b7280' }}>No shipping options available.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {shippingRates.map((rate) => (
                            <label
                              key={rate.objectId}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '12px 14px',
                                borderRadius: 10,
                                border: `1.5px solid ${
                                  selectedRate?.objectId === rate.objectId ? '#2d7a3a' : '#e5e7eb'
                                }`,
                                background: selectedRate?.objectId === rate.objectId ? '#f0f9f4' : 'white',
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="radio"
                                name="shippingRate"
                                checked={selectedRate?.objectId === rate.objectId}
                                onChange={() => {
                                  setSelectedRate(rate)
                                  if (errors.shipping) setErrors({ ...errors, shipping: '' })
                                }}
                                style={{ accentColor: '#2d7a3a' }}
                              />
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                                {rate.label}
                                {rate.estimatedDays != null && (
                                  <span style={{ fontWeight: 400, color: '#9ca3af' }}>
                                    {' '}
                                    · est. {rate.estimatedDays} day{rate.estimatedDays === 1 ? '' : 's'}
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: 14, fontWeight: 700, color: rate.amount === 0 ? '#2d7a3a' : '#1c2b1c' }}>
                                {rate.amount === 0 ? 'Free' : formatPrice(rate.amount)}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                      {errors.shipping && (
                        <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{errors.shipping}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  fontSize: 16,
                  padding: '14px 24px',
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? (
                  'Processing...'
                ) : (
                  <>
                    <CreditCard size={18} />
                    Continue to Payment
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right: Order Summary */}
          <div>
            <div className="card" style={{ position: 'sticky', top: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 16 }}>Order Summary</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e8eee8' }}>
                {items.map((item) => (
                  <div key={item._id} style={{ display: 'flex', gap: 12 }}>
                    <ProductImage
                      images={item.images}
                      alt={item.name}
                      variant="checkout"
                      width={60}
                      height={60}
                      style={{ borderRadius: 10, objectFit: 'cover', border: '1px solid #e8eee8' }}
                      className="checkout-item-img"
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{item.name}</p>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 3,
                          background: '#f9fafb',
                        }}
                        aria-label={`Quantity for ${item.name}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            updateQty(item._id, item.quantity - 1)
                            setSelectedRate(null)
                          }}
                          disabled={loading || item.quantity <= 1}
                          aria-label={`Decrease ${item.name} quantity`}
                          style={{
                            width: 22,
                            height: 22,
                            border: 'none',
                            borderRadius: 6,
                            background: 'white',
                            color: '#374151',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: loading || item.quantity <= 1 ? 'not-allowed' : 'pointer',
                            opacity: loading || item.quantity <= 1 ? 0.45 : 1,
                          }}
                        >
                          <Minus size={12} />
                        </button>
                        <span style={{ minWidth: 18, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#374151' }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            updateQty(item._id, item.quantity + 1)
                            setSelectedRate(null)
                          }}
                          disabled={loading}
                          aria-label={`Increase ${item.name} quantity`}
                          style={{
                            width: 22,
                            height: 22,
                            border: 'none',
                            borderRadius: 6,
                            background: 'white',
                            color: '#374151',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.45 : 1,
                          }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1c2b1c' }}>{formatPrice(item.price * item.quantity)}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(item._id)}
                        disabled={loading}
                        aria-label={`Remove ${item.name} from cart`}
                        title="Remove from cart"
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          border: '1px solid #fee2e2',
                          background: '#fff5f5',
                          color: '#dc2626',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          opacity: loading ? 0.5 : 1,
                          flexShrink: 0,
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e8eee8' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  <Tag size={14} /> Promo code
                </label>
                <input
                  type="text"
                  value={promotionCode}
                  onChange={(e) => setPromotionCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME15"
                  autoComplete="off"
                  disabled={loading}
                  style={{
                    width: '100%',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    color: '#1f2937',
                    background: '#f9fafb',
                  }}
                />
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 1.45 }}>
                  Optional. Leave blank to enter a code on the secure payment page instead.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e8eee8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>Subtotal</span>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{formatPrice(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>{shippingLabel}</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: isPickup || (hasSelectedShippingRate && shipping === 0) ? '#2d7a3a' : '#374151',
                    }}
                  >
                    {shippingSummary}
                  </span>
                </div>
                {isPickup && (
                  <div style={{ fontSize: 11, color: '#2d7a3a', lineHeight: 1.5, marginTop: -4 }}>
                    Pickup at {formatPickupAddress()}.
                  </div>
                )}
                {!isPickup && dispatchMessage && (
                  <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, marginTop: -4 }}>
                    {dispatchMessage}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>Sales Tax ({formatSalesTaxRate()})</span>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{formatPrice(tax)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginBottom: 16 }}>
                <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{totalLabel}</span>
                <span style={{ fontWeight: 700, color: '#2d7a3a', fontSize: 20 }}>{formatPrice(total)}</span>
              </div>

              <div style={{ background: '#f0f9f4', borderRadius: 10, padding: 12, fontSize: 12, color: '#2d7a3a', lineHeight: 1.6 }}>
                <strong>Secure Checkout</strong><br />
                Your payment information is encrypted and secure.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
