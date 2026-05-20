export const formatPrice = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

export const formatDate = (date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(date))

export const truncate = (str, len = 80) =>
  str && str.length > len ? str.slice(0, len) + '…' : str

export const getImageUrl = (images) =>
  images && images.length > 0 ? images[0].url : 'https://placehold.co/400x400?text=No+Image'

// Shipping rules — keep in sync with server/src/routes/checkoutRoutes.js
export const FREE_SHIPPING_THRESHOLD = 100
export const STANDARD_SHIPPING_RATE = 11.99
export const calcShipping = (subtotal) =>
  subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_RATE
