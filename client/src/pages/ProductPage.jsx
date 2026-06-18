import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ShoppingCart, ArrowLeft, Star } from 'lucide-react'
import api from '../lib/api'
import useCartStore from '../store/useCartStore'
import { formatPrice } from '../lib/utils'
import { pushAddToCart, pushViewItem } from '../lib/gtm'
import { getProductImages } from '../lib/productSeo'
import ProductImage from '../components/ProductImage'
import ProductSEO from '../components/ProductSEO'
import RelatedProducts from '../components/RelatedProducts'
import toast from 'react-hot-toast'

/** LCP / gallery dimensions (1:1 layout in CSS) — reduces CLS */
const IMG_SIZE = 600

export default function ProductPage() {
  const { slug } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedImg, setSelectedImg] = useState(0)
  const [qty, setQty] = useState(1)
  const [mainImgError, setMainImgError] = useState(false)
  const addItem = useCartStore((s) => s.addItem)
  const viewItemFired = useRef(null)

  useEffect(() => {
    api.get(`/products/${slug}`)
      .then(({ data }) => { setProduct(data); setSelectedImg(0); setMainImgError(false) })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [slug])

  /* GA4 view_item — fires once per product when data is ready (GTM dataLayer) */
  useEffect(() => {
    if (!product?._id || viewItemFired.current === product._id) return
    viewItemFired.current = product._id
    pushViewItem(product, 1)
  }, [product])

  if (loading) {
    return (
      <div className="spinner-wrap" role="status" aria-live="polite" aria-label="Loading product">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <p style={{ color: '#9ca3af', fontSize: 16 }}>Product not found.</p>
        <Link to="/shop" className="product-page-back" style={{ marginTop: 12, display: 'inline-flex' }}>
          ← Back to shop
        </Link>
      </div>
    )
  }

  const discount = product.comparePrice > product.price
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0
  const stock = Number(product.stock) || 0
  const isOutOfStock = stock <= 0

  const images = getProductImages(product).map((url) => ({ url }))

  /** GA4 add_to_cart — same items[] structure as view_item; call before cart update */
  const handleAdd = () => {
    if (isOutOfStock) return toast.error('Out of stock')
    pushAddToCart(product, qty)
    addItem(product, qty)
    toast.success(`${product.name} added to cart`)
  }

  const breadcrumbItems = [
    { label: 'Shop', to: '/shop' },
    ...(product.category
      ? [{ label: product.category, to: `/shop?category=${encodeURIComponent(product.category)}` }]
      : []),
    { label: product.name, to: null },
  ]

  return (
    <>
      {/* On-page SEO: title, meta, OG, Twitter, JSON-LD (Product + BreadcrumbList) */}
      <ProductSEO product={product} />

      <article className="product-page" aria-labelledby="product-title">
        <nav className="product-breadcrumb" aria-label="Breadcrumb">
          <ol className="product-breadcrumb-list">
            {breadcrumbItems.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`}>
                {crumb.to ? (
                  <>
                    <Link to={crumb.to}>{crumb.label}</Link>
                    <span className="product-breadcrumb-sep" aria-hidden="true"> / </span>
                  </>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <Link to="/shop" className="product-page-back">
          <ArrowLeft size={15} aria-hidden="true" /> Back to Shop
        </Link>

        <div className="product-page-grid">
          {/* Product images — LCP: fetchpriority=high; thumbs: lazy + dimensions for CLS */}
          <section className="product-gallery" aria-labelledby="product-gallery-heading">
            <h2 id="product-gallery-heading" className="sr-only">Product images</h2>
            <div className="product-img-main product-img-main--framed">
              {mainImgError ? (
                <div className="product-img-fallback" role="img" aria-label={product.name}>
                  <img src="/logo.png" alt="" className="product-img-fallback-logo" />
                </div>
              ) : (
                <ProductImage
                  src={images[selectedImg]?.url || images[0]?.url}
                  alt={`${product.name} — main product image`}
                  variant="galleryMain"
                  className="product-img-main-el"
                  width={IMG_SIZE}
                  height={IMG_SIZE}
                  priority
                  onError={() => setMainImgError(true)}
                />
              )}
            </div>
            {images.length > 1 && (
              <div className="product-img-thumbs" role="list">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    role="listitem"
                    onClick={() => setSelectedImg(i)}
                    className={`product-img-thumb${selectedImg === i ? ' active' : ''}`}
                    aria-label={`View image ${i + 1} of ${images.length}`}
                    aria-pressed={selectedImg === i}
                  >
                    <ProductImage
                      src={img.url}
                      alt={`${product.name} — view ${i + 1}`}
                      variant="galleryThumb"
                      width={68}
                      height={68}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="product-details" aria-labelledby="product-title">
            <header className="product-details-header">
              {product.category && (
                <Link to={`/shop?category=${product.category}`} className="product-details-cat">
                  {product.category}
                </Link>
              )}
              <h1 id="product-title" className="product-details-name">{product.name}</h1>

              {product.rating > 0 && (
                <div className="product-details-stars" aria-label={`Rated ${product.rating.toFixed(1)} out of 5`}>
                  <div className="product-details-stars-row" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={16}
                        style={{
                          fill: s <= Math.round(product.rating) ? '#C9A84C' : 'rgba(255,255,255,0.15)',
                          color: s <= Math.round(product.rating) ? '#C9A84C' : 'rgba(255,255,255,0.15)',
                        }}
                      />
                    ))}
                  </div>
                  <span className="product-details-stars-text">
                    {product.rating.toFixed(1)} ({product.numReviews} reviews)
                  </span>
                </div>
              )}
            </header>

            <section aria-labelledby="product-pricing-heading">
              <h2 id="product-pricing-heading" className="sr-only">Pricing and availability</h2>
              <div className="product-details-price">
                <span className="product-details-price-main">{formatPrice(product.price)}</span>
                {discount > 0 && (
                  <>
                    <span className="product-details-price-compare">{formatPrice(product.comparePrice)}</span>
                    <span className="product-details-price-badge">-{discount}%</span>
                  </>
                )}
              </div>

              <div className="product-stock-indicator">
                {!isOutOfStock ? (
                  <>
                    <span className="product-stock-dot product-stock-dot--in" aria-hidden="true" />
                    <span>In Stock</span>
                  </>
                ) : (
                  <>
                    <span className="product-stock-dot product-stock-dot--out" aria-hidden="true" />
                    <Link to="/contact" className="product-stock-notify">Notify Me</Link>
                  </>
                )}
              </div>
            </section>

            <div className="product-detail-panel">
            {product.description && (
              <section aria-labelledby="product-description-heading">
                <h2 id="product-description-heading" className="product-section-heading">Description</h2>
                <p className="product-details-desc">{product.description}</p>
              </section>
            )}
            </div>

            {product.sku && (
              <p className="product-details-sku">
                <span className="sr-only">SKU: </span>
                SKU: {product.sku}
              </p>
            )}

            {!isOutOfStock && (
              <section aria-labelledby="product-purchase-heading">
                <h2 id="product-purchase-heading" className="sr-only">Add to cart</h2>
                <div className="product-qty-row">
                  <div className="qty-control-lg">
                    <button
                      type="button"
                      className="qty-btn-lg"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="qty-value-lg" aria-live="polite">{qty}</span>
                    <button
                      type="button"
                      className="qty-btn-lg"
                      onClick={() => setQty((q) => Math.min(stock, q + 1))}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  {/* add_to_cart: pushAddToCart() in handleAdd — GTM/GA4 ecommerce */}
                  <button type="button" className="btn-add-to-cart-lg" onClick={handleAdd}>
                    <ShoppingCart size={18} aria-hidden="true" /> Add to Cart
                  </button>
                </div>
              </section>
            )}

            {product.tags?.length > 0 && (
              <section aria-labelledby="product-tags-heading">
                <h2 id="product-tags-heading" className="sr-only">Product tags</h2>
                <div className="product-tags">
                  {product.tags.map((tag) => (
                    <span key={tag} className="product-tag">{tag}</span>
                  ))}
                </div>
              </section>
            )}
          </section>
        </div>

        <RelatedProducts slug={product.slug || slug} />
      </article>
    </>
  )
}
