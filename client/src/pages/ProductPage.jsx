import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ShoppingCart, ArrowLeft, Star, Package } from 'lucide-react'
import api from '../lib/api'
import useCartStore from '../store/useCartStore'
import { formatPrice } from '../lib/utils'
import toast from 'react-hot-toast'

export default function ProductPage() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedImg, setSelectedImg] = useState(0)
  const [qty, setQty] = useState(1)
  const addItem = useCartStore((s) => s.addItem)

  useEffect(() => {
    api.get(`/products/${id}`)
      .then(({ data }) => { setProduct(data); setSelectedImg(0) })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>
  if (!product) return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <p style={{ color: '#9ca3af', fontSize: 16 }}>Product not found.</p>
      <Link to="/shop" className="product-page-back" style={{ marginTop: 12, display: 'inline-flex' }}>← Back to shop</Link>
    </div>
  )

  const discount = product.comparePrice > product.price
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0

  const handleAdd = () => {
    if (product.stock === 0) return toast.error('Out of stock')
    addItem(product, qty)
    toast.success(`${product.name} added to cart`)
  }

  const images = product.images?.length
    ? product.images
    : [{ url: 'https://placehold.co/600x600?text=No+Image' }]

  return (
    <div className="product-page">
      <Link to="/shop" className="product-page-back">
        <ArrowLeft size={15} /> Back to Shop
      </Link>

      <div className="product-page-grid">
        {/* Images */}
        <div>
          <div className="product-img-main">
            <img src={images[selectedImg]?.url} alt={product.name} />
          </div>
          {images.length > 1 && (
            <div className="product-img-thumbs">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImg(i)}
                  className={`product-img-thumb${selectedImg === i ? ' active' : ''}`}
                >
                  <img src={img.url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="product-details">
          {product.category && (
            <Link to={`/shop?category=${product.category}`} className="product-details-cat">
              {product.category}
            </Link>
          )}
          <h1 className="product-details-name">{product.name}</h1>

          {product.rating > 0 && (
            <div className="product-details-stars">
              <div className="product-details-stars-row">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={16} style={{ fill: s <= Math.round(product.rating) ? '#f59e0b' : '#e5e7eb', color: s <= Math.round(product.rating) ? '#f59e0b' : '#e5e7eb' }} />
                ))}
              </div>
              <span className="product-details-stars-text">{product.rating.toFixed(1)} ({product.numReviews} reviews)</span>
            </div>
          )}

          <div className="product-details-price">
            <span className="product-details-price-main">{formatPrice(product.price)}</span>
            {discount > 0 && (
              <>
                <span className="product-details-price-compare">{formatPrice(product.comparePrice)}</span>
                <span className="product-details-price-badge">-{discount}%</span>
              </>
            )}
          </div>

          <div className="product-details-stock">
            <Package size={15} className={product.stock > 0 ? 'stock-in' : 'stock-out'} />
            <span className={product.stock > 0 ? 'stock-in' : 'stock-out'}>
              {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
            </span>
          </div>

          {product.description && <p className="product-details-desc">{product.description}</p>}
          {product.sku && <p className="product-details-sku">SKU: {product.sku}</p>}

          {product.stock > 0 && (
            <div className="product-qty-row">
              <div className="qty-control-lg">
                <button className="qty-btn-lg" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span className="qty-value-lg">{qty}</span>
                <button className="qty-btn-lg" onClick={() => setQty((q) => Math.min(product.stock, q + 1))}>+</button>
              </div>
              <button className="btn-add-to-cart-lg" onClick={handleAdd}>
                <ShoppingCart size={18} /> Add to Cart
              </button>
            </div>
          )}

          {product.tags?.length > 0 && (
            <div className="product-tags">
              {product.tags.map((tag) => (
                <span key={tag} className="product-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
