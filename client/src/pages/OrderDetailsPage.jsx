import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Package, MapPin, CreditCard, Truck, CheckCircle, Clock, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { formatPrice, formatDate } from '../lib/utils'
import ProductImage from '../components/ProductImage'
import { getTrackingInfo } from '../lib/tracking'
import { US_STATES } from '../lib/usStates'

const STATUS_COLOR = {
  pending: 'yellow',
  processing: 'blue',
  shipped: 'indigo',
  delivered: 'green',
  cancelled: 'red',
}

const STATUS_LABELS = {
  pending: 'Awaiting Payment',
  processing: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_ICONS = {
  pending: Clock,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: null,
}

function formatTaxRate(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return '8.25'
  return String((Number(rate) * 100).toFixed(2)).replace(/\.00$/, '')
}

export default function OrderDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingAddress, setEditingAddress] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressForm, setAddressForm] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
  })

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => {
        setOrder(data)
        setAddressForm({
          line1: data.shippingAddress?.line1 || '',
          line2: data.shippingAddress?.line2 || '',
          city: data.shippingAddress?.city || '',
          state: data.shippingAddress?.state || '',
          zip: data.shippingAddress?.zip || '',
          country: data.shippingAddress?.country || 'United States',
        })
      })
      .catch((err) => {
        console.error('Failed to load order:', err)
        navigate('/orders')
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const saveAddress = async (e) => {
    e.preventDefault()
    setSavingAddress(true)
    try {
      const { data } = await api.put(`/orders/${id}/shipping-address`, {
        shippingAddress: addressForm,
      })
      setOrder(data)
      setEditingAddress(false)
      toast.success('Shipping address updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update address')
      if (err.response?.data?.addressEdit) {
        setOrder((prev) => ({ ...prev, addressEdit: err.response.data.addressEdit }))
      }
    } finally {
      setSavingAddress(false)
    }
  }

  if (loading) {
    return (
      <div className="spinner-wrap" style={{ minHeight: '60vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  if (!order) return null

  const StatusIcon = STATUS_ICONS[order.status]
  const isPickup = order.fulfillmentMethod === 'pickup'
  const discount = Number(order.discount || 0)
  const tax = Number(order.tax || 0)
  const amountPaid = Number(order.amountPaid || order.total || 0)
  const addressEdit = order.addressEdit || {}
  const tracking = order.trackingNumber ? getTrackingInfo(order.trackingNumber) : null
  const taxRateLabel = formatTaxRate(order.salesTaxRate)

  return (
    <div className="orders-page-shell">
      <div style={{ marginBottom: 28 }}>
        <Link to="/orders" className="checkout-back" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to Orders
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
          <div>
            <h1 className="checkout-page-title">Order #{order._id.slice(-8).toUpperCase()}</h1>
            <p className="checkout-page-sub">Placed on {formatDate(order.createdAt)}</p>
          </div>
          <span className={`admin-badge ${STATUS_COLOR[order.status] || 'gray'}`}>
            {STATUS_LABELS[order.status] || order.status}
          </span>
        </div>
      </div>

      <div className="checkout-layout">
        <div>
          <div className="checkout-card">
            <h2 style={{ marginBottom: 16 }}>Items</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {order.items.map((item) => (
                <div key={item._id || item.name} className="order-line">
                  <ProductImage
                    src={item.image}
                    alt={item.name}
                    variant="order"
                    width={72}
                    height={72}
                    style={{ borderRadius: 10, objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1 }}>
                    <p className="checkout-summary-name">{item.name}</p>
                    <p className="checkout-hint">
                      Qty {item.quantity} · {formatPrice(item.price)} each
                      {item.isTaxable ? ' · Taxable' : ''}
                    </p>
                  </div>
                  <p className="checkout-summary-price">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="checkout-card">
            <div className="checkout-card-title-row" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="checkout-card-icon"><MapPin size={18} /></div>
                <div>
                  <h2>{isPickup ? 'Pickup Details' : 'Shipping Address'}</h2>
                  {!isPickup && addressEdit.editableUntil && (
                    <p className="checkout-card-sub">
                      {addressEdit.canEdit
                        ? `Editable until ${new Date(addressEdit.editableUntil).toLocaleString()}`
                        : 'Edit window closed'}
                    </p>
                  )}
                </div>
              </div>
              {!isPickup && addressEdit.canEdit && !editingAddress && (
                <button type="button" className="btn-outline" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => setEditingAddress(true)}>
                  <Pencil size={14} /> Modify address
                </button>
              )}
            </div>

            {isPickup ? (
              <div className="checkout-hint" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.6 }}>
                {order.pickup?.display && <p><strong>Pickup time:</strong> {order.pickup.display}</p>}
                <p>{order.pickup?.address?.name || 'Evolve Specialty Pharmacy & Wellness'}</p>
                <p>{order.pickup?.address?.line1}</p>
                <p>
                  {[order.pickup?.address?.city, order.pickup?.address?.state, order.pickup?.address?.zip]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            ) : editingAddress ? (
              <form onSubmit={saveAddress} className="checkout-fields">
                <div className="checkout-field">
                  <label className="checkout-label">Street *</label>
                  <input className="checkout-input" value={addressForm.line1} onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })} required />
                </div>
                <div className="checkout-field">
                  <label className="checkout-label">Apt / suite</label>
                  <input className="checkout-input" value={addressForm.line2} onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })} />
                </div>
                <div className="checkout-field">
                  <label className="checkout-label">City *</label>
                  <input className="checkout-input" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} required />
                </div>
                <div className="checkout-row-2">
                  <div className="checkout-field">
                    <label className="checkout-label">State *</label>
                    <select className="checkout-select" value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} required>
                      <option value="">Select…</option>
                      {US_STATES.map((s) => (
                        <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="checkout-field">
                    <label className="checkout-label">ZIP *</label>
                    <input className="checkout-input" value={addressForm.zip} onChange={(e) => setAddressForm({ ...addressForm, zip: e.target.value })} required />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="submit" className="btn-primary" disabled={savingAddress}>
                    {savingAddress ? 'Saving…' : 'Save address'}
                  </button>
                  <button type="button" className="btn-outline" onClick={() => setEditingAddress(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                  {order.shippingAddress?.line1 && <p>{order.shippingAddress.line1}</p>}
                  {order.shippingAddress?.line2 && <p>{order.shippingAddress.line2}</p>}
                  <p>
                    {[order.shippingAddress?.city, order.shippingAddress?.state, order.shippingAddress?.zip]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {order.shippingAddress?.country && <p>{order.shippingAddress.country}</p>}
                </div>
                {!addressEdit.canEdit && (
                  <p className="checkout-hint" style={{ marginTop: 12 }}>
                    {addressEdit.message || `To change this address, email ${addressEdit.supportEmail || 'info@evolvepharmacy.com'}.`}
                    {' '}
                    <a href={`mailto:${addressEdit.supportEmail || 'info@evolvepharmacy.com'}`} style={{ color: 'var(--brand-primary-light)' }}>
                      {addressEdit.supportEmail || 'info@evolvepharmacy.com'}
                    </a>
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <aside>
          <div className="checkout-card checkout-summary">
            <h3 style={{ marginBottom: 16 }}>Order summary</h3>

            <div className="checkout-totals">
              <div className="checkout-totals-line">
                <span>Subtotal</span>
                <strong>{formatPrice(order.subtotal)}</strong>
              </div>
              {discount > 0 && (
                <div className="checkout-totals-line">
                  <span>Discount{order.discountCode ? ` (${order.discountCode})` : ''}</span>
                  <strong style={{ color: 'var(--brand-primary-light)' }}>-{formatPrice(discount)}</strong>
                </div>
              )}
              <div className="checkout-totals-line">
                <span>{isPickup ? 'Pickup' : (order.shippingMethod?.label || 'Shipping')}</span>
                <strong>{order.shipping > 0 ? formatPrice(order.shipping) : 'Free'}</strong>
              </div>
              <div className="checkout-totals-line">
                <span>Sales Tax ({taxRateLabel}%)</span>
                <strong>{formatPrice(tax)}</strong>
              </div>
            </div>

            <div className="checkout-total">
              <span>Amount paid</span>
              <span>{formatPrice(amountPaid)}</span>
            </div>

            <div className="checkout-secure" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <CreditCard size={16} />
                <strong>{order.isPaid ? 'Payment confirmed' : 'Payment pending'}</strong>
              </div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                {order.paymentMethodLabel || order.paymentMethod || 'Card'}
                {order.paidAt ? ` · ${formatDate(order.paidAt)}` : ''}
              </div>
            </div>

            {tracking && (
              <a href={tracking.url} target="_blank" rel="noopener noreferrer" className="btn-outline" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>
                <Truck size={14} /> Track package
              </a>
            )}

            {StatusIcon && (
              <p className="checkout-hint">
                Status: {STATUS_LABELS[order.status]}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
