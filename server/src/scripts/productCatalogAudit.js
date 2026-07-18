require('dotenv').config()
const connectDB = require('../config/db')
const { auditDescriptionQuality } = require('../services/productDescriptionOptimizationService')
const { auditProductCategories } = require('../services/barcodeCategoryFixService')
const { MIN_WORDS } = require('../utils/productDescriptionQuality')
const { shouldFixProductName } = require('../utils/productNameQuality')

async function main() {
  await connectDB()

  const includeUnpublished = process.argv.includes('--include-unpublished')
  const descriptions = await auditDescriptionQuality({ includeUnpublished })
  const categories = await auditProductCategories({ onlyPublished: !includeUnpublished })

  const Product = require('../models/Product')
  const filter = includeUnpublished ? {} : { isPublished: true }
  const products = await Product.find(filter).select('name').lean()
  const badTitles = products.filter((p) => shouldFixProductName(p.name)).length

  console.log('--- Catalog quality audit ---')
  console.log(JSON.stringify({
    scope: includeUnpublished ? 'all products' : 'published only',
    titles: {
      total: products.length,
      needsFix: badTitles,
      optimized: products.length - badTitles,
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
