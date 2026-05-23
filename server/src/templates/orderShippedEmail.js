const { withEmailUtms } = require('../utils/emailLinks')

const buildOrderShippedEmail = ({ order, userName, clientUrl }) => {
  const orderId = order._id.toString().slice(-8).toUpperCase()
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@evolvepharmacy.com'
  const storeName = process.env.EMAIL_FROM_NAME || 'Evolve Specialty Pharmacy & Wellness'
  const ordersUrl = withEmailUtms(`${clientUrl}/orders/${order._id}`, {
    campaign: 'order_shipped',
    content: 'view_order',
  })
  const trackingUrl = order.trackingNumber
    ? withEmailUtms(`https://www.ups.com/track?tracknum=${encodeURIComponent(order.trackingNumber)}`, {
        campaign: 'order_shipped',
        content: 'ups_tracking',
      })
    : ''

  const trackingLine = order.trackingNumber
    ? `Tracking number: ${order.trackingNumber}
Track with UPS: ${trackingUrl}`
    : 'Tracking details will be available in your account soon.'

  const subject = `Your order has shipped — #${orderId} | ${storeName}`

  const text = `Hi ${userName},

Great news — your order #${orderId} from ${storeName} has shipped!

${trackingLine}

View order details: ${ordersUrl}

Questions? Contact us at ${supportEmail}
`

  const trackingHtml = order.trackingNumber
    ? `<div style="margin:0 0 16px;padding:12px 16px;background:#f8f6f0;border-radius:6px;border-left:3px solid #c9a227;">
        <p style="margin:0 0 10px;"><strong>Tracking:</strong> ${order.trackingNumber}</p>
        <a href="${trackingUrl}" style="display:inline-block;color:#0d0d0d;font-weight:bold;text-decoration:underline;">Track package with UPS</a>
      </div>`
    : ''

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;max-width:600px;">
        <tr><td style="background:#0d0d0d;padding:24px 32px;border-bottom:3px solid #c9a227;">
          <h1 style="margin:0;color:#fff;font-size:22px;">${storeName}</h1>
          <p style="margin:8px 0 0;color:#c9a227;">Your order has shipped</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;">Hi ${userName},</p>
          <p style="margin:0 0 16px;line-height:1.6;">Order <strong>#${orderId}</strong> is on its way!</p>
          ${trackingHtml}
          <a href="${ordersUrl}" style="display:inline-block;background:#c9a227;color:#0d0d0d;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;">View order</a>
          <p style="margin:24px 0 0;font-size:13px;color:#888;">Questions? <a href="mailto:${supportEmail}" style="color:#a68520;">${supportEmail}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}

module.exports = { buildOrderShippedEmail }
