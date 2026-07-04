const PLACEHOLDER_PATTERNS = [
  /placehold\.co/i,
  /placeholder/i,
  /no\+image/i,
  /no-image/i,
  /logo\.png/i,
  /\/logo\.png$/i,
  /\/logo\.(jpg|jpeg|webp|gif)$/i,
  /brand-logo/i,
  /favicon/i,
  /1x1\.(png|gif)/i,
  /spacer\.(gif|png)/i,
]

function isPlaceholderImageUrl(url) {
  if (!url) return true
  const value = String(url).trim()
  if (!value) return true
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))
}

module.exports = {
  PLACEHOLDER_PATTERNS,
  isPlaceholderImageUrl,
}
