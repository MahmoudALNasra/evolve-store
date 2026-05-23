export const FREE_SHIPPING_THRESHOLD = 100
export const FREE_SHIPPING_MAX_RATE = 15
export const EXTENDED_FREE_SHIPPING_THRESHOLD = 200
export const EXTENDED_FREE_SHIPPING_MAX_RATE = 50
export const SHIPPING_RATE_MARKUP = 2

const REMOTE_STATES = new Set(['AK', 'HI'])
const LOCAL_STATES = new Set(['TX'])
const NEARBY_STATES = new Set(['AR', 'KS', 'LA', 'NM', 'OK'])

const SHIPPING_RANGES = {
  unknown: { amount: 13.99, min: 8.99, max: 24.99, label: 'Estimated Shipping' },
  local: { amount: 8.99, min: 8.99, max: 10.99, label: 'Regional Standard Shipping' },
  nearby: { amount: 10.99, min: 9.99, max: 13.99, label: 'Regional Standard Shipping' },
  contiguous: { amount: 13.99, min: 11.99, max: 16.99, label: 'Standard Shipping' },
  remote: { amount: 24.99, min: 19.99, max: 29.99, label: 'Extended Area Shipping' },
}

function normalizeState(address = {}) {
  return String(address.state || '').trim().toUpperCase()
}

export function getShippingZone(address = {}) {
  const state = normalizeState(address)
  if (!state) return 'unknown'
  if (REMOTE_STATES.has(state)) return 'remote'
  if (LOCAL_STATES.has(state)) return 'local'
  if (NEARBY_STATES.has(state)) return 'nearby'
  return 'contiguous'
}

export function getFreeShippingMinimumSubtotal(rate) {
  const numericRate = Number(rate)
  if (!Number.isFinite(numericRate) || numericRate < 0) return null
  if (numericRate <= FREE_SHIPPING_MAX_RATE) return FREE_SHIPPING_THRESHOLD
  if (numericRate <= EXTENDED_FREE_SHIPPING_MAX_RATE) return EXTENDED_FREE_SHIPPING_THRESHOLD
  return null
}

export function isFreeShippingEligible(subtotal, rate) {
  const requiredSubtotal = getFreeShippingMinimumSubtotal(rate)
  return requiredSubtotal != null && Number(subtotal || 0) >= requiredSubtotal
}

export function addShippingMarkup(amount) {
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount)) return numericAmount
  return Number((numericAmount + SHIPPING_RATE_MARKUP).toFixed(2))
}

export function getShippingQuote(subtotal, address = {}) {
  const numericSubtotal = Number(subtotal) || 0
  const zone = getShippingZone(address)
  const baseQuote = SHIPPING_RANGES[zone]
  const quote = {
    ...baseQuote,
    amount: addShippingMarkup(baseQuote.amount),
    min: addShippingMarkup(baseQuote.min),
    max: addShippingMarkup(baseQuote.max),
  }
  const freeShippingEligible = isFreeShippingEligible(numericSubtotal, quote.amount)

  if (freeShippingEligible) {
    const requiredSubtotal = getFreeShippingMinimumSubtotal(quote.amount)
    return {
      amount: 0,
      originalAmount: quote.amount,
      min: 0,
      max: quote.max,
      label: `${quote.label} (Free)`,
      zone,
      isFree: true,
      note: `Free shipping applies because the product subtotal is $${requiredSubtotal}+ for this shipping rate.`,
    }
  }

  const requiredSubtotal = getFreeShippingMinimumSubtotal(quote.amount)

  return {
    ...quote,
    zone,
    isFree: false,
    note:
      requiredSubtotal
        ? `This rate is free when the product subtotal is $${requiredSubtotal}+ before tax and shipping.`
        : zone === 'unknown'
          ? 'Enter your shipping address for a closer estimate.'
          : `Rates above $${EXTENDED_FREE_SHIPPING_MAX_RATE} are not covered by free shipping.`,
  }
}

export function formatShippingRange(quote, formatPrice) {
  if (quote.isFree) return 'Free'
  if (quote.min === quote.max) return formatPrice(quote.amount)
  return `${formatPrice(quote.min)} - ${formatPrice(quote.max)}`
}

export function calcShipping(subtotal, address = {}) {
  return getShippingQuote(subtotal, address).amount
}
