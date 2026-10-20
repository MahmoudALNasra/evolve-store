const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const PHONE_DISPLAY = '(210) 314-6464'
const PHONE_TEL = '+12103146464'

const buildPendingPaymentFollowUpEmail = ({ customerName, orderId }) => {
  const name = String(customerName || 'there').trim() || 'there'
  const shortId = String(orderId || '').slice(-8).toUpperCase()
  const subject = shortId
    ? `Follow-up on your Evolve Pharmacy order #${shortId}`
    : 'Follow-up on your Evolve Pharmacy order'

  const text = `Hi ${name},

We're following up on your recent order${shortId ? ` (#${shortId})` : ''} with Evolve Specialty Pharmacy & Wellness.

It looks like payment was not finalized because of a temporary server issue on our side. We're sorry for the inconvenience.

To complete your order, please either:
1. Call the pharmacy at ${PHONE_DISPLAY}, or
2. Reply to this email and we'll help you finish checkout.

Thank you,
Evolve Specialty Pharmacy & Wellness
${PHONE_DISPLAY}
info@evolvepharmacy.com
`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6f4;color:#333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#0d0d0d;padding:24px 32px;border-bottom:3px solid #c9a227;">
          <h1 style="margin:0;color:#fff;font-size:22px;">Order follow-up</h1>
          <p style="margin:8px 0 0;color:#c9a227;font-size:14px;">Evolve Specialty Pharmacy &amp; Wellness</p>
        </td></tr>
        <tr><td style="padding:32px;line-height:1.6;font-size:15px;">
          <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
          <p style="margin:0 0 16px;">
            We're following up on your recent order${shortId ? ` (<strong>#${escapeHtml(shortId)}</strong>)` : ''}
            with Evolve Specialty Pharmacy &amp; Wellness.
          </p>
          <p style="margin:0 0 16px;">
            It looks like payment was not finalized because of a temporary server issue on our side.
            We're sorry for the inconvenience.
          </p>
          <p style="margin:0 0 8px;"><strong>To complete your order, please either:</strong></p>
          <ol style="margin:0 0 20px;padding-left:20px;">
            <li style="margin-bottom:8px;">
              Call the pharmacy at
              <a href="tel:${PHONE_TEL}" style="color:#a68520;font-weight:700;">${PHONE_DISPLAY}</a>
            </li>
            <li>Reply to this email and we'll help you finish checkout.</li>
          </ol>
          <p style="margin:0;">Thank you,<br/>Evolve Specialty Pharmacy &amp; Wellness</p>
          <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
            <a href="tel:${PHONE_TEL}" style="color:#a68520;">${PHONE_DISPLAY}</a>
            · info@evolvepharmacy.com
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}

module.exports = { buildPendingPaymentFollowUpEmail }
