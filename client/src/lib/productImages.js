const PLACEHOLDER_PATTERNS = [
  /placehold\.co/i,
  /placeholder/i,
  /logo\.png/i,
  /\/logo\.(png|jpg|jpeg|webp|gif)$/i,
  /brand-logo/i,
  /favicon/i,
]

export function isPlaceholderImageUrl(url) {
  if (!url) return true
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(String(url).trim()))
}

export function filterProductImages(images = []) {
  return images.filter((img) => img?.url && !isPlaceholderImageUrl(img.url))
}
