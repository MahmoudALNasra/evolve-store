require('dotenv').config()
const connectDB = require('../config/db')
const Product = require('../models/Product')
const { getRelativeProductMediaPrefix } = require('../utils/productMediaPaths')

function toRelativeMediaUrl(url) {
  if (!url || typeof url !== 'string') return url
  const prefix = getRelativeProductMediaPrefix()
  const idx = url.indexOf(prefix)
  if (idx === -1) return url
  return url.slice(idx)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  await connectDB()

  const prefix = getRelativeProductMediaPrefix()
  const products = await Product.find({
    'images.url': { $regex: prefix.replace(/\//g, '\\/') },
  })

  let updated = 0
  let rewritten = 0

  for (const product of products) {
    let changed = false
    const nextImages = (product.images || []).map((img) => {
      const relative = toRelativeMediaUrl(img.url)
      if (relative !== img.url) {
        changed = true
        rewritten += 1
        return { ...img.toObject?.() || img, url: relative }
      }
      return img
    })

    if (changed) {
      updated += 1
      if (!dryRun) {
        product.images = nextImages
        await product.save()
      }
    }
  }

  console.log(JSON.stringify({
    dryRun,
    productsMatched: products.length,
    productsUpdated: updated,
    urlsRewritten: rewritten,
    examplePath: `${prefix}product-slug/product-slug-1-abc123.jpg`,
  }, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
