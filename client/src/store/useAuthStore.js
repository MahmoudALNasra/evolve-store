import { create } from 'zustand'
import api from '../lib/api'
import useCartStore from './useCartStore'

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  loading: false,
  initialized: false,

  init: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ initialized: true })
      return
    }
    try {
      const { data } = await api.get('/auth/me')
      set({ user: data, token, initialized: true })
    } catch {
      localStorage.removeItem('token')
      set({ user: null, token: null, initialized: true })
    }
  },

  login: async (email, password) => {
    set({ loading: true })
    
    // Save guest cart items to localStorage backup before login
    const guestCartItems = [...useCartStore.getState().getItems()]
    console.log('🛒 Guest cart before login:', guestCartItems)
    
    if (guestCartItems.length > 0) {
      localStorage.setItem('guest-cart-backup', JSON.stringify(guestCartItems))
      console.log('💾 Saved guest cart to backup')
    }
    
    try {
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', data.token)
      set({ user: data, token: data.token, loading: false })
      
      // Restore and merge guest cart after successful login
      const backupCart = localStorage.getItem('guest-cart-backup')
      console.log('📦 Backup cart after login:', backupCart)
      
      if (backupCart) {
        const items = JSON.parse(backupCart)
        console.log('🔄 Merging cart items:', items)
        if (items.length > 0) {
          useCartStore.getState().mergeGuestCart(items)
          localStorage.removeItem('guest-cart-backup')
          console.log('✅ Cart merged successfully')
        }
      }
      
      return data
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  register: async (name, email, password) => {
    set({ loading: true })
    
    // Save guest cart items to localStorage backup before register
    const guestCartItems = [...useCartStore.getState().getItems()]
    console.log('🛒 Guest cart before register:', guestCartItems)
    
    if (guestCartItems.length > 0) {
      localStorage.setItem('guest-cart-backup', JSON.stringify(guestCartItems))
      console.log('💾 Saved guest cart to backup')
    }
    
    try {
      const { data } = await api.post('/auth/register', { name, email, password })
      localStorage.setItem('token', data.token)
      set({ user: data, token: data.token, loading: false })
      
      // Restore and merge guest cart after successful registration
      const backupCart = localStorage.getItem('guest-cart-backup')
      console.log('📦 Backup cart after register:', backupCart)
      
      if (backupCart) {
        const items = JSON.parse(backupCart)
        console.log('🔄 Merging cart items (register):', items)
        if (items.length > 0) {
          useCartStore.getState().mergeGuestCart(items)
          localStorage.removeItem('guest-cart-backup')
          console.log('✅ Cart merged successfully (register)')
        }
      }
      
      return data
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null })
    // Note: We keep the cart items in localStorage for guest browsing
  },

  setUser: (user) => set({ user }),
}))

export default useAuthStore
