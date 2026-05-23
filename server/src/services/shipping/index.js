const {
  EXTENDED_FREE_SHIPPING_MAX_RATE,
  addShippingMarkup,
  getFreeShippingMinimumSubtotal,
  getShippingQuote,
  isFreeShippingEligible,
} = require('../../utils/shippingRates')
const { getDispatchInfo } = require('../../utils/shippingCutoff')
const { signShippingRateSelection, verifyShippingRateSelection } = require('../../utils/shippingRateToken')
const shippo = require('./shippoProvider')

function isUpsGroundRate(rate) {
  const provider = String(rate.provider || '').toLowerCase()
  const service = String(rate.service || '').toLowerCase()
  return provider.includes('ups') && service.includes('ground')
}

async function getLiveShippingRates({ subtotal, address, user }) {
  const numericSubtotal = Number(subtotal) || 0

  const applyFreeShippingCap = (rate) => {
    const carrierAmount = Number(rate.amount)
    const originalAmount = addShippingMarkup(carrierAmount)
    const freeShippingApplied = isFreeShippingEligible(numericSubtotal, originalAmount)

    return {
      ...rate,
      amount: freeShippingApplied ? 0 : originalAmount,
      originalAmount,
      carrierAmount,
      freeShippingApplied,
    }
  }

  if (!shippo.isConfigured()) {
    const estimate = getShippingQuote(numericSubtotal, address)
    const rate = {
      objectId: 'estimate',
      amount: estimate.amount,
      originalAmount: estimate.originalAmount ?? estimate.amount,
      freeShippingApplied: Boolean(estimate.isFree),
      label: estimate.label,
      provider: 'Estimate',
      service: estimate.label,
      estimatedDays: null,
    }
    return {
      mode: 'estimate',
      dispatch: getDispatchInfo(),
      rates: [
        {
          ...rate,
          token: signShippingRateSelection({
            mode: 'estimate',
            amount: rate.amount,
            originalAmount: rate.originalAmount,
            freeShippingApplied: rate.freeShippingApplied,
            label: rate.label,
            zip: address.zip,
          }),
        },
      ],
      note: 'Live carrier rates unavailable; showing estimate.',
    }
  }

  const { shipmentId, rates } = await shippo.createShipmentWithRates({
    toAddress: address,
    user,
  })

  const upsGroundRates = rates.filter(isUpsGroundRate).slice(0, 3)

  if (!upsGroundRates.length) {
    throw new Error('No UPS Ground shipping rates available for this address')
  }

  const dispatch = getDispatchInfo()

  return {
    mode: 'live',
    shipmentId,
    dispatch,
    rates: upsGroundRates.map((rate) => {
      const cappedRate = applyFreeShippingCap(rate)
      return {
        ...cappedRate,
        token: signShippingRateSelection({
          mode: 'live',
          shipmentId,
          rateObjectId: cappedRate.objectId,
          amount: cappedRate.amount,
          originalAmount: cappedRate.originalAmount,
          carrierAmount: cappedRate.carrierAmount,
          freeShippingApplied: cappedRate.freeShippingApplied,
          label: cappedRate.label,
          provider: cappedRate.provider,
          service: cappedRate.service,
          zip: address.zip,
        }),
      }
    }),
  }
}

function resolveShippingFromToken(token, address, { subtotal } = {}) {
  const decoded = verifyShippingRateSelection(token)
  if (!decoded) return { error: 'Shipping selection expired. Please refresh rates.' }

  const zip = String(address?.zip || '').split('-')[0]
  const tokenZip = String(decoded.zip || '').split('-')[0]
  if (tokenZip && zip && tokenZip !== zip) {
    return { error: 'Shipping address changed. Please select shipping again.' }
  }

  const amount = Number(decoded.amount)
  const originalAmount = Number(decoded.originalAmount ?? decoded.amount)
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: 'Invalid shipping selection. Please refresh rates.' }
  }

  if (decoded.freeShippingApplied) {
    const numericSubtotal = Number(subtotal) || 0
    const requiredSubtotal = getFreeShippingMinimumSubtotal(originalAmount)
    if (!requiredSubtotal || originalAmount > EXTENDED_FREE_SHIPPING_MAX_RATE) {
      return { error: 'Selected shipping option is above the free shipping limit. Please refresh rates.' }
    }
    if (numericSubtotal < requiredSubtotal) {
      return { error: 'Cart subtotal no longer qualifies for free shipping. Please refresh rates.' }
    }
  }

  return {
    amount,
    label: decoded.label || 'Shipping',
    method: {
      provider: decoded.mode === 'live' ? 'shippo' : decoded.mode,
      shipmentId: decoded.shipmentId || '',
      rateObjectId: decoded.rateObjectId || decoded.objectId || '',
      carrier: decoded.provider || '',
      service: decoded.service || '',
      amount,
      label: decoded.label || 'Shipping',
    },
  }
}

module.exports = {
  getLiveShippingRates,
  resolveShippingFromToken,
  isShippoConfigured: shippo.isConfigured,
}
