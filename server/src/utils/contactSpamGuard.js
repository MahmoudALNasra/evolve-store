const { looksLikeBotName, looksLikeSpamEmail, looksLikeTokenBlob } = require('./spamPatterns')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Reject obvious bot spam on the public contact form.
 * Returns { ok: true } or { ok: false, silent?, message, code }.
 */
function validateContactSubmission(body = {}) {
  const honey = String(body.website || body.company || body._gotcha || '').trim()
  if (honey) {
    return { ok: false, silent: true, message: 'Rejected', code: 'honeypot' }
  }

  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const phone = String(body.phone || '').trim()
  const subject = String(body.subject || '').trim()
  const message = String(body.message || '').trim()

  if (!name || name.length < 2) {
    return { ok: false, message: 'Name is required', code: 'name' }
  }
  if (looksLikeBotName(name) || looksLikeBotName(subject)) {
    return { ok: false, silent: true, message: 'Rejected', code: 'bot_text' }
  }
  if (looksLikeSpamEmail(email)) {
    return { ok: false, silent: true, message: 'Rejected', code: 'bot_email' }
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: 'Valid email address is required', code: 'email' }
  }

  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) {
    return { ok: false, message: 'Enter a valid phone number', code: 'phone' }
  }
  if (!subject) {
    return { ok: false, message: 'Subject is required', code: 'subject' }
  }

  if (looksLikeTokenBlob(message) && message.length >= 8 && message.length <= 40) {
    return { ok: false, silent: true, message: 'Rejected', code: 'bot_message' }
  }

  const openedAt = Number(body.formOpenedAt)
  if (Number.isFinite(openedAt) && openedAt > 0) {
    const elapsed = Date.now() - openedAt
    if (elapsed >= 0 && elapsed < 2500) {
      return { ok: false, silent: true, message: 'Rejected', code: 'too_fast' }
    }
  }

  return { ok: true }
}

module.exports = { validateContactSubmission }
