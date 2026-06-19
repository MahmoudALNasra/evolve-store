const express = require('express')
const mongoose = require('mongoose')
const XLSX = require('xlsx')
const ExcelJS = require('exceljs')
const Product = require('../models/Product')
const Category = require('../models/Category')
const { assignSlugsToProducts } = require('../utils/productSlug')
const { searchProducts, searchProductsPaginated } = require('../services/productSearchService')
const { getProductRecommendations } = require('../services/productRecommendationsService')
const applyAutoTagsToPayload = require('../utils/applyProductTags')
const { normalizeProductPayload } = require('../utils/normalizeProductFields')
const { getStorefrontCategoryNames } = require('../services/categoryListService')
const { protect, admin } = require('../middleware/auth')
const { upload, uploadExcel } = require('../config/cloudinary')

const reviewRoutes = require('./reviewRoutes')

const router = express.Router()

function normalizeCategoryName(category) {
  return String(category || '').trim() || 'Uncategorized'
}

async function ensureCategoriesExist(categoryNames = []) {
  const names = [...new Set(categoryNames.map(normalizeCategoryName).filter(Boolean))]
  if (!names.length) return []

  const results = await Promise.all(
    names.map((name) =>
      Category.updateOne(
        { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { $setOnInsert: { name, description: '' } },
        { upsert: true }
      )
    )
  )

  return {
    names,
    created: results.reduce((sum, result) => sum + (result.upsertedCount || 0), 0),
  }
}

// ── Public ──────────────────────────────────────────────────

// GET /api/products
router.get('/', async (req, res) => {
  const { search, category, minPrice, maxPrice, featured, page = 1, limit = 20, sort = '-createdAt' } = req.query

  if (search && String(search).trim().length >= 2) {
    const { products, total } = await searchProductsPaginated(search, {
      page: Number(page),
      limit: Number(limit),
      sort,
      category,
      minPrice,
      maxPrice,
      featured,
    })
    return res.json({
      products,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
    })
  }

  const filter = { isPublished: true }
  if (category) filter.category = { $regex: category, $options: 'i' }
  if (minPrice || maxPrice) {
    filter.price = {}
    if (minPrice) filter.price.$gte = Number(minPrice)
    if (maxPrice) filter.price.$lte = Number(maxPrice)
  }
  if (featured === 'true') filter.isFeatured = true

  const skip = (Number(page) - 1) * Number(limit)
  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(Number(limit)),
    Product.countDocuments(filter),
  ])

  res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
})

// GET /api/products/search?q=… — typo-tolerant suggestions for the navbar dropdown
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim()
  const limit = Math.min(Number(req.query.limit) || 8, 20)
  const result = await searchProducts(q, { limit })
  res.json(result)
})

// GET /api/products/categories — names from admin Category collection
router.get('/categories', async (req, res) => {
  const cats = await getStorefrontCategoryNames()
  res.json(cats)
})

// GET /api/products/:slug/reviews
router.use('/:slug/reviews', reviewRoutes)

// GET /api/products/:slug/recommendations — random related products (category + tags)
router.get('/:slug/recommendations', async (req, res) => {
  const { slug } = req.params
  const result = await getProductRecommendations(slug)

  if (result.notFound) {
    return res.status(404).json({ message: 'Product not found', products: [] })
  }

  res.json({ products: result.products })
})

// GET /api/products/:slug
router.get('/:slug', async (req, res) => {
  const { slug } = req.params
  let product = await Product.findOne({ slug })

  // Legacy support: old bookmarked URLs that still use MongoDB ObjectId
  if (
    !product &&
    mongoose.Types.ObjectId.isValid(slug) &&
    String(new mongoose.Types.ObjectId(slug)) === slug
  ) {
    product = await Product.findById(slug)
  }

  if (!product) return res.status(404).json({ message: 'Product not found' })
  res.json(product)
})

// ── Admin ──────────────────────────────────────────────────

// GET /api/products/admin/all  (admin: all products incl. unpublished)
router.get('/admin/all', protect, admin, async (req, res) => {
  const { search, category, page = 1, limit = 20, sort = '-createdAt' } = req.query
  const filter = {}
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { sku: { $regex: search, $options: 'i' } },
    { barcode: { $regex: search, $options: 'i' } },
  ]
  if (category) filter.category = { $regex: category, $options: 'i' }

  const skip = (Number(page) - 1) * Number(limit)
  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(Number(limit)),
    Product.countDocuments(filter),
  ])
  res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
})

// POST /api/products  — create single
router.post('/', protect, admin, async (req, res) => {
  const { payload } = normalizeProductPayload(req.body)
  if (payload.category) await ensureCategoriesExist([payload.category])
  applyAutoTagsToPayload(payload)
  const product = await Product.create(payload)
  res.status(201).json(product)
})

// POST /api/products/upload-image  — upload image to Cloudinary
router.post('/upload-image', protect, admin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' })
  res.json({ url: req.file.path, publicId: req.file.filename, source: 'upload' })
})

// GET /api/products/template/bulk-add  — download Excel template
router.get('/template/bulk-add', protect, admin, async (req, res) => {
  const headers = [
    'name', 'description', 'price', 'comparePrice', 'category', 'tags',
    'sku', 'barcode', 'stock', 'weight', 'isPublished', 'isFeatured', 'imageUrls',
  ]
  const categories = await getStorefrontCategoryNames()
  const example = [
    'Sample Product', 'A great product', 29.99, 39.99, categories[0] || 'Uncategorized', 'tech,gadget',
    'SKU-001', '1234567890', 100, 0.5, true, false, 'https://example.com/img.jpg',
  ]
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Products')
  ws.addRow(headers)
  ws.addRow(example)
  ws.columns = headers.map((header) => ({ header, key: header, width: 22 }))
  ws.getRow(1).font = { bold: true }

  if (categories.length) {
    const categoryWs = wb.addWorksheet('Categories')
    categoryWs.state = 'veryHidden'
    categoryWs.addRow(['Categories'])
    categories.forEach((name) => categoryWs.addRow([name]))
    categoryWs.getColumn(1).width = 32

    for (let row = 2; row <= 1000; row += 1) {
      ws.getCell(`E${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Categories!$A$2:$A$${categories.length + 1}`],
        showErrorMessage: true,
        errorTitle: 'Unknown category',
        error: 'Select an existing category or type a new one. New categories are created during import.',
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  res.setHeader('Content-Disposition', 'attachment; filename=bulk-add-template.xlsx')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

// GET /api/products/template/bulk-restock  — download restock template
router.get('/template/bulk-restock', protect, admin, (req, res) => {
  const headers = ['sku', 'qty_to_add']
  const example = ['SKU-001', 50]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws['!cols'] = [{ wch: 20 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Restock')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', 'attachment; filename=bulk-restock-template.xlsx')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

// POST /api/products/bulk  — bulk create via Excel
router.post('/bulk', protect, admin, uploadExcel.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No Excel file uploaded' })

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws)

  if (!rows.length) return res.status(400).json({ message: 'Excel file is empty' })

  const products = rows.map((row) => ({
    name: row.name || '',
    description: row.description || '',
    price: Number(row.price) || 0,
    comparePrice: Number(row.comparePrice) || 0,
    category: normalizeCategoryName(row.category),
    tags: row.tags ? String(row.tags).split(',').map((t) => t.trim()) : [], // auto-filled below if empty
    sku: String(row.sku || '').trim() || undefined,
    barcode: row.barcode || '',
    stock: Number(row.stock) || 0,
    weight: Number(row.weight) || 0,
    isPublished: String(row.isPublished).toLowerCase() === 'true',
    isFeatured: String(row.isFeatured).toLowerCase() === 'true',
    images: row.imageUrls
      ? String(row.imageUrls).split(',').map((u) => ({ url: u.trim(), source: 'link' }))
      : [],
  }))

  const categoryResult = await ensureCategoriesExist(products.map((product) => product.category))
  products.forEach(applyAutoTagsToPayload)
  await assignSlugsToProducts(Product, products)
  const inserted = await Product.insertMany(products, { ordered: false })
  res.status(201).json({
    inserted: inserted.length,
    categoriesCreated: categoryResult.created,
    message: `${inserted.length} products created`,
  })
})

// POST /api/products/bulk-restock  — bulk restock via Excel
router.post('/bulk-restock', protect, admin, uploadExcel.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No Excel file uploaded' })

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws)

  if (!rows.length) return res.status(400).json({ message: 'Excel file is empty' })

  const results = { updated: 0, notFound: [] }
  for (const row of rows) {
    const sku = String(row.sku || '').trim()
    const qty = Number(row.qty_to_add) || 0
    if (!sku || qty <= 0) continue
    const product = await Product.findOneAndUpdate(
      { sku },
      { $inc: { stock: qty } },
      { returnDocument: 'after' }
    )
    if (product) results.updated++
    else results.notFound.push(sku)
  }

  res.json(results)
})

// PUT /api/products/:id  — update
router.put('/:id', protect, admin, async (req, res) => {
  const { payload, unsetSku } = normalizeProductPayload(req.body)
  if (payload.category) await ensureCategoriesExist([payload.category])
  applyAutoTagsToPayload(payload)
  const update = unsetSku ? { $set: payload, $unset: { sku: 1 } } : payload
  const product = await Product.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true })
  if (!product) return res.status(404).json({ message: 'Product not found' })
  res.json(product)
})

// PUT /api/products/:id/restock  — increment stock
router.put('/:id/restock', protect, admin, async (req, res) => {
  const { qty } = req.body
  if (!qty || qty <= 0) return res.status(400).json({ message: 'qty must be a positive number' })
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $inc: { stock: Number(qty) } },
    { returnDocument: 'after' }
  )
  if (!product) return res.status(404).json({ message: 'Product not found' })
  res.json(product)
})

// DELETE /api/products/:id
router.delete('/:id', protect, admin, async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id)
  if (!product) return res.status(404).json({ message: 'Product not found' })
  res.json({ message: 'Product deleted' })
})

module.exports = router
