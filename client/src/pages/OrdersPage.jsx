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

  // Stats
  const stats = useMemo(() => ({
    total: orders.length,
    active: orders.filter((o) => ['pending', 'processing'].includes(o.status)).length,
    shipped: orders.filter((o) => o.status === 'shipped').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
  }), [orders])

  // Filtered orders
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
        o.items.some((i) => i.name.toLowerCase().includes(q))
      )
    }
    return result
  }, [orders, filter, search])

  // Count per filter for badges
  const filterCounts = useMemo(() => ({
    all: orders.length,
    processing: orders.filter((o) => ['pending', 'processing'].includes(o.status)).length,
    shipped: orders.filter((o) => o.status === 'shipped').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  }), [orders])

  if (loading) return <div className="spinner-wrap" style={{ minHeight: '60vh' }}><div className="spinner spinner-lg" /></div>

  // Empty state - no orders at all
  if (orders.length === 0) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        <h1 className="page-title">My Orders</h1>
        <div style={{
          background: 'white',
          borderRadius: 16,
          border: '1px solid #e8eee8',
          padding: '80px 40px',
          textAlign: 'center'
        }}>
          <div style={{
            width: 80,
            height: 80,
            background: 'linear-gradient(135deg, #d1f4e0 0%, #a7e9c5 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <Package size={40} style={{ color: '#2d7a3a' }} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>No orders yet</h2>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            When you place your first order, it will appear here. Start exploring our health products!
          </p>
          <Link to="/shop" className="btn-primary" style={{ display: 'inline-flex' }}>
            <ShoppingBag size={16} /> Browse Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>My Orders</h1>
        <p style={{ color: '#6b7280', fontSize: 15 }}>
          Track and manage all your orders in one place
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 32
      }}>
        <StatCard icon={Package} label="Total Orders" value={stats.total} color="#2d7a3a" bg="#d1f4e0" />
        <StatCard icon={Clock} label="Active" value={stats.active} color="#2563eb" bg="#dbeafe" />
        <StatCard icon={Truck} label="In Transit" value={stats.shipped} color="#7c3aed" bg="#ede9fe" />
        <StatCard icon={CheckCircle} label="Delivered" value={stats.delivered} color="#059669" bg="#d1fae5" />
      </div>

      {/* Filter Tabs + Search */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => {
            const count = filterCounts[f.key] || 0
            const isActive = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: `1.5px solid ${isActive ? '#2d7a3a' : '#e5e7eb'}`,
                  borderRadius: 10,
                  background: isActive ? '#2d7a3a' : 'white',
                  color: isActive ? 'white' : '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {f.label}
                {count > 0 && (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: isActive ? 'rgba(255,255,255,0.25)' : '#f3f4f6',
                    color: isActive ? 'white' : '#6b7280',
                    fontWeight: 700
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ position: 'relative', minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              fontSize: 13,
              border: '1.5px solid #e5e7eb',
              borderRadius: 10,
              outline: 'none',
              transition: 'border-color 0.15s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#2d7a3a'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div style={{
          background: 'white',
          borderRadius: 16,
          border: '1px solid #e8eee8',
          padding: '60px 40px',
          textAlign: 'center',
          color: '#9ca3af'
        }}>
          <Search size={40} style={{ margin: '0 auto 16px', opacity: 0.4 }} strokeWidth={1.5} />
          <p style={{ fontSize: 15, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>No matching orders</p>
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

// ─── Stat Card ───────────────────────────────
function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      border: '1px solid #e8eee8',
      padding: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
          {label}
        </p>
        <p style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>{value}</p>
      </div>
    </div>
  )
}

// ─── Order Card ──────────────────────────────
function OrderCard({ order }) {
  const tracking = order.trackingNumber ? getTrackingInfo(order.trackingNumber) : null
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)
  const visibleItems = order.items.slice(0, 4)
  const extraCount = order.items.length - visibleItems.length

  return (
    <Link
      to={`/orders/${order._id}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block'
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 14,
          border: '1px solid #e8eee8',
          padding: 20,
          transition: 'all 0.2s',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#2d7a3a'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(45, 122, 58, 0.08)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#e8eee8'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        {/* Top row: Order info + status + total */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          paddingBottom: 16,
          marginBottom: 16,
          borderBottom: '1px solid #f3f4f6',
          flexWrap: 'wrap'
        }}>
          <div>
            <p style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 4
            }}>
              Order #{order._id.slice(-8).toUpperCase()}
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
              {formatDate(order.createdAt)}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`admin-badge ${STATUS_COLOR[order.status] || 'gray'}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#1c2b1c' }}>
              {formatPrice(order.total)}
            </span>
          </div>
        </div>

        {/* Items row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            {/* Thumbnail stack */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {visibleItems.map((item, idx) => (
                <ProductImage
                  key={item._id || idx}
                  src={item.image}
                  alt={item.name}
                  variant="orderRow"
                  width={44}
                  height={44}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    objectFit: 'cover',
                    border: '2px solid white',
                    boxShadow: '0 0 0 1px #e8eee8',
                    marginLeft: idx === 0 ? 0 : -10,
                    zIndex: visibleItems.length - idx,
                    background: 'white'
                  }}
                />
              ))}
              {extraCount > 0 && (
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: '#f3f4f6',
                  border: '2px solid white',
                  boxShadow: '0 0 0 1px #e8eee8',
                  marginLeft: -10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#6b7280'
                }}>
                  +{extraCount}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#1a1a1a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: 2
              }}>
                {order.items[0]?.name}
                {order.items.length > 1 && (
                  <span style={{ color: '#9ca3af', fontWeight: 500 }}> and {order.items.length - 1} more</span>
                )}
              </p>
              <p style={{ fontSize: 12, color: '#6b7280' }}>
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
                {tracking && (
                  <>
                    {' · '}
                    <span style={{ color: '#2d7a3a', fontWeight: 600 }}>
                      <Truck size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
                      UPS tracking available
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {tracking && (
              <a
                href={tracking.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#2d7a3a',
                  padding: '8px 14px',
                  border: '1.5px solid #2d7a3a',
                  borderRadius: 8,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#2d7a3a'
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#2d7a3a'
                }}
              >
                <Truck size={13} /> Track
              </a>
            )}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 13,
              fontWeight: 600,
              color: '#2d7a3a'
            }}>
              Details <ChevronRight size={15} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
