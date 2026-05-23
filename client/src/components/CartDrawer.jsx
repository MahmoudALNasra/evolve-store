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
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.42)',
            border: 0,
            zIndex: 80,
            cursor: 'default',
          }}
        />
      )}
      <aside
        aria-hidden={!isCartOpen}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 'min(430px, 100vw)',
          height: '100vh',
          background: '#fff',
          boxShadow: '-20px 0 50px rgba(17, 24, 39, 0.22)',
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          transform: isCartOpen ? 'translateX(0)' : 'translateX(105%)',
          transition: 'transform 260ms ease',
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #e8eee8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1a1a1a', marginBottom: 2 }}>Shopping Cart</h2>
            <p style={{ fontSize: 13, color: '#6b7280' }}>{count} item{count !== 1 ? 's' : ''} in your cart</p>
          </div>
          <button
            onClick={closeCart}
            style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', display: 'grid', placeItems: 'center', color: '#6b7280', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {items.length === 0 ? (
            <div style={{ height: '100%', minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#9ca3af', textAlign: 'center' }}>
              <ShoppingBag size={48} strokeWidth={1} />
              <p style={{ fontSize: 14 }}>Your cart is empty</p>
              <Link to="/shop" onClick={closeCart} className="btn-primary" style={{ textDecoration: 'none' }}>
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {items.map((item) => (
                <div key={item._id} style={{ display: 'flex', gap: 12, paddingBottom: 16, borderBottom: '1px solid #f0f2f0' }}>
                  <ProductImage
                    images={item.images}
                    alt={item.name}
                    variant="cart"
                    width={72}
                    height={72}
                    style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', border: '1px solid #e8eee8', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', marginBottom: 4, lineHeight: 1.35 }}>{item.name}</p>
                    <p style={{ fontSize: 13, color: '#2d7a3a', fontWeight: 800 }}>{formatPrice(item.price)}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => updateQty(item._id, item.quantity - 1)}
                        style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', display: 'grid', placeItems: 'center', color: '#4b5563', cursor: 'pointer' }}
                      >
                        <Minus size={13} />
                      </button>
                      <span style={{ fontSize: 14, fontWeight: 700, width: 22, textAlign: 'center' }}>{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item._id, item.quantity + 1)}
                        style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', display: 'grid', placeItems: 'center', color: '#4b5563', cursor: 'pointer' }}
                      >
                        <Plus size={13} />
                      </button>
                      <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: '#1c2b1c' }}>{formatPrice(item.price * item.quantity)}</span>
                      <button
                        onClick={() => removeItem(item._id)}
                        style={{ width: 30, height: 30, borderRadius: 9, border: 0, background: '#fef2f2', display: 'grid', placeItems: 'center', color: '#dc2626', cursor: 'pointer' }}
                      >
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
          <div style={{ padding: 20, borderTop: '1px solid #e8eee8', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: '#6b7280' }}>Subtotal</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>{formatPrice(total)}</span>
            </div>
            <Link
              to="/checkout"
              onClick={closeCart}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', marginBottom: 10 }}
            >
              <CreditCard size={18} /> Checkout Now
            </Link>
            <Link
              to="/cart"
              onClick={closeCart}
              style={{ display: 'block', textAlign: 'center', color: '#2d7a3a', fontSize: 13, fontWeight: 700, textDecoration: 'none', padding: '8px 0' }}
            >
              View full cart
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
