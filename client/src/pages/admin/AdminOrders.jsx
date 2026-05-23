import { useEffect, useState } from 'react'
import { X, ChevronDown, Printer, Package, Truck, Zap, Search } from 'lucide-react'
import api from '../../lib/api'
import { formatPrice, formatDate } from '../../lib/utils'
import { isValidUPSTracking } from '../../lib/tracking'
import toast from 'react-hot-toast'

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
const STATUS_COLOR = { pending: 'yellow', processing: 'blue', shipped: 'indigo', delivered: 'green', cancelled: 'red' }
const STATUS_LABELS = {
  pending: 'Awaiting Payment',
  processing: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [statusCounts, setStatusCounts] = useState({})
  const [pendingStatus, setPendingStatus] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [shipTracking, setShipTracking] = useState('')
  const [shipping, setShipping] = useState(false)
  const [ordersPassword, setOrdersPassword] = useState(() => sessionStorage.getItem('adminOrdersPassword') || '')
  const [ordersUnlocked, setOrdersUnlocked] = useState(() => Boolean(sessionStorage.getItem('adminOrdersPassword')))
  const [unlocking, setUnlocking] = useState(false)

  const ordersAuthConfig = (config = {}) => ({
    ...config,
    headers: {
      ...(config.headers || {}),
      'x-admin-orders-password': ordersPassword,
    },
  })

  const load = () => {
    if (!ordersUnlocked) return
    setLoading(true)
    api.get('/orders', ordersAuthConfig({
      params: {
        page,
        limit: 20,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      },
    }))
      .then(({ data }) => { setOrders(data.orders); setTotal(data.total); setPages(data.pages) })
      .catch((err) => {
        if (err.response?.status === 403) {
          sessionStorage.removeItem('adminOrdersPassword')
          setOrdersUnlocked(false)
          toast.error('Orders password is required')
        } else {
          toast.error(err.response?.data?.message || 'Failed to load orders')
        }
      })
      .finally(() => setLoading(false))

    // Load status counts
    api.get('/orders/stats/counts', ordersAuthConfig())
      .then(({ data }) => setStatusCounts(data))
      .catch(() => {})
  }

  // Debounce search so we don't fire a request on every keystroke
  useEffect(() => {
    const t = setTimeout(() => { load() }, search ? 300 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, search, ordersUnlocked])

  const handleUnlockOrders = async (e) => {
    e.preventDefault()
    const password = ordersPassword.trim()
    if (!password) return toast.error('Enter the orders password')

    setUnlocking(true)
    try {
      await api.get('/orders/stats/counts', {
        headers: { 'x-admin-orders-password': password },
      })
      sessionStorage.setItem('adminOrdersPassword', password)
      setOrdersPassword(password)
      setOrdersUnlocked(true)
      setPage(1)
      toast.success('Orders unlocked')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid orders password')
    } finally {
      setUnlocking(false)
    }
  }

  const handleStatusChange = async () => {
    if (!selected || !pendingStatus || pendingStatus === selected.status) return

    // Confirmation for destructive action
    if (pendingStatus === 'cancelled') {
      const ok = window.confirm(
        `Cancel order #${selected._id.slice(-8).toUpperCase()}?\n\nThis action cannot be undone. The customer will be notified.`
      )
      if (!ok) return
    }

    // Confirmation for backward transitions (e.g., shipped → processing)
    const order = ['pending', 'processing', 'shipped', 'delivered']
    const currentIdx = order.indexOf(selected.status)
    const nextIdx = order.indexOf(pendingStatus)
    if (currentIdx > -1 && nextIdx > -1 && nextIdx < currentIdx) {
      const ok = window.confirm(
        `Move order back from "${STATUS_LABELS[selected.status]}" to "${STATUS_LABELS[pendingStatus]}"?\n\nThis is unusual — please confirm.`
      )
      if (!ok) return
    }

    setUpdatingStatus(true)
    try {
      await api.put(`/orders/${selected._id}/status`, { status: pendingStatus }, ordersAuthConfig())
      toast.success(`Status updated to ${STATUS_LABELS[pendingStatus]}`)
      setSelected((o) => ({ ...o, status: pendingStatus }))
      setPendingStatus('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  // Reset staged status when opening a different order
  const openOrder = (order) => {
    setSelected(order)
    setPendingStatus('')
    setTrackingNumber('')
    setShipTracking(order.trackingNumber || '')
  }

  // Quick-ship flow: validates tracking + updates both tracking and status to shipped
  const handleShipOrder = async () => {
    const trk = shipTracking.trim().toUpperCase()
    if (!trk) {
      toast.error('Please enter a UPS tracking number')
      return
    }
    if (!isValidUPSTracking(trk)) {
      const ok = window.confirm(
        `"${trk}" doesn't look like a standard UPS tracking number (e.g. 1Z999AA10123456784).\n\nShip anyway?`
      )
      if (!ok) return
    }

    setShipping(true)
    try {
      // 1. Save tracking number
      await api.put(`/orders/${selected._id}/tracking`, { trackingNumber: trk }, ordersAuthConfig())

      toast.success('Order marked as shipped — customer can now track')
      setSelected((o) => ({ ...o, trackingNumber: trk, status: 'shipped' }))
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to ship order')
    } finally {
      setShipping(false)
    }
  }

  const handleTrackingUpdate = async () => {
    if (!trackingNumber.trim()) return toast.error('Please enter a tracking number')
    await api.put(`/orders/${selected._id}/tracking`, { trackingNumber: trackingNumber.trim() }, ordersAuthConfig())
    toast.success('Tracking number updated')
    setSelected((o) => ({ ...o, trackingNumber: trackingNumber.trim() }))
    load()
  }

  const printInvoice = () => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(generateInvoiceHTML(selected))
    printWindow.document.close()
    printWindow.print()
  }

  const printPackingSlip = () => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(generatePackingSlipHTML(selected))
    printWindow.document.close()
    printWindow.print()
  }

  // Helper: escape HTML to prevent injection
  const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

  // Helper: format shipping address with fallback, optionally including recipient name
  const formatShippingAddress = (order, includeName = false) => {
    const a = order.shippingAddress || {}
    const hasAddress = a.line1 && a.city && a.state && a.zip

    if (!hasAddress) {
      return `<span style="color: #dc2626; font-weight: 600;">⚠ No shipping address on file</span><br>
              <span style="font-size: 11px; color: #9ca3af;">Contact customer: ${esc(order.user?.email || '—')}</span>`
    }

    const nameBlock = includeName && order.user?.name
      ? `<strong>${esc(order.user.name)}</strong><br>`
      : ''

    const cityStateZip = [
      a.city ? esc(a.city) : '',
      a.state ? esc(a.state) : '',
    ].filter(Boolean).join(', ') + (a.zip ? ` ${esc(a.zip)}` : '')

    return `
      ${nameBlock}
      ${esc(a.line1)}<br>
      ${a.line2 ? esc(a.line2) + '<br>' : ''}
      ${cityStateZip}<br>
      ${esc(a.country || 'United States')}
    `
  }

  const generateInvoiceHTML = (order) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice #${order._id.slice(-8).toUpperCase()}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #2d7a3a; padding-bottom: 20px; }
          .company { font-size: 24px; font-weight: bold; color: #2d7a3a; }
          .invoice-title { font-size: 32px; color: #1c2b1c; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f7faf7; padding: 12px; text-align: left; font-size: 12px; color: #6b7280; border-bottom: 2px solid #e8eee8; }
          td { padding: 12px; border-bottom: 1px solid #e8eee8; }
          .total-row { font-weight: bold; font-size: 16px; background: #f7faf7; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e8eee8; font-size: 12px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company">Evolve Specialty Pharmacy & Wellness</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Health & Wellness Store</div>
            <div style="font-size: 11px; color: #6b7280; line-height: 1.5;">
              19239 Stone Oak Pkwy Ste # 103<br>
              San Antonio, TX 78258
            </div>
          </div>
          <div style="text-align: right;">
            <div class="invoice-title">INVOICE</div>
            <div style="font-size: 14px; color: #6b7280; margin-top: 8px;">#${order._id.slice(-8).toUpperCase()}</div>
            <div style="font-size: 12px; color: #9ca3af;">${formatDate(order.createdAt)}</div>
          </div>
        </div>
        
        <div style="display: flex; gap: 40px; margin-bottom: 40px;">
          <div class="section" style="flex: 1;">
            <div class="section-title">Bill To:</div>
            <div style="font-weight: 600;">${order.user?.name || 'N/A'}</div>
            <div style="font-size: 13px; color: #6b7280;">${order.user?.email || ''}</div>
          </div>
          <div class="section" style="flex: 1;">
            <div class="section-title">Ship To:</div>
            <div style="font-size: 13px; line-height: 1.6;">
              ${formatShippingAddress(order, true)}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: center;">Quantity</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items?.map(item => `
              <tr>
                <td>${item.name}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">${formatPrice(item.price)}</td>
                <td style="text-align: right;">${formatPrice(item.price * item.quantity)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3" style="text-align: right;">TOTAL</td>
              <td style="text-align: right;">${formatPrice(order.total)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p><strong>Payment Status:</strong> ${order.isPaid ? 'PAID' : 'PENDING'}</p>
          <p><strong>Payment Method:</strong> ${(order.paymentMethod || 'Stripe').charAt(0).toUpperCase() + (order.paymentMethod || 'Stripe').slice(1)}</p>
          ${order.trackingNumber ? `<p><strong>Tracking Number:</strong> ${order.trackingNumber}</p>` : ''}
          <p style="margin-top: 20px;">Thank you for your business!</p>
        </div>
      </body>
      </html>
    `
  }

  const generatePackingSlipHTML = (order) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Packing Slip #${order._id.slice(-8).toUpperCase()}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { border: 3px solid #2d7a3a; padding: 20px; margin-bottom: 30px; }
          .title { font-size: 28px; font-weight: bold; color: #2d7a3a; margin-bottom: 10px; }
          .order-id { font-size: 18px; color: #1c2b1c; }
          .section { margin-bottom: 25px; padding: 15px; background: #f7faf7; border-left: 4px solid #2d7a3a; }
          .section-title { font-size: 12px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
          .address { font-size: 14px; line-height: 1.8; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #2d7a3a; color: white; padding: 12px; text-align: left; font-size: 13px; }
          td { padding: 12px; border-bottom: 1px solid #e8eee8; }
          .item-row { background: white; }
          .item-row:nth-child(even) { background: #f7faf7; }
          .tracking-box { border: 2px dashed #2d7a3a; padding: 20px; margin-top: 30px; text-align: center; }
          .tracking-label { font-size: 14px; font-weight: bold; color: #6b7280; margin-bottom: 8px; }
          .tracking-number { font-size: 24px; font-weight: bold; color: #2d7a3a; font-family: monospace; }
          .ups-logo { font-size: 32px; font-weight: bold; color: #351c15; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="ups-logo">UPS</div>
          <div class="title">PACKING SLIP</div>
          <div class="order-id">Order #${order._id.slice(-8).toUpperCase()}</div>
          <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${formatDate(order.createdAt)}</div>
        </div>

        <div class="section">
          <div class="section-title">Ship To:</div>
          <div class="address">
            ${formatShippingAddress(order, true)}
          </div>
        </div>

        <div class="section">
          <div class="section-title">Ship From:</div>
          <div class="address">
            <strong>Evolve Specialty Pharmacy & Wellness</strong><br>
            19239 Stone Oak Pkwy Ste # 103<br>
            San Antonio, TX 78258<br>
            United States
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th style="text-align: center; width: 100px;">Quantity</th>
              <th style="text-align: center; width: 100px;">✓</th>
            </tr>
          </thead>
          <tbody>
            ${order.items?.map(item => `
              <tr class="item-row">
                <td><strong>${item.name}</strong></td>
                <td style="text-align: center; font-size: 18px; font-weight: bold;">${item.quantity}</td>
                <td style="text-align: center;">☐</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${order.trackingNumber ? `
          <div class="tracking-box">
            <div class="tracking-label">UPS TRACKING NUMBER</div>
            <div class="tracking-number">${order.trackingNumber}</div>
          </div>
        ` : `
          <div class="tracking-box">
            <div class="tracking-label">UPS TRACKING NUMBER</div>
            <div style="font-size: 14px; color: #9ca3af; margin-top: 8px;">To be assigned</div>
          </div>
        `}

        <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
          <strong>⚠️ Handling Instructions:</strong>
          <ul style="margin: 8px 0; padding-left: 20px;">
            <li>Handle with care - Contains health products</li>
            <li>Keep in cool, dry place</li>
            <li>Verify all items before sealing package</li>
          </ul>
        </div>
      </body>
      </html>
    `
  }

  if (!ordersUnlocked) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Orders</h1>
        </div>

        <div className="admin-card" style={{ maxWidth: 460 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c', marginBottom: 8 }}>Orders Password Required</h2>
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 18 }}>
            Enter the orders password to view or modify orders. You can change it in the server environment variable
            <code style={{ marginLeft: 4 }}>ADMIN_ORDERS_PASSWORD</code>.
          </p>
          <form onSubmit={handleUnlockOrders} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              value={ordersPassword}
              onChange={(e) => setOrdersPassword(e.target.value)}
              placeholder="Orders password"
              className="auth-field"
              style={{ margin: 0 }}
              autoFocus
            />
            <button type="submit" className="btn-admin btn-admin-primary" disabled={unlocking}>
              {unlocking ? 'Checking...' : 'Unlock Orders'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Orders <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 18 }}>({total})</span></h1>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => { setStatusFilter(''); setPage(1) }}
            className={statusFilter === '' ? 'btn-admin btn-admin-primary' : 'btn-admin btn-admin-secondary'}
            style={{ fontSize: 13 }}
          >
            All {statusCounts.all ? `(${statusCounts.all})` : ''}
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={statusFilter === s ? 'btn-admin btn-admin-primary' : 'btn-admin btn-admin-secondary'}
              style={{ fontSize: 13 }}
            >
              {STATUS_LABELS[s] || s} {statusCounts[s] ? `(${statusCounts[s]})` : ''}
            </button>
          ))}
        </div>

        <div className="admin-search" style={{ marginLeft: 'auto', minWidth: 240 }}>
          <Search size={15} className="admin-search-icon" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by order number…"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setPage(1) }}
              title="Clear"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={6} className="admin-empty">No orders found</td></tr>
              ) : orders.map((order) => (
                <tr key={order._id}>
                  <td>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>#{order._id.slice(-8).toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{order.items?.length} item{order.items?.length !== 1 ? 's' : ''}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1c2b1c' }}>{order.user?.name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{order.user?.email}</div>
                  </td>
                  <td style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(order.createdAt)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPrice(order.total)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`admin-badge ${STATUS_COLOR[order.status] || 'gray'}`}>{STATUS_LABELS[order.status] || order.status}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => openOrder(order)} className="btn-admin btn-admin-sm btn-admin-secondary">Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="admin-pagination">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={page === p ? 'active' : ''}>{p}</button>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid #e8eee8', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c' }}>Order #{selected._id.slice(-8).toUpperCase()}</h2>
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{formatDate(selected.createdAt)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="btn-admin btn-admin-sm btn-admin-secondary"><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* ── Quick Ship Action Card ── (only shows when order is Confirmed/processing) */}
              {selected.status === 'processing' && (() => {
                const trk = shipTracking.trim().toUpperCase()
                const isValid = trk && isValidUPSTracking(trk)
                const showWarning = trk && !isValid

                return (
                  <div style={{
                    background: 'linear-gradient(135deg, #f0f9f4 0%, #e6f7ec 100%)',
                    border: '2px solid #2d7a3a',
                    borderRadius: 14,
                    padding: 18,
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Decorative icon */}
                    <div style={{
                      position: 'absolute',
                      top: -10,
                      right: -10,
                      width: 80,
                      height: 80,
                      background: 'rgba(45, 122, 58, 0.08)',
                      borderRadius: '50%'
                    }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, position: 'relative' }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        background: '#2d7a3a',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Zap size={16} style={{ color: 'white' }} fill="white" />
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>Ready to Ship</p>
                        <p style={{ fontSize: 11, color: '#15803d' }}>Add tracking and mark as shipped in one step</p>
                      </div>
                    </div>

                    <div style={{ marginTop: 14, position: 'relative' }}>
                      <label style={{
                        display: 'block',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#166534',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 6
                      }}>
                        UPS Tracking Number *
                      </label>
                      <input
                        type="text"
                        value={shipTracking}
                        onChange={(e) => setShipTracking(e.target.value.toUpperCase())}
                        placeholder="1Z999AA10123456784"
                        disabled={shipping}
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          fontSize: 14,
                          fontFamily: 'monospace',
                          border: `1.5px solid ${showWarning ? '#f59e0b' : '#2d7a3a'}`,
                          borderRadius: 10,
                          outline: 'none',
                          background: 'white',
                          letterSpacing: '0.04em'
                        }}
                      />

                      {/* Validation feedback */}
                      {trk && (
                        <div style={{
                          marginTop: 8,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          {isValid ? (
                            <>
                              <span style={{
                                background: '#2d7a3a',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontWeight: 700,
                                fontSize: 10,
                                letterSpacing: '0.04em'
                              }}>
                                ✓ VALID UPS
                              </span>
                              <span style={{ color: '#166534' }}>Tracking number looks good</span>
                            </>
                          ) : (
                            <span style={{ color: '#92400e' }}>
                              ⚠ Not a standard UPS format (expected: <span style={{ fontFamily: 'monospace' }}>1Z + 16 chars</span>)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleShipOrder}
                      disabled={!shipTracking.trim() || shipping}
                      style={{
                        marginTop: 14,
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 14,
                        fontWeight: 700,
                        background: !shipTracking.trim() || shipping ? '#9ca3af' : '#2d7a3a',
                        color: 'white',
                        border: 'none',
                        borderRadius: 10,
                        cursor: !shipTracking.trim() || shipping ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.15s',
                        boxShadow: !shipTracking.trim() || shipping ? 'none' : '0 4px 12px rgba(45, 122, 58, 0.25)'
                      }}
                    >
                      <Truck size={16} />
                      {shipping ? 'Shipping...' : 'Mark as Shipped'}
                    </button>

                    <p style={{ fontSize: 11, color: '#15803d', textAlign: 'center', marginTop: 8 }}>
                      The customer will see the tracking link immediately
                    </p>
                  </div>
                )
              })()}

              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Customer</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1c2b1c' }}>{selected.user?.name}</p>
                <p style={{ fontSize: 13, color: '#6b7280' }}>{selected.user?.email}</p>
              </div>
              {selected.shippingAddress?.line1 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Shipping Address</p>
                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    {selected.shippingAddress.line1}{selected.shippingAddress.line2 ? `, ${selected.shippingAddress.line2}` : ''}<br />
                    {selected.shippingAddress.city}, {selected.shippingAddress.state} {selected.shippingAddress.zip}<br />
                    {selected.shippingAddress.country}
                  </p>
                </div>
              )}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Items</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selected.items?.map((item) => (
                    <div key={item._id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src={item.image || 'https://placehold.co/48x48?text=?'} alt={item.name}
                        style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', border: '1px solid #e8eee8' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1c2b1c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                        <p style={{ fontSize: 11, color: '#9ca3af' }}>×{item.quantity} · {formatPrice(item.price)} each</p>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1c2b1c' }}>{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '1px solid #e8eee8', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>Subtotal</span>
                  <span style={{ fontWeight: 600 }}>{formatPrice(selected.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#1c2b1c' }}>
                  <span>Total</span>
                  <span>{formatPrice(selected.total)}</span>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Tracking Number (UPS)</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={trackingNumber || selected.trackingNumber || ''}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter UPS tracking number"
                    className="auth-field"
                    style={{ flex: 1, margin: 0, fontSize: 13 }}
                  />
                  <button onClick={handleTrackingUpdate} className="btn-admin btn-admin-primary" style={{ fontSize: 12 }}>
                    Update
                  </button>
                </div>
                {selected.trackingNumber && (
                  <p style={{ fontSize: 11, color: '#2d7a3a', marginTop: 6 }}>Current: {selected.trackingNumber}</p>
                )}
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Update Status</p>

                {/* Current status display */}
                <div style={{
                  padding: '10px 14px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Current status</span>
                  <span className={`admin-badge ${STATUS_COLOR[selected.status] || 'gray'}`}>
                    {STATUS_LABELS[selected.status] || selected.status}
                  </span>
                </div>

                {/* Status selector */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={pendingStatus}
                    onChange={(e) => setPendingStatus(e.target.value)}
                    disabled={updatingStatus}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      fontSize: 13,
                      border: '1.5px solid #e5e7eb',
                      borderRadius: 10,
                      background: 'white',
                      cursor: updatingStatus ? 'not-allowed' : 'pointer',
                      outline: 'none',
                      color: pendingStatus ? '#1a1a1a' : '#9ca3af'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2d7a3a'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  >
                    <option value="">Select new status...</option>
                    {STATUSES.filter((s) => s !== selected.status).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s] || s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleStatusChange}
                    disabled={!pendingStatus || updatingStatus || pendingStatus === selected.status}
                    className="btn-admin btn-admin-primary"
                    style={{
                      fontSize: 12,
                      opacity: (!pendingStatus || updatingStatus) ? 0.5 : 1,
                      cursor: (!pendingStatus || updatingStatus) ? 'not-allowed' : 'pointer',
                      minWidth: 90
                    }}
                  >
                    {updatingStatus ? 'Updating...' : 'Apply'}
                  </button>
                </div>

                {/* Preview of the change */}
                {pendingStatus && pendingStatus !== selected.status && (
                  <div style={{
                    marginTop: 10,
                    padding: '10px 12px',
                    background: pendingStatus === 'cancelled' ? '#fef2f2' : '#f0f9f4',
                    border: `1px solid ${pendingStatus === 'cancelled' ? '#fecaca' : '#bbf7d0'}`,
                    borderRadius: 8,
                    fontSize: 12,
                    color: pendingStatus === 'cancelled' ? '#991b1b' : '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <span style={{ fontSize: 14 }}>
                      {pendingStatus === 'cancelled' ? '⚠️' : '✓'}
                    </span>
                    <span>
                      Will change from <strong>{STATUS_LABELS[selected.status]}</strong> to <strong>{STATUS_LABELS[pendingStatus]}</strong>
                      {pendingStatus === 'cancelled' && ' — requires confirmation'}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Print Documents</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={printInvoice} className="btn-admin btn-admin-secondary" style={{ fontSize: 12, flex: 1 }}>
                    <Printer size={14} /> Invoice
                  </button>
                  <button onClick={printPackingSlip} className="btn-admin btn-admin-secondary" style={{ fontSize: 12, flex: 1 }}>
                    <Package size={14} /> UPS Packing Slip
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
