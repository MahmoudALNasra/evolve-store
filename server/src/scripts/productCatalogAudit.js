require('dotenv').config()
const connectDB = require('../config/db')
const { auditDescriptionQuality } = require('../services/productDescriptionOptimizationService')
const { auditProductCategories } = require('../services/barcodeCategoryFixService')
const { MIN_WORDS } = require('../utils/productDescriptionQuality')

async function main() {
  await connectDB()

  const descriptions = await auditDescriptionQuality()
  const categories = await auditProductCategories()

  console.log('--- Catalog quality audit ---')
  console.log(JSON.stringify({
    descriptions: {
      ...descriptions,
      rule: `Needs work if empty, under ${MIN_WORDS} words, or missing SEO meta/FAQs`,
    },
    categories: {
      ...categories,
      rule: 'Needs fix if Uncategorized, empty, or not in Category collection',
    },
  }, null, 2))

  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
