const express = require('express')
const Category = require('../models/Category')
const Product = require('../models/Product')
const { protect, admin } = require('../middleware/auth')
const { auditWriteLogger } = require('../middleware/auditWriteLogger')

const router = express.Router()
router.use(auditWriteLogger({ actorType: 'admin' }))

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 })
    res.json(categories)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Create category (admin only)
router.post('/', protect, admin, async (req, res) => {
  try {
    const { name, description } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'Category name is required' })

    const exists = await Category.findOne({ name: name.trim() })
    if (exists) return res.status(400).json({ message: 'Category already exists' })

    const category = new Category({ name: name.trim(), description: description?.trim() || '' })
    await category.save()
    res.status(201).json(category)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Update category (admin only)
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { name, description } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'Category name is required' })

    const category = await Category.findById(req.params.id)
    if (!category) return res.status(404).json({ message: 'Category not found' })

    const exists = await Category.findOne({ name: name.trim(), _id: { $ne: req.params.id } })
    if (exists) return res.status(400).json({ message: 'Category name already exists' })

    const previousName = category.name
    const nextName = name.trim()
    category.name = nextName
    category.description = description?.trim() || ''
    await category.save()

    if (previousName !== nextName) {
      await Product.updateMany({ category: previousName }, { $set: { category: nextName } })
    }
    res.json(category)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Delete category (admin only)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
    if (!category) return res.status(404).json({ message: 'Category not found' })

    await category.deleteOne()
    res.json({ message: 'Category deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
