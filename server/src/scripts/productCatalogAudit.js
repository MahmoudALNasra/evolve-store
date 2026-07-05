require('dotenv').config()
const connectDB = require('../config/db')
const { auditDescriptionQuality } = require('../services/productDescriptionOptimizationService')
const { auditProductCategories } = require('../services/barcodeCategoryFixService')
const { MIN_WORDS } = require('../utils/productDescriptionQuality')
const { shouldFixProductName } = require('../utils/productNameQuality')

async function main() {
  await connectDB()

  const descriptions = await auditDescriptionQuality()
  const categories = await auditProductCategories()

  const Product = require('../models/Product')
  const published = await Product.find({ isPublished: true }).select('name').lean()
  const badTitles = published.filter((p) => shouldFixProductName(p.name)).length

  console.log('--- Catalog quality audit ---')
  console.log(JSON.stringify({
    titles: {
      total: published.length,
      needsFix: badTitles,
      optimized: published.length - badTitles,
      rule: 'Bad if Amazon/Walmart junk, Seller StoreFront, too long, or truncated with ...',
    },
    descriptions: {
      ...descriptions,
      rule: `Needs work if empty, under ${MIN_WORDS} words, or missing SEO meta/FAQs`,
    },
    categories: {
      ...categories,
      rule: 'Needs fix if Uncategorized, empty, or not in Category collection (never reassigned to Uncategorized)',
    },
  }, null, 2))

  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
