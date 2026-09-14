import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, MapPin, Package, Truck } from 'lucide-react'
import useCartStore from '../store/useCartStore'
import api from '../lib/api'
import { formatPrice, formatDate } from '../lib/utils'
import ProductImage from '../components/ProductImage'
import CheckoutProgress from '../components/checkout/CheckoutProgress'

function orderNumber(id) {
  return String(id || '').slice(-8).toUpperCase()
}

function formatAddress(addr) {
  if (!addr) return null
  const line = [addr.line1, addr.line2].filter(Boolean).join(', ')
  const cityLine = [addr.city, addr.state, addr.zip].filter(Boolean).join(', ')
  return [line, cityLine, addr.country].filter(Boolean)
}

export default function OrderSuccessPage() {
  const [searchParams] = useSearchParams()
  const clearCart = useCartStore((s) => s.clearCart)
  const [cleared, setCleared] = useState(false)
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState(null)
  const [status, setStatus] = useState({ isPaid: false, confirmationEmailSent: false })

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    let cancelled = false

    async function run() {
      if (!sessionId) {
        if (!cleared) {
          clearCart()
          setCleared(true)
        }
        setLoading(false)
        return
      }

      if (!cleared) {
        clearCart()
        setCleared(true)
      }

      let latest = null
      for (let attempt = 1; attempt <= 8; attempt += 1) {
        try {
          const { data } = await api.get(`/checkout/session/${sessionId}`, { skipAuthRedirect: true })
          latest = data
          if (data?.order) {
            if (!cancelled) {
              setOrder(data.order)
              setStatus({
                isPaid: Boolean(data.isPaid),
                confirmationEmailSent: Boolean(data.confirmationEmailSent),
              })
            }
            if (data.isPaid) break
          }
        } catch (err) {
          console.warn(`Order verification attempt ${attempt} failed:`, err.response?.data?.message || err.message)
        }
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }

      // Fallback: authenticated order fetch if session payload lacked items
      if (!cancelled && latest?.orderId && !latest?.order?.items?.length) {
        try {
          const { data } = await api.get(`/orders/${latest.orderId}`)
          setOrder(data)
          setStatus({
            isPaid: Boolean(data.isPaid),
            confirmationEmailSent: Boolean(latest.confirmationEmailSent),
          })
        } catch {
          /* session summary is enough */
        }
      }

      if (!cancelled) setLoading(false)
    }

    run()
    return () => { cancelled = true }
  }, [clearCart, cleared, searchParams])

  const addressLines = order?.fulfillmentMethod === 'pickup'
    ? [
        order.pickup?.address?.name || 'Pharmacy Pickup',
        order.pickup?.display || formatAddress(order.pickup?.address)?.join(' · '),
      ].filter(Boolean)
    : formatAddress(order?.shippingAddress)

  return (
    <div className="order-success-page">
      <CheckoutProgress current="confirmed" />

      <div className="order-success-hero">
        <div className="order-success-check">
          <CheckCircle size={36} strokeWidth={2.4} />
        </div>
        <h1 className="checkout-page-title">Thank you — order confirmed</h1>
        <p className="checkout-page-sub">
          {status.confirmationEmailSent
            ? 'A confirmation email is on the way.'
            : 'We’re finalizing your confirmation email — it should arrive shortly.'}
          {order?._id && (
            <>
              {' '}Your order number is <strong style={{ color: 'var(--brand-primary-light)' }}>#{orderNumber(order._id)}</strong>.
            </>
          )}
        </p>
      </div>

      {loading && (
        <div className="checkout-card" style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '12px auto' }} />
          <p className="checkout-hint">Loading your order details…</p>
        </div>
      )}

      {!loading && order && (
        <div className="order-success-grid">
          <div className="checkout-card">
            <div className="checkout-card-title-row">
              <div className="checkout-card-icon"><Package size={20} /></div>
              <div>
                <h2>Order summary</h2>
                <p className="checkout-card-sub">
                  Placed {order.createdAt ? formatDate(order.createdAt) : 'just now'}
                  {status.isPaid ? ' · Paid' : ''}
                </p>
              </div>
            </div>

            <ul className="order-status-track" aria-label="Order progress">
              {['Confirmed', 'Processing', 'Shipped', 'Delivered'].map((label, index) => {
                const current = order.fulfillmentMethod === 'pickup'
                  ? (order.status === 'delivered' || order.status === 'shipped' ? 3 : 1)
                  : ({ processing: 1, shipped: 2, delivered: 3 }[order.status] ?? 0)
                const state = index < current ? 'is-done' : index === current ? 'is-current' : ''
                return (
                  <li key={label} className={state}>{label}</li>
                )
              })}
            </ul>

            <div style={{ marginTop: 20 }}>
              {(order.items || []).map((item, idx) => (
                <div key={`${item.product || item.name}-${idx}`} className="order-line">
                  <ProductImage
                    images={item.image ? [{ url: item.image }] : item.images}
                    alt={item.name}
                    variant="checkout"
                    width={56}
                    height={56}
                    style={{ borderRadius: 10, objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1 }}>
                    <p className="checkout-summary-name">{item.name}</p>
                    <p className="checkout-hint">Qty {item.quantity}</p>
                  </div>
                  <p className="checkout-summary-price">{formatPrice((item.price || 0) * (item.quantity || 1))}</p>
                </div>
              ))}
            </div>

            <div className="checkout-totals" style={{ marginTop: 16, borderBottom: 'none', paddingBottom: 0 }}>
              <div className="checkout-totals-line">
                <span>Subtotal</span>
                <strong>{formatPrice(order.subtotal || 0)}</strong>
              </div>
              {Number(order.discount || 0) > 0 && (
                <div className="checkout-totals-line">
                  <span>Discount{order.discountCode ? ` (${order.discountCode})` : ''}</span>
                  <strong style={{ color: 'var(--brand-primary-light)' }}>-{formatPrice(order.discount)}</strong>
                </div>
              )}
              <div className="checkout-totals-line">
                <span>{order.fulfillmentMethod === 'pickup' ? 'Pickup' : 'Shipping'}</span>
                <strong>
                  {order.fulfillmentMethod === 'pickup' || !order.shipping
                    ? 'Free'
                    : formatPrice(order.shipping)}
                </strong>
              </div>
              <div className="checkout-totals-line">
                <span>Sales Tax</span>
                <strong>{formatPrice(order.tax || 0)}</strong>
              </div>
              <div className="checkout-total" style={{ marginTop: 8, marginBottom: 0 }}>
                <span>Amount paid</span>
                <span>{formatPrice(order.amountPaid || order.total || 0)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="checkout-card">
              <div className="checkout-card-title-row">
                <div className="checkout-card-icon">
                  {order.fulfillmentMethod === 'pickup' ? <Package size={20} /> : <Truck size={20} />}
                </div>
                <div>
                  <h2>{order.fulfillmentMethod === 'pickup' ? 'Pickup' : 'Shipping'}</h2>
                  <p className="checkout-card-sub">
                    {order.shippingMethod?.label || (order.fulfillmentMethod === 'pickup' ? 'In-store pickup' : 'Standard')}
                  </p>
                </div>
              </div>
              {addressLines?.length > 0 && (
                <div className="checkout-notice checkout-notice--pickup" style={{ marginBottom: 0 }}>
                  <MapPin size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    {addressLines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="order-success-actions">
              {order._id && (
                <Link to={`/orders/${order._id}`} className="btn-primary">
                  View order details
                </Link>
              )}
              <Link to="/orders" className="btn-outline">
                My orders
              </Link>
              <Link to="/shop" className="btn-outline">
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      )}

      {!loading && !order && (
        <div className="checkout-card" style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
          <p className="checkout-page-sub" style={{ marginBottom: 20 }}>
            Payment received. Your order is being prepared — check My Orders in a moment if details don’t appear yet.
          </p>
          <div className="order-success-actions" style={{ justifyContent: 'center' }}>
            <Link to="/orders" className="btn-primary">View My Orders</Link>
            <Link to="/shop" className="btn-outline">Continue Shopping</Link>
          </div>
        </div>
      )}
    </div>
  )
}
