/** Sheet → website: prices only when explicitly enabled (website/admin prices win by default). */
function shouldSyncPricesFromSheet() {
  return process.env.INVENTORY_SYNC_SHEET_PRICES === 'true'
}

function stripSheetPricing(payload = {}) {
  const next = { ...payload }
  delete next.price
  delete next.comparePrice
  return next
}

module.exports = {
  shouldSyncPricesFromSheet,
  stripSheetPricing,
}
