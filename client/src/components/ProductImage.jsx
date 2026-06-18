import {
  buildCloudinaryUrl,
  buildSrcSet,
  IMAGE_PRESETS,
  resolveProductImageUrl,
} from '../lib/cloudinaryImage'

/**
 * Responsive product image with Cloudinary f_auto/q_auto and <picture> + srcSet.
 * @param {object} props
 * @param {string} [props.src]
 * @param {Array} [props.images] - product.images
 * @param {string} props.alt - product name (required for SEO)
 * @param {'card'|'galleryMain'|'galleryThumb'|'cart'|'checkout'|'thumb'|'order'|'orderRow'} [props.variant]
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
  const crop = preset.crop

  const defaultSrc = buildCloudinaryUrl(rawUrl, {
    width: preset.defaultWidth,
    height: height || undefined,
    crop,
  })

  const imgSrcSet = buildSrcSet(rawUrl, preset.widths, { crop, height: height || undefined })
  const imgLoading = priority ? 'eager' : (loading ?? 'lazy')

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
      <img
        src={defaultSrc}
        srcSet={imgSrcSet || undefined}
        sizes={preset.sizes}
        alt={alt || ''}
        className={className || undefined}
        style={style}
        width={width}
        height={height}
        loading={imgLoading}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
        onError={onError}
      />
    </picture>
  )
}
