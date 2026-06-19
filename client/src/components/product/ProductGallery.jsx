import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ProductImage from '../ProductImage'
import { getProductImageAlt } from '../../lib/seoUtils'
import { prefersReducedMotion } from '../../lib/animation'

const IMG_SIZE = 600

export default function ProductGallery({ product, images }) {
  const [selected, setSelected] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const reduceMotion = prefersReducedMotion()
  const hasMultiple = images.length > 1

  const toggleZoom = () => setZoomed((z) => !z)

  return (
    <section className="product-gallery product-gallery--side" aria-labelledby="product-gallery-heading">
      <h2 id="product-gallery-heading" className="sr-only">Product images</h2>

      <div className="product-gallery-layout">
        {hasMultiple && (
          <div className="product-img-thumbs product-img-thumbs--vertical" role="list">
            {images.map((img, i) => (
              <button
                key={img.url || i}
                type="button"
                role="listitem"
                onClick={() => setSelected(i)}
                className={`product-img-thumb${selected === i ? ' active' : ''}`}
                aria-label={`View image ${i + 1} of ${images.length}`}
                aria-pressed={selected === i}
              >
                <ProductImage
                  src={img.url}
                  alt={getProductImageAlt(product, i)}
                  variant="galleryThumb"
                  width={64}
                  height={64}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className={`product-img-main product-img-main--framed product-img-main--zoom${zoomed ? ' is-zoomed' : ''}`}
          onClick={toggleZoom}
          aria-label={zoomed ? 'Zoom out product image' : 'Zoom in product image'}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={images[selected]?.url || selected}
              className="product-img-main-inner"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              <ProductImage
                src={images[selected]?.url || images[0]?.url}
                alt={getProductImageAlt(product, selected)}
                variant="galleryMain"
                className="product-img-main-el"
                width={IMG_SIZE}
                height={IMG_SIZE}
                priority
              />
            </motion.div>
          </AnimatePresence>
        </button>
      </div>
    </section>
  )
}
