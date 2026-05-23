const Category = require('../models/Category')
const Product = require('../models/Product')

/**
 * Category names for storefront filters (admin Category collection is source of truth).
 */
async function getStorefrontCategoryNames() {
  const rows = await Category.find().sort({ name: 1 }).select('name').lean()
  const names = rows.map((c) => c.name).filter(Boolean)

  if (names.length > 0) return names

  // Fallback if Category collection is empty (legacy seed data only on products)
  const legacy = await Product.distinct('category', {
    isPublished: true,
    category: { $nin: [null, '', 'Uncategorized'] },
  })
  return legacy.filter(Boolean).sort((a, b) => a.localeCompare(b))
}

module.exports = { getStorefrontCategoryNames }
