import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Package, MapPin, CreditCard, Truck, CheckCircle, Clock } from 'lucide-react'
import api from '../lib/api'
import { formatPrice, formatDate } from '../lib/utils'
import ProductImage from '../components/ProductImage'
import { getTrackingInfo } from '../lib/tracking'

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

export default function OrderDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => setOrder(data))
      .catch((err) => {
        console.error('Failed to load order:', err)
        navigate('/orders')
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  if (!order) return null

  const StatusIcon = STATUS_ICONS[order.status]
  const isPickup = order.fulfillmentMethod === 'pickup'

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh', padding: '40px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link
            to="/orders"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: '#2d7a3a',
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
              marginBottom: 16
            }}
          >
            <ArrowLeft size={16} /> Back to Orders
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
                Order #{order._id.slice(-8).toUpperCase()}
              </h1>
              <p style={{ color: '#6b7280', fontSize: 14 }}>
                Placed on {formatDate(order.createdAt)}
              </p>
            </div>
            <span className={`admin-badge ${STATUS_COLOR[order.status] || 'gray'}`} style={{ fontSize: 14, padding: '8px 16px' }}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
        </div>

        {/* Order Timeline */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 20 }}>Order Status</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
            {/* Timeline Line */}
            <div style={{
              position: 'absolute',
              top: 20,
              left: 20,
              right: 20,
              height: 2,
              background: '#e5e7eb',
              zIndex: 0
            }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, #2d7a3a 0%, #a7e9c5 100%)',
                width: order.status === 'pending' ? '0%' : order.status === 'processing' ? '33%' : order.status === 'shipped' ? '66%' : '100%',
                transition: 'width 0.5s'
              }} />
            </div>

            {/* Steps */}
            {['pending', 'processing', 'shipped', 'delivered'].map((status, idx) => {
              const Icon = STATUS_ICONS[status]
              const isActive = ['pending', 'processing', 'shipped', 'delivered'].indexOf(order.status) >= idx
              const isCurrent = order.status === status

              return (
                <div key={status} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: isActive ? 'linear-gradient(135deg, #2d7a3a 0%, #3a9447 100%)' : '#f3f4f6',
                    border: isCurrent ? '3px solid #a7e9c5' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                    transition: 'all 0.3s'
                  }}>
                    {Icon && <Icon size={18} style={{ color: isActive ? 'white' : '#9ca3af' }} />}
                  </div>
                  <p style={{
                    fontSize: 11,
                    fontWeight: isCurrent ? 700 : 600,
                    color: isActive ? '#2d7a3a' : '#9ca3af',
                    textAlign: 'center'
                  }}>
                    {STATUS_LABELS[status]}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Tracking Number */}
          {order.trackingNumber && (() => {
            const tracking = getTrackingInfo(order.trackingNumber)
            return (
              <div style={{
                marginTop: 24,
                padding: 16,
                background: '#f0f9f4',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap'
              }}>
                <Truck size={20} style={{ color: '#2d7a3a', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                    UPS Tracking Number
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#2d7a3a', fontFamily: 'monospace' }}>
                    {order.trackingNumber}
                  </p>
                </div>
                <a
                  href={tracking.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ fontSize: 13, padding: '8px 16px' }}
                >
                  Track on UPS
                </a>
              </div>
            )
          })()}
        </div>

        <div className="responsive-side-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24 }}>
          {/* Left Column */}
          <div>
            {/* Order Items */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 16 }}>Order Items</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {order.items.map((item) => (
                  <div key={item._id} style={{
                    display: 'flex',
                    gap: 16,
                    padding: 16,
                    background: '#f9fafb',
                    borderRadius: 10,
                    border: '1px solid #e8eee8'
                  }}>
                    <ProductImage
                      src={item.image}
                      alt={item.name}
                      variant="order"
                      width={80}
                      height={80}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 10,
                        objectFit: 'cover',
                        border: '1px solid #e8eee8',
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        {item.name}
                      </h3>
                      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
                        Quantity: {item.quantity}
                      </p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#2d7a3a' }}>
                        {formatPrice(item.price)} each
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: '#1c2b1c' }}>
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fulfillment Details */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  background: 'linear-gradient(135deg, #d1f4e0 0%, #a7e9c5 100%)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MapPin size={18} style={{ color: '#2d7a3a' }} />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>
                  {isPickup ? 'Pickup Details' : 'Shipping Address'}
                </h2>
              </div>
              
              {isPickup ? (
                <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                  {order.pickup?.display && <p><strong>Pickup time:</strong> {order.pickup.display}</p>}
                  <p>{order.pickup?.address?.name || 'Evolve Specialty Pharmacy & Wellness'}</p>
                  <p>{order.pickup?.address?.line1}</p>
                  <p>
                    {order.pickup?.address?.city}
                    {order.pickup?.address?.state && `, ${order.pickup.address.state}`}
                    {order.pickup?.address?.zip && ` ${order.pickup.address.zip}`}
                  </p>
                  <p style={{ color: '#6b7280', marginTop: 8 }}>Open Monday - Friday, 9:00 AM - 5:00 PM</p>
                </div>
              ) : order.shippingAddress && (order.shippingAddress.line1 || order.shippingAddress.city) ? (
                <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                  {order.shippingAddress.line1 && <p>{order.shippingAddress.line1}</p>}
                  {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                  {order.shippingAddress.city && (
                    <p>
                      {order.shippingAddress.city}
                      {order.shippingAddress.state && `, ${order.shippingAddress.state}`}
                      {order.shippingAddress.zip && ` ${order.shippingAddress.zip}`}
                    </p>
                  )}
                  {order.shippingAddress.country && <p>{order.shippingAddress.country}</p>}
                </div>
              ) : (
                <p style={{ fontSize: 14, color: '#9ca3af', fontStyle: 'italic' }}>
                  No shipping address provided
                </p>
              )}
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div>
            <div className="card" style={{ position: 'sticky', top: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 16 }}>Order Summary</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e8eee8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Subtotal</span>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{formatPrice(order.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>{isPickup ? 'Pickup' : 'Shipping'}</span>
                  <span style={{ fontWeight: 600, color: '#2d7a3a' }}>
                    {order.shipping > 0 ? formatPrice(order.shipping) : 'Free'}
                  </span>
                </div>
                {order.tax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: '#6b7280' }}>Tax</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{formatPrice(order.tax)}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, marginBottom: 20 }}>
                <span style={{ fontWeight: 700, color: '#1a1a1a' }}>Total</span>
                <span style={{ fontWeight: 700, color: '#2d7a3a' }}>{formatPrice(order.total)}</span>
              </div>

              {/* Payment Status */}
              <div style={{
                padding: 12,
                background: order.isPaid ? '#f0f9f4' : '#fef3c7',
                borderRadius: 10,
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <CreditCard size={16} style={{ color: order.isPaid ? '#2d7a3a' : '#d97706' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: order.isPaid ? '#2d7a3a' : '#d97706' }}>
                    {order.isPaid ? 'Payment Confirmed' : 'Payment Pending'}
                  </span>
                </div>
                {order.isPaid && order.paidAt && (
                  <p style={{ fontSize: 12, color: '#6b7280', marginLeft: 24 }}>
                    Paid on {formatDate(order.paidAt)}
                  </p>
                )}
              </div>

              {/* Order Info */}
              <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
                <p><strong>Order ID:</strong> {order._id}</p>
                <p><strong>Payment Method:</strong> {order.paymentMethod || 'Stripe'}</p>
                {order.notes && <p><strong>Notes:</strong> {order.notes}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
