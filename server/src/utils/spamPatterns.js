/**
 * Shared heuristics for public-form / signup spam bots.
 */

function looksLikeBotName(name) {
  const n = String(name || '').trim()
  if (!n) return true

  // No whitespace, long, mixed upper+lower → classic random token spam
  // e.g. "iIgWepFJPCakRdhJIxS", "VybMgXjVPdjOWqYMEBE"
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

function looksLikeSpamEmail(email) {
  const value = String(email || '').trim().toLowerCase()
  if (!value.includes('@')) return true
  const local = value.split('@')[0] || ''

  // e.g. in.o.t.ic.o.j.0.55@gmail.com — dotted single-letter spam
  const dottedParts = local.split('.')
  if (dottedParts.length >= 5 && dottedParts.filter((p) => p.length <= 2).length >= 4) {
    return true
  }

  // local part is a long mixed-case token with no real separator words
  if (
    !/[._+-]/.test(local)
    && local.length >= 16
    && /[a-z]/.test(local)
    && /[A-Z]/.test(String(email).split('@')[0] || '')
  ) {
    return true
  }

  return false
}

function looksLikeTokenBlob(text) {
  const value = String(text || '').trim()
  if (!value) return false
  if (/\s/.test(value)) return false
  return /[a-z]/.test(value) && /[A-Z]/.test(value) && /^[A-Za-z0-9]+$/.test(value)
}

module.exports = {
  looksLikeBotName,
  looksLikeSpamEmail,
  looksLikeTokenBlob,
}
