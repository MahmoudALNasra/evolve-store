const Category = require('../models/Category')
const Product = require('../models/Product')

/**
 * Category names for storefront filters, sorted by published product count.
 * "Other Categories" is kept last so broad fallback products do not dominate the menu.
 */
async function getStorefrontCategoryNames() {
  const otherCategory = process.env.INVENTORY_OTHER_CATEGORY_NAME || 'Other Categories'
  const minCount = Number(process.env.INVENTORY_MIN_CATEGORY_PRODUCT_COUNT || 2)
  const rows = await Category.find().select('name').lean()
  const names = rows.map((c) => c.name).filter(Boolean)

  if (names.length > 0) {
    const counts = await Product.aggregate([
      {
        $match: {
          isPublished: true,
          category: { $in: names },
        },
      },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ])
    const countByCategory = new Map(counts.map((row) => [row._id, row.count]))

    return names
      .filter((name) => {
        const isOther = name.toLowerCase() === otherCategory.toLowerCase()
        return isOther ? (countByCategory.get(name) || 0) > 0 : (countByCategory.get(name) || 0) >= minCount
      })
      .sort((a, b) => {
      const aIsOther = a.toLowerCase() === otherCategory.toLowerCase()
      const bIsOther = b.toLowerCase() === otherCategory.toLowerCase()
      if (aIsOther && !bIsOther) return 1
      if (!aIsOther && bIsOther) return -1

      const countDiff = (countByCategory.get(b) || 0) - (countByCategory.get(a) || 0)
      if (countDiff !== 0) return countDiff
      return a.localeCompare(b)
      })
  }

  // Fallback if Category collection is empty (legacy seed data only on products)
  const legacy = await Product.aggregate([
    {
      $match: {
        isPublished: true,
        category: { $nin: [null, '', 'Uncategorized'] },
      },
    },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ])

  return legacy
    .filter((row) => {
      if (!row._id) return false
      const isOther = row._id.toLowerCase() === otherCategory.toLowerCase()
      return isOther ? row.count > 0 : row.count >= minCount
    })
    .sort((a, b) => {
      const aIsOther = a._id.toLowerCase() === otherCategory.toLowerCase()
      const bIsOther = b._id.toLowerCase() === otherCategory.toLowerCase()
      if (aIsOther && !bIsOther) return 1
      if (!aIsOther && bIsOther) return -1

      const countDiff = b.count - a.count
      if (countDiff !== 0) return countDiff
      return a._id.localeCompare(b._id)
    })
    .map((row) => row._id)
}

module.exports = { getStorefrontCategoryNames }
