export const SALES_TAX_RATE = Number(import.meta.env.VITE_SALES_TAX_RATE || 0.0825)

export function calculateSalesTax(subtotal) {
  const taxableAmount = Number(subtotal) || 0
  return Math.round(taxableAmount * SALES_TAX_RATE * 100) / 100
}

export function formatSalesTaxRate() {
  return `${(SALES_TAX_RATE * 100).toFixed(2)}%`
}
