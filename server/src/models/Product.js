const mongoose = require('mongoose')

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  source: { type: String, enum: ['upload', 'link'], default: 'link' },
  publicId: { type: String, default: '' },
})

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  options: [{ type: String }],
})

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
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

productSchema.index({ name: 'text', description: 'text', tags: 'text' })

module.exports = mongoose.model('Product', productSchema)
