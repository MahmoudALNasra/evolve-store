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

// Must stay <= the shouldFixProductName length ceiling (140) so a normalized
// name never re-triggers a "bad title" and loops the optimizer forever.
const MAX_NAME_LENGTH = 120

function normalizeProductName(name) {
  const cleaned = String(name || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\|\s*Amazon\.com.*$/i, '')
    .replace(/\s*:\s*Amazon\.com.*$/i, '')
    .replace(/\s*\.\.\.\s*$/, '')
    .trim()

  if (cleaned.length <= MAX_NAME_LENGTH) return cleaned

  const slice = cleaned.slice(0, MAX_NAME_LENGTH)
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > MAX_NAME_LENGTH * 0.5 ? slice.slice(0, lastSpace) : slice).trim()
}

module.exports = {
  shouldFixProductName,
  normalizeProductName,
  MAX_NAME_LENGTH,
  BAD_NAME_PATTERNS,
}
