export const formatPrice = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

export const formatDate = (date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(date))

export const truncate = (str, len = 80) =>
  str && str.length > len ? str.slice(0, len) + '…' : str

import { getOptimizedImageUrl } from './cloudinaryImage'
import {
  EXTENDED_FREE_SHIPPING_MAX_RATE,
  EXTENDED_FREE_SHIPPING_THRESHOLD,
  FREE_SHIPPING_MAX_RATE,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_RATE_MARKUP,
  addShippingMarkup,
  calcShipping,
  formatShippingRange,
  getFreeShippingMinimumSubtotal,
  getShippingQuote,
  getShippingZone,
  isFreeShippingEligible,
} from './shippingRates'

/** First product image with Cloudinary f_auto,q_auto (use ProductImage for responsive srcSet). */
export const getImageUrl = (images, width = 400) =>
  getOptimizedImageUrl(null, images, width)

export {
  EXTENDED_FREE_SHIPPING_MAX_RATE,
  EXTENDED_FREE_SHIPPING_THRESHOLD,
  FREE_SHIPPING_MAX_RATE,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_RATE_MARKUP,
  addShippingMarkup,
  calcShipping,
  formatShippingRange,
  getFreeShippingMinimumSubtotal,
  getShippingQuote,
  getShippingZone,
  isFreeShippingEligible,
}
