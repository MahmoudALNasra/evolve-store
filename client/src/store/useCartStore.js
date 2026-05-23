import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      _hasHydrated: false,
      isCartOpen: false,

      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },

      openCart: () => set({ isCartOpen: true }),
      closeCart: () => set({ isCartOpen: false }),

      addItem: (product, quantity = 1) => {
        const items = get().items
        const existing = items.find((i) => i._id === product._id)
        if (existing) {
          set({
            isCartOpen: true,
            items: items.map((i) =>
              i._id === product._id ? { ...i, quantity: i.quantity + quantity } : i
            ),
          })
        } else {
          set({ items: [...items, { ...product, quantity }], isCartOpen: true })
        }
      },

      removeItem: (id) => set({ items: get().items.filter((i) => i._id !== id) }),

      updateQty: (id, quantity) => {
        if (quantity < 1) return
        set({ items: get().items.map((i) => (i._id === id ? { ...i, quantity } : i)) })
      },

      clearCart: () => set({ items: [] }),

      // Merge guest cart with user cart (called after login)
      mergeGuestCart: (guestItems) => {
        console.log('🔄 mergeGuestCart called with:', guestItems)
        if (!guestItems || guestItems.length === 0) {
          console.log('⚠️ No guest items to merge')
          return
        }
        
        // Get current cart items from localStorage
        const currentItems = get().items
        console.log('📋 Current cart items:', currentItems)
        
        // If current cart is empty, just set the guest items
        if (currentItems.length === 0) {
          console.log('✅ Setting guest items directly (cart was empty)')
          set({ items: guestItems })
          return
        }
        
        // Otherwise merge intelligently
        const mergedItems = [...currentItems]

        guestItems.forEach((guestItem) => {
          const existingIndex = mergedItems.findIndex((i) => i._id === guestItem._id)
          if (existingIndex >= 0) {
            // Item exists - keep the higher quantity (don't duplicate)
            const existingQty = mergedItems[existingIndex].quantity
            const guestQty = guestItem.quantity
            mergedItems[existingIndex] = {
              ...mergedItems[existingIndex],
              quantity: Math.max(existingQty, guestQty),
            }
            console.log(`🔀 Merged ${guestItem.name}: ${existingQty} -> ${Math.max(existingQty, guestQty)}`)
          } else {
            // New item, add it
            mergedItems.push(guestItem)
            console.log(`➕ Added new item: ${guestItem.name}`)
          }
        })

        console.log('✅ Final merged cart:', mergedItems)
        set({ items: mergedItems })
      },

      // Get current cart items (for saving before login)
      getItems: () => get().items,

      get total() {
        return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0)
      },

      get count() {
        return get().items.reduce((sum, i) => sum + i.quantity, 0)
      },
    }),
    { 
      name: 'estore-cart',
      // Ensure cart persists across sessions
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        console.log('💧 Cart rehydrated from localStorage')
        state?.setHasHydrated(true)
      },
    }
  )
)

export default useCartStore
