import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import useCartStore from '../store/useCartStore'
import { formatPrice, getImageUrl } from '../lib/utils'

export default function CartDrawer({ open, onClose }) {
  const { items, removeItem, updateQty } = useCartStore()
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Shopping Cart</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <ShoppingBag size={48} strokeWidth={1} />
              <p className="text-sm">Your cart is empty</p>
              <Link to="/shop" onClick={onClose} className="text-indigo-600 text-sm font-medium hover:underline">
                Continue Shopping
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div key={item._id} className="flex gap-3">
                <img
                  src={getImageUrl(item.images)}
                  alt={item.name}
                  className="w-18 h-18 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                  style={{ width: 72, height: 72 }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 line-clamp-1">{item.name}</p>
                  <p className="text-sm text-indigo-600 font-bold mt-0.5">{formatPrice(item.price)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQty(item._id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item._id, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      onClick={() => removeItem(item._id)}
                      className="ml-auto p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-bold text-gray-900">{formatPrice(total)}</span>
            </div>
            <Link
              to="/cart"
              onClick={onClose}
              className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Checkout
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
