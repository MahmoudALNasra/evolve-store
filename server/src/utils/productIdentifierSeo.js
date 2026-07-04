/** Helpers so SKU/barcode are discoverable via keywords, schema, and on-page text — not titles. */

function cleanId(value) {
  return String(value || '').trim()
}

function isGtinBarcode(value) {
  return /^\d{8,14}$/.test(cleanId(value))
}

function buildProductTitleBase(product) {
  return cleanId(product?.name)
}

function buildProductKeywordList(product) {
  const tags = Array.isArray(product?.tags) ? product.tags : []
  const barcode = cleanId(product?.barcode)
  const sku = cleanId(product?.sku)
  const brand = cleanId(product?.brand)

  const keywords = [
    barcode,
    sku,
    barcode ? `UPC ${barcode}` : '',
    sku ? `SKU ${sku}` : '',
    product?.name,
    product?.category,
    brand,
    ...tags,
    `${product?.category || 'wellness'} supplements`,
    'specialty pharmacy',
    'Evolve Pharmacy',
  ]

  return [...new Set(keywords.map((k) => String(k || '').trim()).filter(Boolean))]
}

function applyProductIdentifierSchema(jsonLd, product) {
  const barcode = cleanId(product?.barcode)
  const sku = cleanId(product?.sku)
  const additional = []

  if (isGtinBarcode(barcode)) {
    jsonLd.gtin = barcode
    jsonLd.productID = barcode
  }
  if (sku) {
    jsonLd.mpn = sku
    if (!jsonLd.productID) jsonLd.productID = sku
  }
  if (barcode && !jsonLd.gtin) {
    jsonLd.gtin13 = barcode
  }
  if (barcode) {
    additional.push({ '@type': 'PropertyValue', name: 'UPC', value: barcode })
  }
  if (sku) {
    additional.push({ '@type': 'PropertyValue', name: 'SKU', value: sku })
  }
  if (additional.length) {
    jsonLd.additionalProperty = additional
  }

  return jsonLd
}

module.exports = {
  cleanId,
  isGtinBarcode,
  buildProductTitleBase,
  buildProductKeywordList,
  applyProductIdentifierSchema,
}
