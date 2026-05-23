const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
const MAX_UTM_LEN = 512

/**
 * Extract and sanitize UTM fields from the request body.
 * @returns {Record<string, string>}
 */
function extractUtmsFromBody(body) {
  const utm = {}
  if (!body || typeof body !== 'object') return utm

  for (const field of UTM_FIELDS) {
    const value = body[field]
    if (value == null) continue
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) utm[field] = trimmed.slice(0, MAX_UTM_LEN)
  }

  return utm
}

function extractUtmsFromQuery(query = {}) {
  const utm = {}
  if (!query || typeof query !== 'object') return utm

  for (const field of UTM_FIELDS) {
    const value = query[field]
    if (value == null) continue
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) utm[field] = trimmed.slice(0, MAX_UTM_LEN)
  }

  return utm
}

module.exports = { UTM_FIELDS, extractUtmsFromBody, extractUtmsFromQuery }
