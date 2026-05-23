const { withEmailUtms } = require('../utils/emailLinks')

const formatMoney = (n) => `$${Number(n).toFixed(2)}`

const formatAddress = (addr) => {
  if (!addr?.line1) return '—'
  return [
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.zip].filter(Boolean).join(', '),
    addr.country,
  ].filter(Boolean).join('\n')
}

const buildNewOrderNotificationEmail = ({ order, user, clientUrl }) => {
  const orderId = order._id.toString().slice(-8).toUpperCase()
  const adminOrderUrl = withEmailUtms(`${clientUrl}/admin/orders`, {
    campaign: 'new_order_notification',
    content: 'admin_orders',
  })
  const customerName = user?.name || 'Customer'
  const customerEmail = user?.email || 'No email'
  const isPickup = order.fulfillmentMethod === 'pickup'
  const fulfillmentLabel = isPickup ? 'Pickup' : 'Ship to'
  const fulfillmentText = isPickup
    ? `Pickup time: ${order.pickup?.display || 'Selected pickup time'}\nPickup at: ${formatAddress(order.pickup?.address)}`
    : formatAddress(order.shippingAddress)

  const itemsText = order.items
    .map((item) => `  - ${item.name} x${item.quantity}: ${formatMoney(item.price * item.quantity)}`)
    .join('\n')

  const itemsHtml = order.items.map((item) => (
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">${item.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatMoney(item.price * item.quantity)}</td>
    </tr>`
  )).join('')

  const subject = `New paid order #${orderId} — ${formatMoney(order.total)}`

  const text = `New paid order received.

Order #${orderId}
Customer: ${customerName} <${customerEmail}>
Total: ${formatMoney(order.total)}

Items:
${itemsText}

${fulfillmentLabel}:
${fulfillmentText}

Admin orders: ${adminOrderUrl}
`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f4;color:#333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#0d0d0d;padding:24px 32px;border-bottom:3px solid #c9a227;">
          <h1 style="margin:0;color:#fff;font-size:22px;">New Paid Order</h1>
          <p style="margin:8px 0 0;color:#c9a227;font-size:14px;">#${orderId}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;"><strong>Customer:</strong> ${customerName} &lt;${customerEmail}&gt;</p>
          <p style="margin:0 0 20px;"><strong>Total:</strong> ${formatMoney(order.total)}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <thead><tr>
              <th align="left" style="padding-bottom:8px;border-bottom:2px solid #ddd;">Item</th>
              <th align="center" style="padding-bottom:8px;border-bottom:2px solid #ddd;">Qty</th>
              <th align="right" style="padding-bottom:8px;border-bottom:2px solid #ddd;">Total</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <p style="margin:0 0 8px;"><strong>${fulfillmentLabel}:</strong></p>
          <pre style="white-space:pre-wrap;background:#f8f6f0;border-radius:6px;padding:12px;font-family:Arial,sans-serif;">${fulfillmentText}</pre>
          <a href="${adminOrderUrl}" style="display:inline-block;background:#c9a227;color:#0d0d0d;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;">Open Admin Orders</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}

module.exports = { buildNewOrderNotificationEmail }
