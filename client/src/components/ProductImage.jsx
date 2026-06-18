import { useEffect, useState } from 'react'
import {
  buildCloudinaryUrl,
  buildSrcSet,
  IMAGE_PRESETS,
  isCloudinaryUrl,
  resolveProductImageUrl,
} from '../lib/cloudinaryImage'

const FALLBACK_SRC = '/logo.png'

/**
 * Responsive product image with Cloudinary transforms when applicable.
 * External inventory URLs use a single src + no-referrer to avoid hotlink blocks.
 */
export default function ProductImage({
  src,
  images,
  alt,
  variant = 'card',
  className = '',
  pictureClassName = '',
  width,
  height,
  priority = false,
  loading,
  style,
  onError,
}) {
  const preset = IMAGE_PRESETS[variant] || IMAGE_PRESETS.card
  const rawUrl = resolveProductImageUrl(src, images)
  const useCloudinary = isCloudinaryUrl(rawUrl)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [rawUrl])

  const handleError = (event) => {
    if (!failed) {
      setFailed(true)
      onError?.(event)
    }
  }

  const crop = preset.crop
  const imgLoading = priority ? 'eager' : (loading ?? 'lazy')
  const displayUrl = failed
    ? FALLBACK_SRC
    : useCloudinary
      ? buildCloudinaryUrl(rawUrl, {
          width: preset.defaultWidth,
          height: height || undefined,
          crop,
        })
      : rawUrl

  const imgSrcSet =
    !failed && useCloudinary
      ? buildSrcSet(rawUrl, preset.widths, { crop, height: height || undefined })
      : undefined

  const img = (
    <img
      src={displayUrl}
      srcSet={imgSrcSet}
      sizes={useCloudinary ? preset.sizes : undefined}
      alt={failed ? '' : alt || ''}
      className={className || undefined}
      style={style}
      width={width}
      height={height}
      loading={imgLoading}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  )

  if (!useCloudinary || failed) {
    return (
      <picture className={pictureClassName || undefined}>
        {img}
      </picture>
    )
  }

  return (
    <picture className={pictureClassName || undefined}>
      {preset.sources?.map(({ media, widths }) => {
        const sourceSrcSet = buildSrcSet(rawUrl, widths, { crop })
        if (!sourceSrcSet) return null
        return (
          <source
            key={media}
            media={media}
            srcSet={sourceSrcSet}
            sizes={preset.sizes}
          />
        )
      })}
      {img}
    </picture>
  )
}
