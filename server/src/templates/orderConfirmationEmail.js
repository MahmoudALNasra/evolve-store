const { withEmailUtms } = require('../utils/emailLinks')

const formatMoney = (n) => `$${Number(n).toFixed(2)}`

const formatAddress = (addr) => {
  if (!addr?.line1) return '—'
  const lines = [
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.zip].filter(Boolean).join(', '),
    addr.country,
  ].filter(Boolean)
  return lines.join('\n')
}

const buildOrderConfirmationEmail = ({ order, userName, clientUrl, ordersUrl }) => {
  const orderId = order._id.toString().slice(-8).toUpperCase()
  const isPickup = order.fulfillmentMethod === 'pickup'
  const pickupLine = isPickup
    ? `Pickup time: ${order.pickup?.display || 'Selected pickup time'}\nPickup at: ${formatAddress(order.pickup?.address)}`
    : `Ship to:\n${formatAddress(order.shippingAddress)}`
  const fulfillmentTitle = isPickup ? 'Pickup details' : 'Ship to'
  const fulfillmentHtml = isPickup
    ? `${order.pickup?.display || 'Selected pickup time'}<br>${formatAddress(order.pickup?.address).replace(/\n/g, '<br>')}`
    : formatAddress(order.shippingAddress).replace(/\n/g, '<br>')
  const itemsHtml = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">${item.name}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatMoney(item.price * item.quantity)}</td>
        </tr>`
    )
    .join('')

  const itemsText = order.items
    .map((item) => `  - ${item.name} x${item.quantity}: ${formatMoney(item.price * item.quantity)}`)
    .join('\n')

  const supportEmail = process.env.SUPPORT_EMAIL || 'support@evolvepharmacy.com'
  const storeName = process.env.EMAIL_FROM_NAME || 'Evolve Specialty Pharmacy & Wellness'
  const ordersLink = ordersUrl || withEmailUtms(`${clientUrl}/orders`, {
    campaign: 'order_confirmation',
    content: 'view_orders',
  })

  const subject = `Order confirmed — #${orderId} | ${storeName}`

  const text = `Hi ${userName},

Thank you for your purchase at ${storeName}!

Order #${orderId}
Date: ${new Date(order.paidAt || order.createdAt).toLocaleString('en-US')}

Items:
${itemsText}

Subtotal: ${formatMoney(order.subtotal)}
Shipping: ${formatMoney(order.shipping)}
Sales Tax: ${formatMoney(order.tax)}
Total: ${formatMoney(order.total)}

${pickupLine}

View your orders: ${ordersLink}

Questions? Contact us at ${supportEmail}

This is an automated message — please do not reply to this email.
`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f4;color:#333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:#0d0d0d;padding:24px 32px;border-bottom:3px solid #c9a227;">
            <h1 style="margin:0;color:#fff;font-size:22px;">${storeName}</h1>
            <p style="margin:8px 0 0;color:#c9a227;font-size:14px;">Order confirmation</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;">Hi ${userName},</p>
            <p style="margin:0 0 24px;line-height:1.6;">Thank you for your purchase! We've received your payment and your order is being prepared.</p>
            <p style="margin:0 0 8px;font-size:13px;color:#666;"><strong>Order #${orderId}</strong></p>
            <p style="margin:0 0 24px;font-size:13px;color:#666;">${new Date(order.paidAt || order.createdAt).toLocaleString('en-US')}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <thead>
                <tr style="font-size:12px;color:#666;text-transform:uppercase;">
                  <th align="left" style="padding-bottom:8px;">Item</th>
                  <th align="center" style="padding-bottom:8px;">Qty</th>
                  <th align="right" style="padding-bottom:8px;">Total</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;font-size:14px;">
              <tr><td>Subtotal</td><td align="right">${formatMoney(order.subtotal)}</td></tr>
            <tr><td>${isPickup ? 'Pickup' : 'Shipping'}</td><td align="right">${order.shipping > 0 ? formatMoney(order.shipping) : 'Free'}</td></tr>
              <tr><td>Sales Tax</td><td align="right">${formatMoney(order.tax)}</td></tr>
              <tr><td style="padding-top:8px;font-weight:bold;font-size:16px;">Total</td><td align="right" style="padding-top:8px;font-weight:bold;font-size:16px;">${formatMoney(order.total)}</td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#666;">${fulfillmentTitle}</p>
            <p style="margin:0 0 24px;line-height:1.6;white-space:pre-line;">${fulfillmentHtml}</p>
            <a href="${ordersLink}" style="display:inline-block;background:#c9a227;color:#0d0d0d;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;">View your orders</a>
            <p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.6;">Questions? Email <a href="mailto:${supportEmail}" style="color:#a68520;">${supportEmail}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f9faf9;font-size:12px;color:#999;text-align:center;">
            This is an automated message from a no-reply address. Please contact ${supportEmail} for support.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}

module.exports = { buildOrderConfirmationEmail, formatAddress }
