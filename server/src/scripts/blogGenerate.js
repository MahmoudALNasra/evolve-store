require('dotenv').config()
const connectDB = require('../config/db')
const Product = require('../models/Product')
const { generateProductArticleDraft } = require('../services/blogGenerationService')

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--product' && argv[i + 1]) {
      args.productId = argv[i + 1]
      i += 1
    }
  }
  return args
}

async function main() {
  const { productId } = parseArgs(process.argv.slice(2))
  if (!productId) {
    console.error('Usage: npm run blog:generate -- --product <productId>')
    process.exit(1)
  }

  if (process.env.BLOG_GENERATION_ENABLED !== 'true') {
    console.error('Set BLOG_GENERATION_ENABLED=true in server/.env before generating articles.')
    process.exit(1)
  }

  await connectDB()

  const product = await Product.findById(productId)
  if (!product) {
    console.error('Product not found:', productId)
    process.exit(1)
  }

  console.log(`Generating draft for: ${product.name}`)
  const article = await generateProductArticleDraft(product)
  console.log(JSON.stringify({
    id: article._id,
    title: article.title,
    slug: article.slug,
    category: article.category,
    status: article.status,
  }, null, 2))

  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
