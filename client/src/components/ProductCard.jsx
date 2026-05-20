import { Link } from 'react-router-dom'
import { ShoppingCart, Star } from 'lucide-react'
import { formatPrice, getImageUrl } from '../lib/utils'
import useCartStore from '../store/useCartStore'
import toast from 'react-hot-toast'

export default function ProductCard({ product }) {
  const addItem = useCartStore((s) => s.addItem)
  const discount = product.comparePrice > product.price
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (product.stock === 0) return toast.error('Out of stock')
    addItem(product, 1)
    toast.success(`${product.name} added to cart`)
  }

  return (
    <Link to={`/product/${product._id}`} className="product-card">
      <div className="product-card-img-wrap">
        <img src={getImageUrl(product.images)} alt={product.name} />
        {discount > 0 && <span className="product-badge product-badge-sale">-{discount}%</span>}
        {product.isFeatured && discount === 0 && <span className="product-badge product-badge-best">Best Seller</span>}
        {product.stock === 0 && (
          <div className="product-badge-outofstock"><span>Out of Stock</span></div>
        )}
      </div>

      <div className="product-card-body">
        {product.category && <span className="product-card-category">{product.category}</span>}
        <h3 className="product-card-name">{product.name}</h3>

        {product.rating > 0 && (
          <div className="product-card-stars">
            <div className="product-card-stars-row">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} size={11} style={{ fill: s <= Math.round(product.rating) ? '#f59e0b' : '#e5e7eb', color: s <= Math.round(product.rating) ? '#f59e0b' : '#e5e7eb' }} />
              ))}
            </div>
            <span className="product-card-stars-count">({product.numReviews})</span>
          </div>
        )}

        <div className="product-card-price-row">
          <span className="product-card-price">{formatPrice(product.price)}</span>
          {discount > 0 && <span className="product-card-compare">{formatPrice(product.comparePrice)}</span>}
        </div>

        <button onClick={handleAddToCart} disabled={product.stock === 0} className="btn-add-cart">
          <ShoppingCart size={15} />
          Add to Cart
        </button>
      </div>
    </Link>
  )
}
