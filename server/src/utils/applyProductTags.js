const { generateProductTags } = require('./generateProductTags')

/**
 * Apply auto-tags to a product payload before create/update (keeps manual tags).
 */
function applyAutoTagsToPayload(body) {
  if (!body || typeof body !== 'object') return body

  const tags = Array.isArray(body.tags)
    ? body.tags
    : typeof body.tags === 'string'
      ? body.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : []

  body.tags = generateProductTags({
    name: body.name,
    description: body.description,
    category: body.category,
    tags,
  })

  return body
}

module.exports = applyAutoTagsToPayload
