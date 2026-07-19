/**
 * Strip Mongo operator injection keys ($gt, $ne, …) from req.body / query / params.
 * This app uses MongoDB (not SQL); classic SQL injection does not apply to Mongoose queries,
 * but NoSQL operator injection does.
 */

function stripOperators(value, depth = 0) {
  if (value == null || depth > 8) return value
  if (Array.isArray(value)) {
    return value.map((item) => stripOperators(item, depth + 1))
  }
  if (typeof value !== 'object') return value

  const out = {}
  for (const [key, nested] of Object.entries(value)) {
    // Block Mongo operators ($gt, $ne, $where, …) and prototype pollution keys
    if (key.startsWith('$') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue
    }
    out[key] = stripOperators(nested, depth + 1)
  }
  return out
}

function sanitizeRequest(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = stripOperators(req.body)
  }
  if (req.query && typeof req.query === 'object') {
    const cleaned = stripOperators(req.query)
    // Express 4 req.query is a plain object we can mutate
    for (const key of Object.keys(req.query)) {
      delete req.query[key]
    }
    Object.assign(req.query, cleaned)
  }
  if (req.params && typeof req.params === 'object') {
    req.params = stripOperators(req.params)
  }
  next()
}

module.exports = {
  sanitizeRequest,
  stripOperators,
}
