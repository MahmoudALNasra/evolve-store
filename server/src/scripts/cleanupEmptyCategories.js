require('dotenv').config()
const connectDB = require('../config/db')
const Category = require('../models/Category')
const Product = require('../models/Product')

async function ensureOtherCategory(name) {
  await Category.updateOne(
    { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
    { $setOnInsert: { name, description: '' } },
    { upsert: true }
  )
}

async function cleanupEmptyCategories() {
  await connectDB()

  const otherCategory = process.env.INVENTORY_OTHER_CATEGORY_NAME || 'Other Categories'
  const minCount = Number(process.env.INVENTORY_MIN_CATEGORY_PRODUCT_COUNT || 2)
  const categories = await Category.find()
  const removed = []
  const collapsed = []

  await ensureOtherCategory(otherCategory)

  for (const category of categories) {
    if (category.name.toLowerCase() === otherCategory.toLowerCase()) continue

    const count = await Product.countDocuments({ category: category.name })
    if (count === 0) {
      await category.deleteOne()
      removed.push(category.name)
    } else if (count < minCount) {
      await Product.updateMany({ category: category.name }, { $set: { category: otherCategory } })
      await category.deleteOne()
      collapsed.push({ name: category.name, count })
    }
  }

  console.log(JSON.stringify({
    removed: removed.length,
    removedCategories: removed,
    collapsed: collapsed.length,
    collapsedCategories: collapsed,
  }, null, 2))
  process.exit(0)
}

cleanupEmptyCategories().catch((err) => {
  console.error(err)
  process.exit(1)
})
