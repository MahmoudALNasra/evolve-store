/**
 * Mark all products as taxable (isTaxable: true).
 * Run: npm run migrate:taxable
 */
require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/Product')

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB')

  const result = await Product.updateMany({}, { $set: { isTaxable: true } })

  console.log(`Matched ${result.matchedCount} product(s), updated ${result.modifiedCount}.`)
  await mongoose.disconnect()
  process.exit(0)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
