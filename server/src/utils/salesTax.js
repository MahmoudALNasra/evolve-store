const SALES_TAX_RATE = Number(process.env.SALES_TAX_RATE || 0.0825)

function calculateSalesTax(subtotal) {
  const taxableAmount = Number(subtotal) || 0
  return Math.round(taxableAmount * SALES_TAX_RATE * 100) / 100
}

module.exports = { SALES_TAX_RATE, calculateSalesTax }
