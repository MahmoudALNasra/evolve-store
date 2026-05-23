const Product = require('../models/Product')

async function releaseReservedStock(order) {
  if (!order?.stockReduced) return false

  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } })
  }

  order.stockReduced = false
  await order.save()
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

module.exports = { reserveStockForItems, releaseReservedStock }
