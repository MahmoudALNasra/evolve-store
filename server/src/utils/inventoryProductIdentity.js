function cleanText(value) {
  if (value == null) return ''
  return String(value).trim()
}

/** Reject rows where Name is empty or is only the barcode digits. */
function isValidSheetProductName(name, barcode) {
  const n = cleanText(name)
  const bc = cleanText(barcode)
  if (!n) return false
  if (bc && n === bc) return false
  if (/^\d{8,14}$/.test(n)) return false
  return true
}

function productCompletenessScore(payload = {}) {
  let score = 0
  const name = cleanText(payload.name)
  if (isValidSheetProductName(name, payload.barcode)) score += 100
  if (cleanText(payload.description).length > 20) score += 20
  if (cleanText(payload.imageUrls).length > 0) score += 15
  if (Number(payload.price) > 0) score += 5
  if (Number(payload.stock) > 0) score += 3
  if (cleanText(payload.sku) && cleanText(payload.sku) !== cleanText(payload.barcode)) score += 5
  return score
}

function dedupeSheetEntries(entries) {
  const byBarcode = new Map()
  const withoutBarcode = []

  for (const entry of entries) {
    const barcode = cleanText(entry.websitePayload?.barcode)
    if (!barcode) {
      withoutBarcode.push(entry)
      continue
    }

    const existing = byBarcode.get(barcode)
    if (!existing || productCompletenessScore(entry.websitePayload) > productCompletenessScore(existing.websitePayload)) {
      byBarcode.set(barcode, entry)
    }
  }

  return [...byBarcode.values(), ...withoutBarcode]
}

module.exports = {
  cleanText,
  isValidSheetProductName,
  productCompletenessScore,
  dedupeSheetEntries,
}
