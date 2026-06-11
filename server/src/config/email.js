const nodemailer = require('nodemailer')

let transporter = null

const isResendConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)

const isSmtpConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.EMAIL_FROM
  )

const isEmailConfigured = () =>
  isResendConfigured() || isSmtpConfigured()

const getTransporter = () => {
  if (!isSmtpConfigured()) return null
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587)
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }
  return transporter
}

module.exports = { getTransporter, isEmailConfigured, isResendConfigured, isSmtpConfigured }
