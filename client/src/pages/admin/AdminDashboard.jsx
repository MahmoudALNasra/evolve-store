import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Users, DollarSign, Package, TrendingUp, AlertTriangle } from 'lucide-react'
import api from '../../lib/api'
import { formatPrice, formatDate } from '../../lib/utils'

const STATUS_COLOR = { pending: 'yellow', processing: 'blue', shipped: 'indigo', delivered: 'green', cancelled: 'red' }

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/stats')
      .then(({ data }) => setStats(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>
  if (!stats) return null

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Dashboard</h1>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-card-top">
            <div className="admin-stat-card-label">Total Revenue</div>
            <div className="admin-stat-card-icon" style={{ background: '#d1fae5' }}>
              <DollarSign size={20} style={{ color: '#065f46' }} />
            </div>
          </div>
          <div className="admin-stat-card-value">{formatPrice(stats.totalRevenue)}</div>
          <div className="admin-stat-card-sub">{formatPrice(stats.revenueToday)} today</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-card-top">
            <div className="admin-stat-card-label">Total Orders</div>
            <div className="admin-stat-card-icon" style={{ background: '#dbeafe' }}>
              <ShoppingBag size={20} style={{ color: '#1e40af' }} />
            </div>
          </div>
          <div className="admin-stat-card-value">{stats.totalOrders}</div>
          <div className="admin-stat-card-sub">{stats.ordersToday} today</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-card-top">
            <div className="admin-stat-card-label">Total Products</div>
            <div className="admin-stat-card-icon" style={{ background: '#e0e7ff' }}>
              <Package size={20} style={{ color: '#3730a3' }} />
            </div>
          </div>
          <div className="admin-stat-card-value">{stats.totalProducts}</div>
          <div className="admin-stat-card-sub">{stats.lowStockProducts?.length || 0} low stock</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-card-top">
            <div className="admin-stat-card-label">Total Users</div>
            <div className="admin-stat-card-icon" style={{ background: '#f3e8ff' }}>
              <Users size={20} style={{ color: '#6b21a8' }} />
            </div>
          </div>
          <div className="admin-stat-card-value">{stats.totalUsers}</div>
          <div className="admin-stat-card-sub">{stats.newUsersToday} joined today</div>
        </div>
      </div>

      <div className="admin-grid-2">
        <div className="admin-card" style={{ gridColumn: '1 / -1' }}>
          <h2 className="admin-card-title"><TrendingUp size={16} /> Revenue (Last 30 Days)</h2>
          {stats.revenueChart?.length > 0 ? (
            <div className="admin-chart">
              {stats.revenueChart.map((d) => {
                const max = Math.max(...stats.revenueChart.map((x) => x.revenue))
                const pct = max > 0 ? (d.revenue / max) * 100 : 0
                return (
                  <div key={d._id} className="admin-chart-bar" style={{ height: `${Math.max(pct, 2)}%` }}>
                    <div className="admin-chart-tooltip">{d._id}: {formatPrice(d.revenue)}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="admin-empty"><p>No revenue data yet.</p></div>
          )}
        </div>

        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h2 className="admin-card-title" style={{ margin: 0 }}>Recent Orders</h2>
            <Link to="/admin/orders" style={{ fontSize: 12, fontWeight: 600, color: '#2d7a3a' }}>View all →</Link>
          </div>
          {stats.recentOrders?.length === 0 ? (
            <div className="admin-empty"><p>No orders yet.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stats.recentOrders?.map((order) => (
                <Link
                  key={order._id}
                  to={`/admin/orders?orderId=${order._id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingBottom: 12,
                    borderBottom: '1px solid #f0f4f0',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1c2b1c' }}>#{order._id.slice(-6).toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{order.user?.name} · {formatDate(order.createdAt)}</div>
                    <div style={{ fontSize: 11, color: '#2d7a3a', marginTop: 4, fontWeight: 600 }}>Edit order →</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1c2b1c' }}>{formatPrice(order.total)}</div>
                    <span className={`admin-badge ${STATUS_COLOR[order.status] || 'gray'}`}>{order.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="admin-card">
          <h2 className="admin-card-title"><AlertTriangle size={16} /> Low Stock Alert</h2>
          {stats.lowStockProducts?.length === 0 ? (
            <div className="admin-empty"><p>All products well stocked.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stats.lowStockProducts?.map((p) => (
                <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #f0f4f0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1c2b1c' }}>{p.name}</div>
                    {p.sku && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>SKU: {p.sku}</div>}
                  </div>
                  <span className={`admin-badge ${p.stock === 0 ? 'red' : 'yellow'}`}>{p.stock} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
