/**
 * Google Tag Manager & GA4 ecommerce dataLayer helpers.
 * GTM-PV2RLR9P + GA4 G-797RS12Z30 load from index.html (Consent Mode).
 * Ecommerce events push to dataLayer for GTM tags / key events.
 */

import { allowsGtm, loadGtmIfAllowed } from './cookieConsent'

export const GTM_ID = 'GTM-PV2RLR9P'
export const GA4_CURRENCY = 'USD'
export const GA4_AFFILIATION = 'Evolve Specialty Pharmacy & Wellness'
export const GA4_ITEM_BRAND = 'Evolve Specialty Pharmacy & Wellness'

/** Ensure dataLayer exists (GTM loads after cookie consent). */
export function ensureDataLayer() {
  window.dataLayer = window.dataLayer || []
  return window.dataLayer
}

function canPushEcommerce() {
  if (!allowsGtm()) return false
  loadGtmIfAllowed()
  return true
}

/** GA4 recommends clearing previous ecommerce object before each push. */
function clearEcommerce() {
  ensureDataLayer().push({ ecommerce: null })
}

/**
 * Build a single GA4 ecommerce item object (view_item / add_to_cart).
 * @param {object} product - API product document
 * @param {object} options
 * @param {number} [options.quantity=1]
 * @param {number} [options.index=0]
 * @param {string} [options.itemVariant='']
 * @param {string} [options.coupon='']
 */
export function buildGA4Item(product, options = {}) {
  const {
    quantity = 1,
    index = 0,
    itemVariant = getDefaultItemVariant(product),
    coupon = '',
  } = options

  const unitPrice = Number(product.price) || 0
  const comparePrice = Number(product.comparePrice) || 0
  const discount =
    comparePrice > unitPrice ? Number((comparePrice - unitPrice).toFixed(2)) : 0

  return {
    item_id: product.sku || product._id || product.product,
    item_name: product.name,
    affiliation: GA4_AFFILIATION,
    coupon,
    discount,
    index,
    item_brand: GA4_ITEM_BRAND,
    item_category: product.category || 'Uncategorized',
    item_variant: itemVariant,
    price: unitPrice,
    quantity,
  }
}

function getDefaultItemVariant(product) {
  const variant = product.variants?.[0]
  if (!variant) return ''
  const option = variant.options?.[0]
  return option ? `${variant.name}: ${option}` : variant.name
}

function buildItemsFromCart(cartItems = []) {
  return cartItems.map((item, index) =>
    buildGA4Item(item, { quantity: Number(item.quantity) || 1, index })
  )
}

function cartValue(items = []) {
  return Number(
    items
      .reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0)
      .toFixed(2)
  )
}

/**
 * GA4 view_item — call once when the product page has loaded product data.
 */
export function pushViewItem(product, quantity = 1) {
  if (!canPushEcommerce()) return

  const items = [buildGA4Item(product, { quantity, index: 0 })]
  const value = Number((items[0].price * quantity).toFixed(2))

  /* Page context for GTM triggers (non-ecommerce keys) */
  ensureDataLayer().push({
    page_type: 'product_detail',
    product_id: product.sku || product._id,
    product_name: product.name,
    product_category: product.category || 'Uncategorized',
    product_price: items[0].price,
    currency: GA4_CURRENCY,
  })

  clearEcommerce()
  ensureDataLayer().push({
    event: 'view_item',
    ecommerce: {
      currency: GA4_CURRENCY,
      value,
      items,
    },
  })
}

/**
 * GA4 add_to_cart — attach to the Add to Cart button handler.
 * @param {object} product
 * @param {number} quantity
 * @param {object} [options] - optional coupon, itemVariant
 */
export function pushAddToCart(product, quantity = 1, options = {}) {
  if (!canPushEcommerce()) return

  const items = [
    buildGA4Item(product, {
      quantity,
      index: 0,
      coupon: options.coupon ?? '',
      itemVariant: options.itemVariant ?? getDefaultItemVariant(product),
    }),
  ]
  const value = Number((items[0].price * quantity).toFixed(2))

  clearEcommerce()
  ensureDataLayer().push({
    event: 'add_to_cart',
    ecommerce: {
      currency: GA4_CURRENCY,
      value,
      items,
    },
  })
}

/**
 * GA4 begin_checkout — fire when the checkout page loads with cart items.
 * @param {object[]} cartItems
 * @param {object} [options]
 * @param {string} [options.coupon]
 */
export function pushBeginCheckout(cartItems = [], options = {}) {
  if (!canPushEcommerce()) return
  if (!cartItems.length) return

  const items = buildItemsFromCart(cartItems)
  const value = cartValue(cartItems)

  clearEcommerce()
  ensureDataLayer().push({
    event: 'begin_checkout',
    ecommerce: {
      currency: GA4_CURRENCY,
      value,
      coupon: options.coupon || '',
      items,
    },
  })
}

/**
 * GA4 purchase — fire once on order-success when payment is confirmed.
 * @param {object} order
 */
export function pushPurchase(order) {
  if (!canPushEcommerce()) return
  if (!order?._id) return

  const items = (order.items || []).map((item, index) =>
    buildGA4Item(
      {
        _id: item.product || item._id,
        sku: item.sku,
        name: item.name,
        price: item.price,
        category: item.category,
      },
      { quantity: Number(item.quantity) || 1, index, coupon: order.discountCode || '' }
    )
  )

  const value = Number(
    (order.amountPaid != null ? order.amountPaid : order.total) || cartValue(order.items || [])
  )

  clearEcommerce()
  ensureDataLayer().push({
    event: 'purchase',
    ecommerce: {
      transaction_id: String(order._id),
      currency: GA4_CURRENCY,
      value: Number(value.toFixed(2)),
      tax: Number(order.tax || 0),
      shipping: Number(order.shipping || 0),
      coupon: order.discountCode || '',
      items,
    },
  })
}

/**
 * Custom phone_call event for Call Now / tel: links (mark as key event in GA4).
 * @param {object} [meta]
 * @param {string} [meta.phone]
 * @param {string} [meta.label]
 * @param {string} [meta.location]
 */
export function pushPhoneCall(meta = {}) {
  if (!canPushEcommerce()) return

  ensureDataLayer().push({
    event: 'phone_call',
    phone_number: meta.phone || '+12103146464',
    link_text: meta.label || 'Call Now',
    click_location: meta.location || window.location.pathname,
  })
}
