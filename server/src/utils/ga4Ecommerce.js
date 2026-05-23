const GA4_CURRENCY = 'USD'
const GA4_AFFILIATION = 'Evolve Specialty Pharmacy & Wellness'
const GA4_ITEM_BRAND = 'Evolve Specialty Pharmacy & Wellness'

/**
 * Build GA4 ecommerce `items[]` from a persisted order line items.
 * @param {import('mongoose').Document} order
 * @param {Map<string, object>} [productById] - optional product docs keyed by id string
 */
function buildGa4ItemsFromOrder(order, productById = new Map()) {
  return (order.items || []).map((item, index) => {
    const productId = item.product?._id?.toString() || item.product?.toString()
    const product = productId ? productById.get(productId) : null
    return {
      item_id: product?.sku || productId || item.name,
      item_name: item.name,
      affiliation: GA4_AFFILIATION,
      index,
      item_brand: GA4_ITEM_BRAND,
      item_category: product?.category || 'Uncategorized',
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
    }
  })
}

/**
 * Purchase / begin_checkout params from the database order record.
 */
function buildGa4TransactionParams(order, productById) {
  const items = buildGa4ItemsFromOrder(order, productById)
  return {
    transaction_id: order._id.toString(),
    value: Number(order.total) || 0,
    currency: GA4_CURRENCY,
    tax: Number(order.tax) || 0,
    shipping: Number(order.shipping) || 0,
    affiliation: GA4_AFFILIATION,
    items,
  }
}

module.exports = {
  GA4_CURRENCY,
  GA4_AFFILIATION,
  buildGa4ItemsFromOrder,
  buildGa4TransactionParams,
}
