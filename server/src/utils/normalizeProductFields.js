/**
 * Empty SKU breaks unique sparse index (multiple "" values collide).
 * Omit SKU when blank so MongoDB does not index it.
 */
function normalizeSku(value) {
  if (value == null) return undefined
  const trimmed = String(value).trim()
  return trimmed || undefined
}

function normalizeProductPayload(body) {
  if (!body || typeof body !== 'object') return { payload: body, unsetSku: false }

  const payload = { ...body }
  let unsetSku = false

  if ('sku' in payload) {
    const sku = normalizeSku(payload.sku)
    if (sku) {
      payload.sku = sku
    } else {
      delete payload.sku
      unsetSku = true
    }
  }

  return { payload, unsetSku }
}

module.exports = { normalizeSku, normalizeProductPayload }
