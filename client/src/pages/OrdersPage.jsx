import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Package, ChevronRight, Truck, CheckCircle, Clock, ShoppingBag, Search } from 'lucide-react'
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

const STATUS_STEPS = ['Confirmed', 'Processing', 'Shipped', 'Delivered']

function statusStepIndex(status, isPickup) {
  if (status === 'cancelled') return -1
  if (status === 'pending') return 0
  if (status === 'processing') return 1
  if (status === 'shipped') return isPickup ? 3 : 2
  if (status === 'delivered') return 3
  return 0
}

const FILTERS = [
  { key: 'all', label: 'All Orders' },
  { key: 'processing', label: 'Active' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/orders/my')
      .then(({ data }) => setOrders(data))
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => ({
    total: orders.length,
    active: orders.filter((o) => ['pending', 'processing'].includes(o.status)).length,
    shipped: orders.filter((o) => o.status === 'shipped').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
  }), [orders])

  const filteredOrders = useMemo(() => {
    let result = orders
    if (filter !== 'all') {
      if (filter === 'processing') {
        result = result.filter((o) => ['pending', 'processing'].includes(o.status))
      } else {
        result = result.filter((o) => o.status === filter)
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((o) =>
        o._id.toLowerCase().includes(q) ||
        o.items.some((i) => i.name.toLowerCase().includes(q)),
      )
    }
    return result
  }, [orders, filter, search])

  const filterCounts = useMemo(() => ({
    all: orders.length,
    processing: orders.filter((o) => ['pending', 'processing'].includes(o.status)).length,
    shipped: orders.filter((o) => o.status === 'shipped').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  }), [orders])

  if (loading) {
    return (
      <div className="spinner-wrap" style={{ minHeight: '60vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="orders-page-shell">
        <h1 className="checkout-page-title">My Orders</h1>
        <div className="checkout-card" style={{ textAlign: 'center', padding: '64px 40px', marginTop: 24 }}>
          <div className="order-success-check" style={{ marginBottom: 20 }}>
            <Package size={36} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>No orders yet</h2>
          <p className="checkout-page-sub" style={{ marginBottom: 24, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            When you place your first order, it will appear here with tracking and a clear status bar.
          </p>
          <Link to="/shop" className="btn-primary" style={{ display: 'inline-flex' }}>
            <ShoppingBag size={16} /> Browse Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="orders-page-shell">
      <div style={{ marginBottom: 28 }}>
        <h1 className="checkout-page-title">My Orders</h1>
        <p className="checkout-page-sub">Track status, open details, and manage everything in one place.</p>
      </div>

      <div className="orders-stats-grid">
        <StatCard icon={Package} label="Total Orders" value={stats.total} />
        <StatCard icon={Clock} label="Active" value={stats.active} />
        <StatCard icon={Truck} label="In Transit" value={stats.shipped} />
        <StatCard icon={CheckCircle} label="Delivered" value={stats.delivered} />
      </div>

      <div className="orders-toolbar">
        <div className="orders-filters">
          {FILTERS.map((f) => {
            const count = filterCounts[f.key] || 0
            const isActive = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                className={`orders-filter-btn${isActive ? ' is-active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                {count > 0 && <span className="orders-filter-count">{count}</span>}
              </button>
            )
          })}
        </div>

        <div className="orders-search-wrap">
          <Search size={15} className="orders-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="checkout-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders…"
          />
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="checkout-card" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
          <Search size={40} style={{ margin: '0 auto 16px', opacity: 0.4 }} strokeWidth={1.5} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>No matching orders</p>
          <p style={{ fontSize: 13 }}>Try adjusting your filter or search term</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredOrders.map((order) => (
            <OrderCard key={order._id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="checkout-card orders-stat-card">
      <div className="checkout-card-icon">
        <Icon size={20} />
      </div>
      <div>
        <p className="orders-stat-label">{label}</p>
        <p className="orders-stat-value">{value}</p>
      </div>
    </div>
  )
}

function OrderCard({ order }) {
  const tracking = order.trackingNumber ? getTrackingInfo(order.trackingNumber) : null
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)
  const visibleItems = order.items.slice(0, 4)
  const extraCount = order.items.length - visibleItems.length
  const step = statusStepIndex(order.status, order.fulfillmentMethod === 'pickup')

  return (
    <Link to={`/orders/${order._id}`} className="orders-card-link">
      <article className="checkout-card orders-order-card">
        <div className="orders-card-top">
          <div>
            <p className="orders-card-id">Order #{order._id.slice(-8).toUpperCase()}</p>
            <p className="orders-card-date">{formatDate(order.createdAt)}</p>
          </div>
          <div className="orders-card-meta">
            <span className={`admin-badge ${STATUS_COLOR[order.status] || 'gray'}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
            <span className="orders-card-total">{formatPrice(order.total)}</span>
          </div>
        </div>

        {order.status !== 'cancelled' && (
          <ul className="order-status-track" aria-label="Order status">
            {STATUS_STEPS.map((label, index) => {
              const state = index < step ? 'is-done' : index === step ? 'is-current' : ''
              return <li key={label} className={state}>{label}</li>
            })}
          </ul>
        )}

        <div className="orders-card-bottom">
          <div className="orders-card-items">
            <div className="orders-thumb-stack">
              {visibleItems.map((item, idx) => (
                <ProductImage
                  key={item._id || idx}
                  src={item.image}
                  alt={item.name}
                  variant="orderRow"
                  width={44}
                  height={44}
                  className="orders-thumb"
                  style={{ marginLeft: idx === 0 ? 0 : -10, zIndex: visibleItems.length - idx }}
                />
              ))}
              {extraCount > 0 && (
                <div className="orders-thumb-more" style={{ marginLeft: -10 }}>+{extraCount}</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="orders-card-title">
                {order.items[0]?.name}
                {order.items.length > 1 && (
                  <span> and {order.items.length - 1} more</span>
                )}
              </p>
              <p className="checkout-hint">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
                {tracking && ' · Tracking available'}
              </p>
            </div>
          </div>

          <div className="orders-card-actions">
            {tracking && (
              <a
                href={tracking.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="orders-track-btn"
              >
                <Truck size={13} /> Track
              </a>
            )}
            <span className="orders-details-link">
              Details <ChevronRight size={15} />
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
