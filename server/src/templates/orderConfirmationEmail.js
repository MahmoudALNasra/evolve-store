const { withEmailUtms } = require('../utils/emailLinks')
const { formatPaymentMethodLabel } = require('../services/stripeOrderReconcile')
const { SALES_TAX_RATE } = require('../utils/salesTax')
const { ADDRESS_SUPPORT_EMAIL } = require('../utils/addressEditWindow')

const formatMoney = (n) => `$${Number(n || 0).toFixed(2)}`

function getEmailLogoUrl(clientUrl) {
  if (process.env.EMAIL_LOGO_URL) {
    return String(process.env.EMAIL_LOGO_URL).trim()
  }
  const origin = (process.env.SITE_URL || process.env.CLIENT_URL || clientUrl || 'https://evolvepharmacy.com')
    .replace(/\/$/, '')
  return `${origin}/logo.png`
}

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
  const discount = Number(order.discount || 0)
  const tax = Number(order.tax || 0)
  const shipping = Number(order.shipping || 0)
  const subtotal = Number(order.subtotal || 0)
  const total = Number(order.amountPaid || order.total || 0)
  const taxRatePct = (SALES_TAX_RATE * 100).toFixed(2).replace(/\.00$/, '')
  const paymentLabel = formatPaymentMethodLabel(order)
  const supportEmail = ADDRESS_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || 'info@evolvepharmacy.com'
  const storeName = process.env.EMAIL_FROM_NAME || 'Evolve Specialty Pharmacy & Wellness'
  const logoUrl = getEmailLogoUrl(clientUrl)
  const siteOrigin = (process.env.SITE_URL || process.env.CLIENT_URL || clientUrl || 'https://evolvepharmacy.com').replace(/\/$/, '')
  const ordersLink = ordersUrl || withEmailUtms(`${siteOrigin}/orders`, {
    campaign: 'order_confirmation',
    content: 'view_orders',
  })

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
          <td style="padding:8px 0;border-bottom:1px solid #eee;">${item.name}${item.isTaxable ? ' <span style="color:#888;font-size:11px;">(taxable)</span>' : ''}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatMoney(item.price * item.quantity)}</td>
        </tr>`
    )
    .join('')

  const itemsText = order.items
    .map((item) => `  - ${item.name} x${item.quantity}: ${formatMoney(item.price * item.quantity)}${item.isTaxable ? ' (taxable)' : ''}`)
    .join('\n')

  const discountText = discount > 0
    ? `Discount${order.discountCode ? ` (${order.discountCode})` : ''}: -${formatMoney(discount)}\n`
    : ''
  const discountHtml = discount > 0
    ? `<tr><td>Discount${order.discountCode ? ` (${order.discountCode})` : ''}</td><td align="right" style="color:#15803d;">-${formatMoney(discount)}</td></tr>`
    : ''

  const subject = `Order confirmed — #${orderId} | ${storeName}`

  const text = `Hi ${userName},

Thank you for your purchase at ${storeName}!

Order #${orderId}
Date: ${new Date(order.paidAt || order.createdAt).toLocaleString('en-US')}
Payment: ${paymentLabel}

Items:
${itemsText}

Subtotal: ${formatMoney(subtotal)}
${discountText}Shipping: ${shipping > 0 ? formatMoney(shipping) : 'Free'}
Sales Tax (${taxRatePct}%): ${formatMoney(tax)}
Amount paid: ${formatMoney(total)}

${pickupLine}

View your orders: ${ordersLink}
Questions? Contact us at ${supportEmail}
`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f4;color:#333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:#0d0d0d;padding:20px 32px;border-bottom:3px solid #c9a227;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;width:72px;">
                  <img src="${logoUrl}" alt="${storeName}" width="64" height="64" style="display:block;border:0;border-radius:8px;" />
                </td>
                <td style="padding-left:16px;vertical-align:middle;">
                  <h1 style="margin:0;color:#fff;font-size:20px;line-height:1.3;">${storeName}</h1>
                  <p style="margin:6px 0 0;color:#c9a227;font-size:14px;">Order confirmation</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;">Hi ${userName},</p>
            <p style="margin:0 0 24px;line-height:1.6;">Thank you for your purchase! We've received your payment and your order is being prepared.</p>
            <p style="margin:0 0 8px;font-size:13px;color:#666;"><strong>Order #${orderId}</strong></p>
            <p style="margin:0 0 4px;font-size:13px;color:#666;">${new Date(order.paidAt || order.createdAt).toLocaleString('en-US')}</p>
            <p style="margin:0 0 24px;font-size:13px;color:#666;"><strong>Paid with:</strong> ${paymentLabel}</p>
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
              <tr><td style="padding:4px 0;">Subtotal</td><td align="right">${formatMoney(subtotal)}</td></tr>
              ${discountHtml}
              <tr><td style="padding:4px 0;">${isPickup ? 'Pickup' : 'Shipping'}</td><td align="right">${shipping > 0 ? formatMoney(shipping) : 'Free'}</td></tr>
              <tr><td style="padding:4px 0;">Sales Tax (${taxRatePct}%)</td><td align="right">${formatMoney(tax)}</td></tr>
              <tr><td style="padding-top:10px;font-weight:bold;font-size:16px;border-top:1px solid #eee;">Amount paid</td><td align="right" style="padding-top:10px;font-weight:bold;font-size:16px;border-top:1px solid #eee;">${formatMoney(total)}</td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#666;">${fulfillmentTitle}</p>
            <p style="margin:0 0 16px;line-height:1.6;white-space:pre-line;">${fulfillmentHtml}</p>
            <p style="margin:0 0 20px;font-size:12px;color:#666;line-height:1.5;">Payments are processed securely by Stripe (cards, debit/credit, Link, and supported bank methods). <a href="${siteOrigin}/return-policy" style="color:#a68520;">14-day return policy</a>.</p>
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

module.exports = { buildOrderConfirmationEmail, formatAddress, getEmailLogoUrl }
