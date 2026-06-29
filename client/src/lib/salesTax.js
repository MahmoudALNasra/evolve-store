export const SALES_TAX_RATE = Number(import.meta.env.VITE_SALES_TAX_RATE || 0.0825)

export function getTaxableSubtotal(items = []) {
  return items.reduce((sum, item) => {
    if (!item?.isTaxable) return sum
    const price = Number(item.price) || 0
    const quantity = Number(item.quantity) || 0
    return sum + price * quantity
  }, 0)
}

export function calculateSalesTax(taxableSubtotal) {
  const taxableAmount = Number(taxableSubtotal) || 0
  return Math.round(taxableAmount * SALES_TAX_RATE * 100) / 100
}

export function calculateSalesTaxFromItems(items = []) {
  return calculateSalesTax(getTaxableSubtotal(items))
}

export function formatSalesTaxRate() {
  return `${(SALES_TAX_RATE * 100).toFixed(2)}%`
}
