import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ShoppingCart, ArrowLeft } from 'lucide-react'
import api from '../lib/api'
import useCartStore from '../store/useCartStore'
import { formatPrice } from '../lib/utils'
import { pushAddToCart, pushViewItem } from '../lib/gtm'
import { getProductMetaDescription } from '../lib/productSeo'
import ProductSEO from '../components/ProductSEO'
import ProductGallery from '../components/product/ProductGallery'
import FulfillmentBlock from '../components/product/FulfillmentBlock'
import RelatedSearchChips from '../components/product/RelatedSearchChips'
import ProductReviews, { ProductReviewLink } from '../components/product/ProductReviews'
import RelatedProducts from '../components/RelatedProducts'
import toast from 'react-hot-toast'

function getCategoryShopPath(category) {
  return `/shop?category=${encodeURIComponent(category)}`
}

export default function ProductPage() {
  const { slug } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const addItem = useCartStore((s) => s.addItem)
  const viewItemFired = useRef(null)

  useEffect(() => {
    api.get(`/products/${slug}`)
      .then(({ data }) => setProduct(data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [slug])

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
  const images = (product.images?.length ? product.images : [{ url: '' }]).filter((img) => img.url)
  const speakableSummary = getProductMetaDescription(product)

  const handleAdd = () => {
    if (isOutOfStock) return toast.error('Out of stock')
    pushAddToCart(product, qty)
    addItem(product, qty)
    toast.success(`${product.name} added to cart`)
  }

  const breadcrumbItems = [
    { label: 'Shop', to: '/shop' },
    ...(product.category
      ? [{ label: product.category, to: getCategoryShopPath(product.category) }]
      : []),
    { label: product.name, to: null },
  ]

  return (
    <>
      <ProductSEO product={product} />

      <article className="product-page" aria-labelledby="product-title">
        <nav className="product-breadcrumb" aria-label="Breadcrumb">
          <ol className="product-breadcrumb-list">
            <li>
              <Link to="/">Home</Link>
              <span className="product-breadcrumb-sep" aria-hidden="true"> / </span>
            </li>
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
          <ProductGallery product={product} images={images} />

          <section className="product-details" aria-labelledby="product-title">
            <header className="product-details-header">
              {product.category && (
                <Link
                  to={getCategoryShopPath(product.category)}
                  className="product-details-cat"
                  aria-label={`Browse ${product.category} products`}
                >
                  {product.category}
                </Link>
              )}
              <h1 id="product-title" className="product-details-name">{product.name}</h1>

              <ProductReviewLink product={product} />
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

              <div className="product-meta-row">
                {product.sku && (
                  <p className="product-details-sku">
                    <span className="sr-only">SKU: </span>
                    SKU: {product.sku}
                  </p>
                )}
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
              </div>
            </section>

            {speakableSummary && (
              <p id="product-speakable-summary" className="product-speakable-summary">
                {speakableSummary}
              </p>
            )}

            <FulfillmentBlock />

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
                  <button type="button" className="btn-add-to-cart-lg" onClick={handleAdd}>
                    <ShoppingCart size={18} aria-hidden="true" /> Add to Cart
                  </button>
                </div>
              </section>
            )}

            {product.description && (
              <div className="product-detail-panel">
                <section aria-labelledby="product-description-heading">
                  <h2 id="product-description-heading" className="product-section-heading">Description</h2>
                  <p className="product-details-desc">{product.description}</p>
                </section>

                {product.seoFaqs?.length > 0 && (
                  <section aria-labelledby="product-faq-heading">
                    <h2 id="product-faq-heading" className="product-section-heading">Common Questions</h2>
                    <div className="product-faq-list">
                      {product.seoFaqs.map((faq) => (
                        <article key={faq.question} className="product-faq-item">
                          <h3>{faq.question}</h3>
                          <p>{faq.answer}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            <RelatedSearchChips product={product} />
          </section>
        </div>

        <ProductReviews slug={product.slug || slug} product={product} />
        <RelatedProducts slug={product.slug || slug} />
      </article>
    </>
  )
}
