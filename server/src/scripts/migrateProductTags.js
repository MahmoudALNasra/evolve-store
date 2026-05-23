/**
 * Backfill tags for products with none (from name + description + category).
 * Run: npm run migrate:tags
 */
require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/Product')
const { generateProductTags } = require('../utils/generateProductTags')

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB')

  const products = await Product.find({
    $or: [{ tags: { $exists: false } }, { tags: { $size: 0 } }],
  }).select('name description category tags')

  if (!products.length) {
    console.log('All products already have tags.')
    await mongoose.disconnect()
    process.exit(0)
  }

  let updated = 0
  for (const product of products) {
    product.tags = generateProductTags({
      name: product.name,
      description: product.description,
      category: product.category,
    })
    await product.save()
    updated++
    console.log(`  ${product.name} → [${product.tags.join(', ')}]`)
  }

  console.log(`Updated ${updated} product(s).`)
  await mongoose.disconnect()
  process.exit(0)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
