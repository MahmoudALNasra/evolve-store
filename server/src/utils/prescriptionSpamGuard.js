const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Reject obvious bot spam on public refill/transfer forms.
 * Returns { ok: true } or { ok: false, message, code }.
 */
function validatePrescriptionSubmission(body = {}) {
  // Honeypot — real users never see/fill this field
  const honey = String(body.website || body.company || body._gotcha || '').trim()
  if (honey) {
    return { ok: false, silent: true, message: 'Rejected', code: 'honeypot' }
  }

  const patientName = String(body.patientName || '').trim()
  const phone = String(body.phone || '').trim()
  const email = String(body.email || '').trim().toLowerCase()

  if (!patientName || patientName.length < 2) {
    return { ok: false, message: 'Patient name is required', code: 'name' }
  }

  // Spam pattern: long single-token gibberish with mixed case, no spaces
  // e.g. "aczjkrzZLSTmEamCV", "alosxhVEQWHfYYaGHPjOZ"
  if (looksLikeBotName(patientName)) {
    return { ok: false, silent: true, message: 'Rejected', code: 'bot_name' }
  }

  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: 'Valid email address is required', code: 'email' }
  }

  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) {
    return { ok: false, message: 'Enter a valid phone number', code: 'phone' }
  }

  // Form filled impossibly fast (< 2.5s) — typical of bots
  const openedAt = Number(body.formOpenedAt)
  if (Number.isFinite(openedAt) && openedAt > 0) {
    const elapsed = Date.now() - openedAt
    if (elapsed >= 0 && elapsed < 2500) {
      return { ok: false, silent: true, message: 'Rejected', code: 'too_fast' }
    }
  }

  return { ok: true }
}

function looksLikeBotName(name) {
  const n = String(name || '').trim()
  if (!n) return true

  // No whitespace, long, mixed upper+lower → classic random token spam
  if (!/\s/.test(n) && n.length >= 12 && /[a-z]/.test(n) && /[A-Z]/.test(n)) {
    return true
  }

  // Long run of letters with no space (even same case)
  if (!/\s/.test(n) && n.length >= 22 && /^[A-Za-z]+$/.test(n)) {
    return true
  }

  // Many digits in a "name"
  if ((n.match(/\d/g) || []).length >= 4) return true

  return false
}

module.exports = { validatePrescriptionSubmission, looksLikeBotName }
