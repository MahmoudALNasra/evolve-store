const SALES_TAX_RATE = Number(process.env.SALES_TAX_RATE || 0.0825)

function getTaxableSubtotal(items = []) {
  return items.reduce((sum, item) => {
    if (!item?.isTaxable) return sum
    const price = Number(item.price) || 0
    const quantity = Number(item.quantity) || 0
    return sum + price * quantity
  }, 0)
}

function calculateSalesTax(taxableSubtotal) {
  const taxableAmount = Number(taxableSubtotal) || 0
  return Math.round(taxableAmount * SALES_TAX_RATE * 100) / 100
}

function calculateSalesTaxFromItems(items = []) {
  return calculateSalesTax(getTaxableSubtotal(items))
}

module.exports = {
  SALES_TAX_RATE,
  getTaxableSubtotal,
  calculateSalesTax,
  calculateSalesTaxFromItems,
}
