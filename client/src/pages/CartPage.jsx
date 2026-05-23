import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft } from 'lucide-react'
import useCartStore from '../store/useCartStore'
import useAuthStore from '../store/useAuthStore'
import {
  EXTENDED_FREE_SHIPPING_MAX_RATE,
  EXTENDED_FREE_SHIPPING_THRESHOLD,
  formatPrice,
  FREE_SHIPPING_MAX_RATE,
  FREE_SHIPPING_THRESHOLD,
  formatShippingRange,
  getShippingQuote,
} from '../lib/utils'
import ProductImage from '../components/ProductImage'
import { getProductPath } from '../lib/productSeo'
import { calculateSalesTax, formatSalesTaxRate } from '../lib/salesTax'
import api from '../lib/api'
import toast from 'react-hot-toast'
import Spinner from '../components/ui/Spinner'

export default function CartPage() {
  const { items, removeItem, updateQty, clearCart } = useCartStore()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const shippingQuote = getShippingQuote(subtotal)
  const tax = calculateSalesTax(subtotal)

  useEffect(() => {
    console.log('📄 CartPage loaded. Items in cart:', items)
    console.log('👤 User:', user)
    console.log('🔍 Cart store state:', useCartStore.getState())
    console.log('🔍 localStorage cart:', localStorage.getItem('estore-cart'))
    
    // If cart appears empty but localStorage has items, force rehydration
    if (items.length === 0) {
      const persistedCart = localStorage.getItem('estore-cart')
      if (persistedCart) {
        try {
          const parsed = JSON.parse(persistedCart)
          const storedItems = parsed.state?.items || []
          if (storedItems.length > 0) {
            console.warn('⚠️ Cart empty but localStorage has items! Forcing restore...')
            useCartStore.setState({ items: storedItems })
          }
        } catch (err) {
          console.error('Failed to restore cart from localStorage:', err)
        }
      }
    }
  }, [items, user])

  const handleCheckout = () => {
    console.log('🛒 Checkout clicked. User:', user, 'Items:', items)
    if (!user) {
      console.log('❌ Not logged in, redirecting to login')
      return navigate('/login?redirect=/checkout')
    }
    if (!items.length) return
    
    // Redirect to checkout page to collect shipping address
    navigate('/checkout')
  }

  if (items.length === 0) {
    return (
      <div className="cart-empty">
        <div className="cart-empty-inner">
          <div className="cart-empty-icon">
            <ShoppingBag size={44} strokeWidth={1.5} />
          </div>
          <h2>Your cart is empty</h2>
          <p>Looks like you haven't added anything yet. Start exploring our health products!</p>
          <Link to="/shop" className="btn-primary">
            <ShoppingBag size={17} /> Browse Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-inner">
          <Link to="/shop" className="page-back"><ArrowLeft size={15} /> Continue Shopping</Link>
          <h1 className="page-title">
            Shopping Cart <span>({items.length} item{items.length !== 1 ? 's' : ''})</span>
          </h1>
        </div>
      </div>

      <div className="cart-body">
        <div className="cart-items">
          {items.map((item) => (
            <div key={item._id} className="cart-item">
              <Link to={getProductPath(item)}>
                <ProductImage
                  images={item.images}
                  alt={item.name}
                  variant="cart"
                  className="cart-item-img"
                  width={72}
                  height={72}
                />
              </Link>
              <div className="cart-item-info">
                <div className="cart-item-top">
                  <div>
                    {item.category && <div className="cart-item-cat">{item.category}</div>}
                    <Link to={getProductPath(item)} className="cart-item-name">{item.name}</Link>
                  </div>
                  <button className="btn-remove" onClick={() => removeItem(item._id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="cart-item-bottom">
                  <div className="qty-control">
                    <button className="qty-btn" onClick={() => updateQty(item._id, item.quantity - 1)}>
                      <Minus size={13} />
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button className="qty-btn" onClick={() => updateQty(item._id, item.quantity + 1)}>
                      <Plus size={13} />
                    </button>
                  </div>
                  <div className="cart-item-price">
                    <div className="cart-item-price-total">{formatPrice(item.price * item.quantity)}</div>
                    <div className="cart-item-price-each">{formatPrice(item.price)} each</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <h2>Order Summary</h2>
          <div className="cart-summary-lines">
            {items.map((i) => (
              <div key={i._id} className="cart-summary-line">
                <span className="cart-summary-line-label trunc">{i.name} ×{i.quantity}</span>
                <span className="cart-summary-line-val">{formatPrice(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>

          <hr className="cart-summary-divider" />

          <div className="cart-summary-line">
            <span className="cart-summary-line-label">Subtotal</span>
            <span className="cart-summary-line-val">{formatPrice(subtotal)}</span>
          </div>
          <div className="cart-summary-line" style={{ marginTop: 8 }}>
            <span className="cart-summary-line-label">Shipping</span>
            <span className={`cart-summary-line-val${subtotal >= FREE_SHIPPING_THRESHOLD ? ' free' : ''}`}>
              {subtotal >= EXTENDED_FREE_SHIPPING_THRESHOLD
                ? `Free up to ${formatPrice(EXTENDED_FREE_SHIPPING_MAX_RATE)}`
                : subtotal >= FREE_SHIPPING_THRESHOLD
                  ? `Free up to ${formatPrice(FREE_SHIPPING_MAX_RATE)}`
                : formatShippingRange(shippingQuote, formatPrice)}
            </span>
          </div>
          <div className="cart-summary-line" style={{ marginTop: 8 }}>
            <span className="cart-summary-line-label">Sales Tax ({formatSalesTaxRate()})</span>
            <span className="cart-summary-line-val">{formatPrice(tax)}</span>
          </div>
          <div className="cart-free-shipping-note">
            Free shipping is based on product subtotal before tax and shipping: rates up to{' '}
            {formatPrice(FREE_SHIPPING_MAX_RATE)} are free at {formatPrice(FREE_SHIPPING_THRESHOLD)}+, and rates up
            to {formatPrice(EXTENDED_FREE_SHIPPING_MAX_RATE)} are free at{' '}
            {formatPrice(EXTENDED_FREE_SHIPPING_THRESHOLD)}+.
          </div>
          <div className="cart-free-shipping-note">
            Free pharmacy pickup is available at checkout.
          </div>
          {subtotal < FREE_SHIPPING_THRESHOLD && (
            <div className="cart-free-shipping-note">
              Add {formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} more for free shipping!
            </div>
          )}
          {subtotal >= FREE_SHIPPING_THRESHOLD && subtotal < EXTENDED_FREE_SHIPPING_THRESHOLD && (
            <div className="cart-free-shipping-note">
              Add {formatPrice(EXTENDED_FREE_SHIPPING_THRESHOLD - subtotal)} more to unlock free shipping up to{' '}
              {formatPrice(EXTENDED_FREE_SHIPPING_MAX_RATE)}.
            </div>
          )}

          <hr className="cart-summary-divider" />

          <div className="cart-summary-total">
            <span>Total</span>
            <span className="cart-summary-total-val">
              {formatPrice(subtotal + shippingQuote.amount + tax)}
            </span>
          </div>

          <button onClick={handleCheckout} disabled={loading} className="btn-checkout">
            {loading ? <div className="spinner spinner-sm" /> : 'Proceed to Checkout →'}
          </button>

          {!user && <p className="cart-guest-note">You'll be asked to sign in before checkout.</p>}

          <div className="cart-trust">
            <span>🔒 Secure checkout</span>
            <span>↩ 30-day returns</span>
          </div>
        </div>
      </div>
    </div>
  )
}
