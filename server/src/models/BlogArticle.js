const mongoose = require('mongoose')
const { generateShareId } = require('../utils/blogShareId')
const { slugifyCategory } = require('../utils/blogSeo')
const { slugify } = require('../utils/productSlug')

const blogArticleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    content: { type: String, default: '' },
    meta_description: { type: String, default: '', maxlength: 320 },
    key_takeaways: [{ type: String, trim: true }],
    category: { type: String, required: true, trim: true, lowercase: true },
    source_name: { type: String, default: 'Evolve Specialty Pharmacy & Wellness', trim: true },
    source_url: { type: String, default: '' },
    image_url: { type: String, default: '' },
    share_id: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    published_at: { type: Date, default: null },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
    topic: { type: String, default: '', trim: true },
    article_type: { type: String, enum: ['product', 'editorial', 'topic'], default: 'editorial' },
    generation_prompt: { type: String, default: '' },
    regeneration_of: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogArticle', default: null },
    seo_keywords: [{ type: String, trim: true }],
  },
  { timestamps: true }
)

blogArticleSchema.index({ status: 1, category: 1, published_at: -1 })
blogArticleSchema.index({ category: 1, slug: 1 }, { unique: true })
blogArticleSchema.index({ title: 'text', content: 'text', category: 'text' })

async function generateUniqueBlogSlug(BlogArticle, title, category, excludeId) {
  const base = slugify(title)
  let candidate = base
  let suffix = 2

  while (true) {
    const query = { slug: candidate, category: String(category || '').trim().toLowerCase() }
    if (excludeId) query._id = { $ne: excludeId }
    const exists = await BlogArticle.exists(query)
    if (!exists) return candidate
    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

blogArticleSchema.pre('validate', async function () {
  if (!this.share_id) {
    this.share_id = await generateShareId(this.constructor)
  }

  if (this.category) {
    this.category = slugifyCategory(this.category)
  }

  if (!this.slug && this.title) {
    this.slug = await generateUniqueBlogSlug(this.constructor, this.title, this.category, this._id)
  }

  if (this.status === 'published' && !this.published_at) {
    this.published_at = new Date()
  }

  if (this.status === 'draft') {
    this.published_at = null
  }
})

module.exports = mongoose.model('BlogArticle', blogArticleSchema)
module.exports.generateUniqueBlogSlug = generateUniqueBlogSlug
