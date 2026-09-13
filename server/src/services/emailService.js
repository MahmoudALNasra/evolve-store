const axios = require('axios')
const { getTransporter, isEmailConfigured, isResendConfigured, isSmtpConfigured } = require('../config/email')
const { buildContactMessageEmail } = require('../templates/contactMessageEmail')
const { buildOrderConfirmationEmail } = require('../templates/orderConfirmationEmail')
const { buildNewOrderNotificationEmail } = require('../templates/newOrderNotificationEmail')
const { buildOrderShippedEmail } = require('../templates/orderShippedEmail')
const { createEmailLoginUrl } = require('../utils/emailLoginToken')

const getFromAddress = () => {
  const name = process.env.EMAIL_FROM_NAME || 'Evolve Specialty Pharmacy & Wellness'
  const email = process.env.EMAIL_FROM
  return `"${name}" <${email}>`
}

const formatProviderError = (err) => {
  const status = err.response?.status
  const data = err.response?.data
  const detail =
    typeof data === 'string'
      ? data
      : data
        ? JSON.stringify(data)
        : ''
  return [err.message, status ? `status=${status}` : '', detail].filter(Boolean).join(' | ')
}

const sendWithResend = async ({ to, subject, text, html }) => {
  const { data } = await axios.post(
    'https://api.resend.com/emails',
    {
      from: getFromAddress(),
      to: [to],
      subject,
      text,
      html,
      reply_to: process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: Number(process.env.EMAIL_API_TIMEOUT_MS || 15000),
    }
  )

  return data?.id || true
}

const sendMail = async ({ to, subject, text, html }) => {
  if (isResendConfigured()) {
    await sendWithResend({ to, subject, text, html })
    return true
  }

  const transport = getTransporter()
  if (!transport) {
    console.warn('Email skipped: no email provider configured (set RESEND_API_KEY + EMAIL_FROM, or SMTP_* + EMAIL_FROM)')
    return false
  }

  await transport.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
    replyTo: process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM,
  })
  return true
}

async function buildOrdersCtaUrl(user, order) {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '')
  const fallback = `${clientUrl}/orders`

  if (!user?._id) return fallback

  try {
    return await createEmailLoginUrl({
      userId: user._id,
      orderId: order._id,
      redirect: '/orders',
    })
  } catch (err) {
    console.warn(`Email login URL failed for order ${order._id}; using plain /orders link:`, err.message)
    return fallback
  }
}

const sendOrderConfirmation = async (order, user) => {
  if (!user?.email) {
    console.warn('Order confirmation email skipped: no user email')
    return false
  }

  if (!isEmailConfigured()) {
    console.warn(
      `Order confirmation email skipped for ${order._id}: email provider not configured (RESEND_API_KEY+EMAIL_FROM or SMTP_*+EMAIL_FROM)`
    )
    return false
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  const ordersUrl = await buildOrdersCtaUrl(user, order)
  const { subject, text, html } = buildOrderConfirmationEmail({
    order,
    userName: user.name || 'Customer',
    clientUrl,
    ordersUrl,
  })

  try {
    const sent = await sendMail({ to: user.email, subject, text, html })
    if (!sent) return false
    console.log(`📧 Order confirmation sent to ${user.email} for order ${order._id}`)
    return true
  } catch (err) {
    console.error('Order confirmation email failed:', formatProviderError(err))
    return false
  }
}

const sendOrderShipped = async (order, user) => {
  if (!user?.email) return false

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  const { subject, text, html } = buildOrderShippedEmail({
    order,
    userName: user.name || 'Customer',
    clientUrl,
  })

  try {
    const sent = await sendMail({ to: user.email, subject, text, html })
    if (!sent) return false
    console.log(`📧 Shipped notification sent to ${user.email} for order ${order._id}`)
    return true
  } catch (err) {
    console.error('Shipped email failed:', formatProviderError(err))
    return false
  }
}

const sendNewOrderNotification = async (order, user) => {
  const to = process.env.NEW_ORDER_NOTIFY_EMAIL || 'info@evolvepharmacy.com'
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  const { subject, text, html } = buildNewOrderNotificationEmail({ order, user, clientUrl })

  try {
    const sent = await sendMail({ to, subject, text, html })
    if (!sent) return false
    console.log(`📧 New order notification sent to ${to} for order ${order._id}`)
    return true
  } catch (err) {
    console.error('New order notification email failed:', formatProviderError(err))
    return false
  }
}

const sendContactMessage = async (payload) => {
  const to = process.env.CONTACT_NOTIFY_EMAIL || process.env.NEW_ORDER_NOTIFY_EMAIL || 'info@evolvepharmacy.com'
  const { subject, text, html } = buildContactMessageEmail(payload)

  try {
    const sent = await sendMail({ to, subject, text, html })
    if (!sent) return false
    console.log(`📧 Contact form message sent to ${to} from ${payload.email}`)
    return true
  } catch (err) {
    console.error('Contact form email failed:', formatProviderError(err))
    return false
  }
}

function logEmailStartupStatus() {
  if (isResendConfigured()) {
    console.log(`Email: Resend configured (from ${process.env.EMAIL_FROM})`)
    return
  }
  if (isSmtpConfigured()) {
    console.log(
      `Email: SMTP configured (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}) — note DigitalOcean often blocks outbound SMTP; prefer Resend`
    )
    return
  }
  console.warn(
    'Email: NOT configured — order confirmations will not send. Set RESEND_API_KEY + EMAIL_FROM (recommended) or SMTP_* + EMAIL_FROM'
  )
}

module.exports = {
  isEmailConfigured,
  sendContactMessage,
  sendOrderConfirmation,
  sendNewOrderNotification,
  sendOrderShipped,
  logEmailStartupStatus,
}
