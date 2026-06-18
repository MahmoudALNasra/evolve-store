import { useEffect } from 'react'
import { X, Minus, Plus, Trash2, ShoppingBag, CreditCard } from 'lucide-react'
import { Link } from 'react-router-dom'
import useCartStore from '../store/useCartStore'
import { formatPrice } from '../lib/utils'
import ProductImage from './ProductImage'

export default function CartDrawer() {
  const { items, removeItem, updateQty, isCartOpen, closeCart } = useCartStore()
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const count = items.reduce((s, i) => s + i.quantity, 0)

  useEffect(() => {
    document.body.style.overflow = isCartOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isCartOpen])

  return (
    <>
      {isCartOpen && (
        <button
          type="button"
          aria-label="Close cart"
          onClick={closeCart}
          className="cart-drawer-overlay"
        />
      )}
      <aside
        aria-hidden={!isCartOpen}
        className={`cart-drawer${isCartOpen ? ' cart-drawer--open' : ''}`}
      >
        <div className="cart-drawer-header">
          <div>
            <h2 className="cart-drawer-title">Your Cart</h2>
            <p className="cart-drawer-count">{count} item{count !== 1 ? 's' : ''}</p>
          </div>
          <button type="button" onClick={closeCart} className="cart-drawer-close" aria-label="Close cart">
            <X size={22} />
          </button>
        </div>

        <div className="cart-drawer-body">
          {items.length === 0 ? (
            <div className="cart-drawer-empty">
              <ShoppingBag size={40} strokeWidth={1.25} className="cart-drawer-empty-icon" />
              <p>Your cart is empty</p>
              <Link to="/shop" onClick={closeCart} className="ev-btn ev-btn-primary cart-drawer-empty-cta">
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="cart-drawer-items">
              {items.map((item) => (
                <div key={item._id} className="cart-drawer-item">
                  <ProductImage
                    images={item.images}
                    alt={item.name}
                    variant="cart"
                    width={72}
                    height={72}
                    className="cart-drawer-item-img"
                  />
                  <div className="cart-drawer-item-details">
                    <p className="cart-drawer-item-name">{item.name}</p>
                    <p className="cart-drawer-item-price">{formatPrice(item.price)}</p>
                    <div className="cart-drawer-item-controls">
                      <button type="button" onClick={() => updateQty(item._id, item.quantity - 1)} className="cart-drawer-qty-btn" aria-label="Decrease quantity">
                        <Minus size={13} />
                      </button>
                      <span className="cart-drawer-qty-value">{item.quantity}</span>
                      <button type="button" onClick={() => updateQty(item._id, item.quantity + 1)} className="cart-drawer-qty-btn" aria-label="Increase quantity">
                        <Plus size={13} />
                      </button>
                      <span className="cart-drawer-item-subtotal">{formatPrice(item.price * item.quantity)}</span>
                      <button type="button" onClick={() => removeItem(item._id)} className="cart-drawer-remove" aria-label="Remove item">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="cart-drawer-subtotal-row">
              <span>Subtotal</span>
              <span className="cart-drawer-subtotal-value">{formatPrice(total)}</span>
            </div>
            <Link
              to="/checkout"
              onClick={closeCart}
              className="cart-drawer-checkout ev-btn ev-btn-primary"
            >
              <CreditCard size={18} aria-hidden="true" /> Checkout
            </Link>
            <Link to="/cart" onClick={closeCart} className="cart-drawer-view-full">
              View full cart
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
