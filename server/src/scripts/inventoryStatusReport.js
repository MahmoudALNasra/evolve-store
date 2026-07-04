/**
 * Full inventory status report — what's on the website RIGHT NOW.
 *
 *   npm run inventory:status
 *   npm run inventory:status -- --csv /root/mongo-backups/inventory-now.csv
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const connectDB = require('../config/db')
const Product = require('../models/Product')

function parseArgs(argv) {
  const csvIdx = argv.indexOf('--csv')
  const stamp = new Date().toISOString().slice(0, 10)
  return {
    csvPath: csvIdx >= 0
      ? path.resolve(argv[csvIdx + 1])
      : path.join(__dirname, '../../data/inventory-status.csv'),
    stamp,
  }
}

function csvEscape(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(rows, headers) {
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','))
  }
  return lines.join('\n')
}

async function main() {
  const { csvPath } = parseArgs(process.argv.slice(2))
  await connectDB()

  const products = await Product.find({}).sort({ name: 1 }).lean()

  const summary = {
    total: products.length,
    published: 0,
    unpublished: 0,
    inStock: 0,
    outOfStock: 0,
    withBarcode: 0,
    withoutBarcode: 0,
    withImages: 0,
    withoutImages: 0,
    zeroPrice: 0,
  }

  const categories = new Map()
  const rows = []

  for (const p of products) {
    const imageCount = Array.isArray(p.images) ? p.images.length : 0
    const hasBarcode = Boolean(String(p.barcode || '').trim())

    if (p.isPublished) summary.published += 1
    else summary.unpublished += 1

    if (Number(p.stock) > 0) summary.inStock += 1
    else summary.outOfStock += 1

    if (hasBarcode) summary.withBarcode += 1
    else summary.withoutBarcode += 1

    if (imageCount > 0) summary.withImages += 1
    else summary.withoutImages += 1

    if (!Number(p.price)) summary.zeroPrice += 1

    const cat = p.category || 'Uncategorized'
    categories.set(cat, (categories.get(cat) || 0) + 1)

    rows.push({
      name: p.name,
      barcode: p.barcode || '',
      sku: p.sku || '',
      price: p.price,
      comparePrice: p.comparePrice || 0,
      stock: p.stock,
      published: p.isPublished ? 'yes' : 'no',
      category: cat,
      images: imageCount,
      slug: p.slug || '',
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
    })
  }

  const topCategories = [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }))

  fs.mkdirSync(path.dirname(csvPath), { recursive: true })
  const headers = ['name', 'barcode', 'sku', 'price', 'comparePrice', 'stock', 'published', 'category', 'images', 'slug', 'updatedAt']
  fs.writeFileSync(csvPath, toCsv(rows, headers))

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary,
    topCategories,
    csv: csvPath,
    nextSteps: [
      'Open the CSV in Excel/Google Sheets — this is your current website catalog.',
      'Do NOT run inventory:restore-from-sheet or inventory:reconcile-from-sheet.',
      'Edit prices/names in admin OR in the CSV then bulk-import.',
      'Only run inventory:sync after the Google Sheet is corrected (prices are NOT overwritten by default).',
    ],
  }, null, 2))

  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
