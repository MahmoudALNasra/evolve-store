/**
 * One-time migration: generate slugs for products missing slug.
 * Run: node src/scripts/migrateProductSlugs.js
 */
require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/Product')
const { generateUniqueSlug } = require('../utils/productSlug')

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB')

  try {
    await Product.collection.dropIndex('slug_1')
    console.log('Dropped slug_1 index (will be recreated on next server start)')
  } catch {
    // Index may not exist yet
  }

  const products = await Product.find({
    $or: [{ slug: { $exists: false } }, { slug: '' }, { slug: null }],
  })

  if (!products.length) {
    console.log('All products already have slugs.')
    await mongoose.disconnect()
    process.exit(0)
  }

  let updated = 0
  for (const product of products) {
    product.slug = await generateUniqueSlug(Product, product.name, {
      excludeId: product._id,
    })
    await product.save()
    updated++
    console.log(`  ${product.name} → ${product.slug}`)
  }

  console.log(`Updated ${updated} product(s).`)
  await mongoose.disconnect()
  process.exit(0)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
