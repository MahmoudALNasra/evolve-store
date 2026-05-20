const express = require('express')
const XLSX = require('xlsx')
const Product = require('../models/Product')
const { protect, admin } = require('../middleware/auth')
const { upload, uploadExcel } = require('../config/cloudinary')

const router = express.Router()

// ── Public ──────────────────────────────────────────────────

// GET /api/products
router.get('/', async (req, res) => {
  const { search, category, minPrice, maxPrice, featured, page = 1, limit = 20, sort = '-createdAt' } = req.query
  const filter = { isPublished: true }

  if (search) filter.$text = { $search: search }
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

// GET /api/products/categories
router.get('/categories', async (req, res) => {
  const cats = await Product.distinct('category', { isPublished: true })
  res.json(cats)
})

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id)
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
  const product = await Product.create(req.body)
  res.status(201).json(product)
})

// POST /api/products/upload-image  — upload image to Cloudinary
router.post('/upload-image', protect, admin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' })
  res.json({ url: req.file.path, publicId: req.file.filename, source: 'upload' })
})

// GET /api/products/template/bulk-add  — download Excel template
router.get('/template/bulk-add', protect, admin, (req, res) => {
  const headers = [
    'name', 'description', 'price', 'comparePrice', 'category', 'tags',
    'sku', 'barcode', 'stock', 'weight', 'isPublished', 'isFeatured', 'imageUrls',
  ]
  const example = [
    'Sample Product', 'A great product', 29.99, 39.99, 'Electronics', 'tech,gadget',
    'SKU-001', '1234567890', 100, 0.5, true, false, 'https://example.com/img.jpg',
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws['!cols'] = headers.map(() => ({ wch: 20 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
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
    category: row.category || 'Uncategorized',
    tags: row.tags ? String(row.tags).split(',').map((t) => t.trim()) : [],
    sku: row.sku || undefined,
    barcode: row.barcode || '',
    stock: Number(row.stock) || 0,
    weight: Number(row.weight) || 0,
    isPublished: String(row.isPublished).toLowerCase() === 'true',
    isFeatured: String(row.isFeatured).toLowerCase() === 'true',
    images: row.imageUrls
      ? String(row.imageUrls).split(',').map((u) => ({ url: u.trim(), source: 'link' }))
      : [],
  }))

  const inserted = await Product.insertMany(products, { ordered: false })
  res.status(201).json({ inserted: inserted.length, message: `${inserted.length} products created` })
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
      { new: true }
    )
    if (product) results.updated++
    else results.notFound.push(sku)
  }

  res.json(results)
})

// PUT /api/products/:id  — update
router.put('/:id', protect, admin, async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
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
    { new: true }
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
