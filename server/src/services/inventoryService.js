const Product = require('../models/Product')

/**
 * Restore inventory for an order that previously reserved/reduced stock.
 * Idempotent via `order.stockReduced`.
 */
async function releaseReservedStock(order, { save = true } = {}) {
  if (!order?.stockReduced) return false

  for (const item of order.items || []) {
    if (!item?.product || !item?.quantity) continue
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } })
  }

  order.stockReduced = false
  if (save && typeof order.save === 'function') {
    await order.save()
  }
  return true
}

async function reserveStockForItems(items) {
  const reserved = []

  try {
    for (const item of items) {
      const product = await Product.findOneAndUpdate(
        {
          _id: item.product,
          isPublished: true,
          stock: { $gte: item.quantity },
        },
        { $inc: { stock: -item.quantity } },
        { returnDocument: 'after' }
      )

      if (!product) {
        throw new Error(`Insufficient stock for ${item.name}`)
      }

      reserved.push({ product: item.product, quantity: item.quantity })
    }

    return { ok: true }
  } catch (err) {
    for (const item of reserved) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } })
    }
    return { ok: false, message: err.message || 'Insufficient stock' }
  }
}

/**
 * Restore stock when an order is cancelled, refunded, or deleted.
 * Safe to call multiple times.
 */
async function restoreStockForCancelledOrRefundedOrder(order, reason = 'cancel') {
  if (!order) return false
  const restored = await releaseReservedStock(order)
  if (restored) {
    console.log(`📦 Stock restored for order ${order._id} (${reason})`)
  }
  return restored
}

module.exports = {
  reserveStockForItems,
  releaseReservedStock,
  restoreStockForCancelledOrRefundedOrder,
}
