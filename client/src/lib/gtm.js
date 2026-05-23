/**
 * Google Tag Manager & GA4 ecommerce dataLayer helpers.
 * GA4 is deployed via GTM — no gtag.js here.
 */

export const GTM_ID = 'GTM-PV2RLR9P'
export const GA4_CURRENCY = 'USD'
export const GA4_AFFILIATION = 'Evolve Specialty Pharmacy & Wellness'
export const GA4_ITEM_BRAND = 'Evolve Specialty Pharmacy & Wellness'

/** Ensure dataLayer exists (GTM also initializes this in index.html). */
export function ensureDataLayer() {
  window.dataLayer = window.dataLayer || []
  return window.dataLayer
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
    item_id: product.sku || product._id,
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

/**
 * GA4 view_item — call once when the product page has loaded product data.
 */
export function pushViewItem(product, quantity = 1) {
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
  const items = [
    buildGA4Item(product, {
      quantity,
      index: 0,
      coupon: options.coupon ?? '',
      itemVariant: options.itemVariant ?? getDefaultItemVariant(product),
    }),
  ]
  const value = Number((items[0].price * quantity).toFixed(2))

  ensureDataLayer().push({
    event: 'add_to_cart',
    ecommerce: {
      currency: GA4_CURRENCY,
      value,
      items,
    },
  })
}
