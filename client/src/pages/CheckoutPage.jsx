import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, CreditCard } from 'lucide-react'
import useCartStore from '../store/useCartStore'
import useAuthStore from '../store/useAuthStore'
import { formatPrice, calcShipping } from '../lib/utils'
import { US_STATES, isValidUSZip, isValidStreetAddress, isValidCity } from '../lib/usStates'
import api from '../lib/api'
import toast from 'react-hot-toast'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items } = useCartStore()
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

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const shipping = calcShipping(subtotal)
  const tax = 0 // Calculate tax if needed
  const total = subtotal + shipping + tax

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
    
    // Street address
    if (!shippingAddress.line1.trim()) {
      newErrors.line1 = 'Street address is required'
    } else if (!isValidStreetAddress(shippingAddress.line1)) {
      newErrors.line1 = 'Please enter a valid street address (e.g., 123 Main St)'
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
        shippingAddress
      })
      
      console.log('✅ Stripe session created:', data.url)
      
      // Redirect to Stripe
      window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
      toast.error(err.response?.data?.message || 'Checkout failed')
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
                      placeholder="123 Main Street"
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
                </div>
              </div>

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
                    <img
                      src={item.images?.[0]?.url || 'https://placehold.co/60x60?text=?'}
                      alt={item.name}
                      style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', border: '1px solid #e8eee8' }}
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{item.name}</p>
                      <p style={{ fontSize: 12, color: '#9ca3af' }}>Qty: {item.quantity}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1c2b1c' }}>{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e8eee8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>Subtotal</span>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{formatPrice(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>Shipping</span>
                  <span style={{ fontWeight: 600, color: shipping === 0 ? '#2d7a3a' : '#374151' }}>
                    {shipping === 0 ? 'Free' : formatPrice(shipping)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>Tax</span>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{formatPrice(tax)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginBottom: 16 }}>
                <span style={{ fontWeight: 700, color: '#1a1a1a' }}>Total</span>
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
