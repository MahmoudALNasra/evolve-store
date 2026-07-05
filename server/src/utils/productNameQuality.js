const BAD_NAME_PATTERNS = [
  /seller\s*store\s*front/i,
  /amazon\.com/i,
  /products\s*360\s*@\s*amazon/i,
  /:\s*amazon/i,
  /walmart\.com/i,
  /ebay\.com/i,
  /^\.\.\./,
  /\|\s*amazon/i,
  /^\s*product\s+[A-Z0-9]{6,}\s*$/i,
]

function shouldFixProductName(name) {
  const value = String(name || '').trim()
  if (!value || value.length < 4) return true
  if (value.length > 140) return true
  if (BAD_NAME_PATTERNS.some((pattern) => pattern.test(value))) return true
  if (/\.{3}/.test(value)) return true
  return false
}

function normalizeProductName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\|\s*Amazon\.com.*$/i, '')
    .replace(/\s*:\s*Amazon\.com.*$/i, '')
    .replace(/\s*\.\.\.\s*$/, '')
    .trim()
    .slice(0, 180)
}

module.exports = {
  shouldFixProductName,
  normalizeProductName,
  BAD_NAME_PATTERNS,
}
