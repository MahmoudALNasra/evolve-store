require('dotenv').config()
const connectDB = require('../config/db')
const { auditProductsBatch } = require('../services/productImageAuditService')

function parseArgs(argv) {
  const args = { limit: Number(process.env.BLOG_BATCH_LIMIT || 50) }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--limit' && argv[i + 1]) {
      args.limit = Number(argv[i + 1])
      i += 1
    }
    if (argv[i] === '--missing-only') {
      args.onlyMissingImages = true
    }
  }
  return args
}

async function main() {
  const { limit, onlyMissingImages } = parseArgs(process.argv.slice(2))
  await connectDB()

  const result = await auditProductsBatch({ limit, onlyMissingImages })
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
