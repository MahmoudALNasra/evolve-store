/**
 * Cloudinary delivery transforms for Core Web Vitals (f_auto, q_auto) + responsive widths.
 */

const UPLOAD_PATH = '/image/upload/'
const PLACEHOLDER = 'https://placehold.co/400x400?text=No+Image'

export function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes(UPLOAD_PATH)
}

function isTransformSegment(segment) {
  if (!segment || segment.includes('.')) return false
  if (/^v\d+$/.test(segment)) return false
  return (
    segment.includes(',') ||
    /^(f_auto|q_auto|w_|h_|c_|g_|ar_|dpr_|fl_)/.test(segment)
  )
}

/**
 * Insert or replace Cloudinary transforms after /image/upload/.
 */
export function buildCloudinaryUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return url
  if (!isCloudinaryUrl(url)) return url

  const { width, height, crop = 'limit' } = options
  const transforms = ['f_auto', 'q_auto']
  if (width) transforms.push(`w_${width}`)
  if (height) transforms.push(`h_${height}`)
  if (crop) transforms.push(`c_${crop}`)
  const transformStr = transforms.join(',')

  const uploadIdx = url.indexOf(UPLOAD_PATH) + UPLOAD_PATH.length
  const prefix = url.slice(0, uploadIdx)
  const afterUpload = url.slice(uploadIdx)

  const segments = afterUpload.split('/')
  let assetStart = 0
  while (assetStart < segments.length && isTransformSegment(segments[assetStart])) {
    assetStart += 1
  }
  const assetPath = segments.slice(assetStart).join('/')

  return `${prefix}${transformStr}/${assetPath}`
}

export function buildSrcSet(url, widths, options = {}) {
  if (!url) return undefined
  const uniqueWidths = [...new Set(widths)].filter(Boolean).sort((a, b) => a - b)
  if (!uniqueWidths.length) return undefined

  return uniqueWidths
    .map((w) => {
      const built = buildCloudinaryUrl(url, { ...options, width: w })
      return `${built} ${w}w`
    })
    .join(', ')
}

/** Responsive presets aligned to storefront breakpoints. */
export const IMAGE_PRESETS = {
  card: {
    widths: [320, 480, 640],
    defaultWidth: 640,
    crop: 'limit',
    sizes: '(max-width: 639px) 45vw, (max-width: 1023px) 33vw, 280px',
    sources: [
      { media: '(max-width: 639px)', widths: [280, 400] },
      { media: '(max-width: 1023px)', widths: [400, 560] },
    ],
  },
  galleryMain: {
    widths: [400, 600, 800, 1200],
    defaultWidth: 800,
    crop: 'limit',
    sizes: '(max-width: 768px) 100vw, min(50vw, 600px)',
    sources: [
      { media: '(max-width: 639px)', widths: [400, 600] },
      { media: '(max-width: 1023px)', widths: [600, 800] },
    ],
  },
  galleryThumb: {
    widths: [68, 136],
    defaultWidth: 136,
    crop: 'fill',
    sizes: '68px',
    sources: [],
  },
  cart: {
    widths: [72, 144],
    defaultWidth: 144,
    crop: 'limit',
    sizes: '72px',
    sources: [],
  },
  checkout: {
    widths: [60, 120],
    defaultWidth: 120,
    crop: 'limit',
    sizes: '60px',
    sources: [],
  },
  thumb: {
    widths: [48, 96],
    defaultWidth: 96,
    crop: 'limit',
    sizes: '48px',
    sources: [],
  },
  order: {
    widths: [80, 160],
    defaultWidth: 160,
    crop: 'limit',
    sizes: '80px',
    sources: [],
  },
  orderRow: {
    widths: [44, 88],
    defaultWidth: 88,
    crop: 'limit',
    sizes: '44px',
    sources: [],
  },
}

export function resolveProductImageUrl(src, images) {
  if (src) return normalizeImageUrl(src)
  if (images?.length > 0 && images[0]?.url) return normalizeImageUrl(images[0].url)
  return PLACEHOLDER
}

function getMediaOrigin() {
  const api = import.meta.env.VITE_API_URL
  if (api) return api.replace(/\/api\/?$/, '')
  const site = import.meta.env.VITE_SITE_URL
  if (site) return site.replace(/\/$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return PLACEHOLDER
  const trimmed = url.trim()
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (trimmed.startsWith('/media/')) {
    const origin = getMediaOrigin()
    return origin ? `${origin}${trimmed}` : trimmed
  }
  return trimmed
}

export function getOptimizedImageUrl(src, images, width = 400) {
  const raw = resolveProductImageUrl(src, images)
  return buildCloudinaryUrl(raw, { width, crop: 'limit' })
}
