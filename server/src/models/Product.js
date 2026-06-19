const mongoose = require('mongoose')
const { generateUniqueSlug } = require('../utils/productSlug')
const { generateProductTags } = require('../utils/generateProductTags')
const { normalizeSku } = require('../utils/normalizeProductFields')

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  source: { type: String, enum: ['upload', 'link', 'local', 'serper'], default: 'link' },
  publicId: { type: String, default: '' },
})

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  options: [{ type: String }],
})

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    comparePrice: { type: Number, default: 0 },
    category: { type: String, default: 'Uncategorized', trim: true },
    tags: [{ type: String, trim: true }],
    images: [imageSchema],
    stock: { type: Number, required: true, default: 0, min: 0 },
    sku: { type: String, unique: true, sparse: true, trim: true },
    barcode: { type: String, default: '' },
    variants: [variantSchema],
    weight: { type: Number, default: 0 },
    dimensions: {
      length: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    isPublished: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Text index for fast candidate retrieval (name, description, category)
productSchema.index({ name: 'text', description: 'text', category: 'text' })
productSchema.index({ isPublished: 1, name: 1 })
productSchema.index({ isPublished: 1, category: 1 })

productSchema.pre('save', async function () {
  const sku = normalizeSku(this.sku)
  if (sku) this.sku = sku
  else this.sku = undefined

  if (!this.slug && this.name) {
    this.slug = await generateUniqueSlug(this.constructor, this.name, {
      excludeId: this._id,
    })
  }

  if (!this.tags?.length) {
    this.tags = generateProductTags({
      name: this.name,
      description: this.description,
      category: this.category,
    })
  }
})

productSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate()
  if (!update) return

  const target = update.$set || update
  if (!('sku' in target)) return

  const sku = normalizeSku(target.sku)
  if (sku) {
    target.sku = sku
    return
  }

  delete target.sku
  update.$unset = { ...(update.$unset || {}), sku: 1 }
  if (!update.$set) update.$set = target
})

module.exports = mongoose.model('Product', productSchema)
