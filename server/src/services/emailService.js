const { getTransporter, isEmailConfigured } = require('../config/email')
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

const sendMail = async ({ to, subject, text, html }) => {
  const transport = getTransporter()
  if (!transport) {
    console.warn('Email skipped: SMTP not configured (set SMTP_* and EMAIL_FROM in .env)')
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

const sendOrderConfirmation = async (order, user) => {
  if (!user?.email) {
    console.warn('Order confirmation email skipped: no user email')
    return false
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  const ordersUrl = await createEmailLoginUrl({
    userId: user._id,
    orderId: order._id,
    redirect: '/orders',
  })
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
    console.error('Order confirmation email failed:', err.message)
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
    console.error('Shipped email failed:', err.message)
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
    console.error('New order notification email failed:', err.message)
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
    console.error('Contact form email failed:', err.message)
    return false
  }
}

module.exports = {
  isEmailConfigured,
  sendContactMessage,
  sendOrderConfirmation,
  sendNewOrderNotification,
  sendOrderShipped,
}
