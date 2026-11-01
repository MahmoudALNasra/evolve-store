const { looksLikeBotName, looksLikeSpamEmail, looksLikeTokenBlob } = require('./spamPatterns')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Reject obvious bot spam on public refill/transfer forms.
 * Returns { ok: true } or { ok: false, message, code, silent? }.
 */
function validatePrescriptionSubmission(body = {}) {
  const honey = String(body.website || body.company || body._gotcha || '').trim()
  if (honey) {
    return { ok: false, silent: true, message: 'Rejected', code: 'honeypot' }
  }

  const patientName = String(body.patientName || '').trim()
  const phone = String(body.phone || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const medicationName = String(body.medicationName || '').trim()
  const pharmacyName = String(body.currentPharmacyName || '').trim()
  const notes = String(body.notes || '').trim()

  if (!patientName || patientName.length < 2) {
    return { ok: false, message: 'Patient name is required', code: 'name' }
  }

  if (looksLikeBotName(patientName)) {
    return { ok: false, silent: true, message: 'Rejected', code: 'bot_name' }
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

  if (medicationName && looksLikeBotName(medicationName)) {
    return { ok: false, silent: true, message: 'Rejected', code: 'bot_med' }
  }
  if (pharmacyName && looksLikeBotName(pharmacyName)) {
    return { ok: false, silent: true, message: 'Rejected', code: 'bot_pharmacy' }
  }
  if (notes && looksLikeTokenBlob(notes) && notes.length >= 8 && notes.length <= 40) {
    return { ok: false, silent: true, message: 'Rejected', code: 'bot_notes' }
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

module.exports = { validatePrescriptionSubmission, looksLikeBotName, looksLikeSpamEmail }
