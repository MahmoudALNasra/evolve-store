require('dotenv').config()
const connectDB = require('../config/db')
const Product = require('../models/Product')
const BlogArticle = require('../models/BlogArticle')
const { generateProductArticleDraft } = require('../services/blogGenerationService')

function parseArgs(argv) {
  const args = { limit: Number(process.env.BLOG_BATCH_LIMIT || 10) }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--limit' && argv[i + 1]) {
      args.limit = Number(argv[i + 1])
      i += 1
    }
  }
  return args
}

async function main() {
  const { limit } = parseArgs(process.argv.slice(2))

  if (process.env.BLOG_GENERATION_ENABLED !== 'true') {
    console.error('Set BLOG_GENERATION_ENABLED=true in server/.env before generating articles.')
    process.exit(1)
  }

  await connectDB()

  const withArticles = await BlogArticle.distinct('product', { product: { $ne: null } })
  const products = await Product.find({ _id: { $nin: withArticles } })
    .sort({ name: 1 })
    .limit(limit)

  console.log(`Found ${products.length} products without blog articles (limit ${limit})`)

  const results = []
  for (const product of products) {
    try {
      console.log(`Generating: ${product.name}`)
      const article = await generateProductArticleDraft(product)
      results.push({ productId: product._id, articleId: article._id, title: article.title, ok: true })
    } catch (err) {
      results.push({ productId: product._id, productName: product.name, ok: false, error: err.message })
    }
  }

  console.log(JSON.stringify({
    attempted: products.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  }, null, 2))

  process.exit(results.some((r) => !r.ok) ? 1 : 0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
