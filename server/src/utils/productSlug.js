/**
 * Build a URL-friendly slug from a product name.
 */
function slugify(name) {
  if (!name || typeof name !== 'string') return 'product'
  return (
    name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'product'
  )
}

/**
 * Return a unique slug for a product name (DB + optional in-memory reserved set).
 */
async function generateUniqueSlug(Product, name, options = {}) {
  const { excludeId, reserved = new Set() } = options
  const base = slugify(name)
  let candidate = base
  let suffix = 2

  while (true) {
    if (!reserved.has(candidate)) {
      const query = { slug: candidate }
      if (excludeId) query._id = { $ne: excludeId }
      const exists = await Product.exists(query)
      if (!exists) return candidate
    }
    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

/**
 * Assign unique slugs to an array of product payloads (bulk insert / seed).
 */
async function assignSlugsToProducts(Product, products) {
  const reserved = new Set()
  for (const product of products) {
    if (product.slug) {
      reserved.add(product.slug)
      continue
    }
    const slug = await generateUniqueSlug(Product, product.name, { reserved })
    product.slug = slug
    reserved.add(slug)
  }
  return products
}

module.exports = { slugify, generateUniqueSlug, assignSlugsToProducts }
