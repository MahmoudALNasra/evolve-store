/**
 * Remove empty SKU strings so unique sparse index stops failing.
 * Run: npm run migrate:skus
 */
require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/Product')

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB')

  const result = await Product.updateMany(
    { $or: [{ sku: '' }, { sku: null }] },
    { $unset: { sku: 1 } }
  )

  console.log(`Unset empty SKU on ${result.modifiedCount} product(s).`)
  await mongoose.disconnect()
  process.exit(0)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
