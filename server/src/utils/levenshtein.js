/**
 * Levenshtein edit distance between two strings (iterative, O(n*m)).
 */
function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const rows = a.length + 1
  const cols = b.length + 1
  const matrix = Array.from({ length: rows }, () => new Array(cols))

  for (let i = 0; i < rows; i++) matrix[i][0] = i
  for (let j = 0; j < cols; j++) matrix[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[rows - 1][cols - 1]
}

/**
 * Minimum Levenshtein distance from query to any token in text (words >= minWordLen).
 */
function minDistanceToText(query, text, maxDistance, minWordLen = 2) {
  const normalized = (text || '').toLowerCase().trim()
  if (!normalized) return Infinity

  const tokens = normalized.split(/\s+/).filter(Boolean)
  let best = levenshtein(query, normalized)

  for (const token of tokens) {
    if (token.length < minWordLen) continue
    if (Math.abs(token.length - query.length) > maxDistance) continue
    best = Math.min(best, levenshtein(query, token))
    if (best === 0) return 0
  }

  if (query.length >= 3 && normalized.length > query.length) {
    const maxLen = query.length + maxDistance
    for (let i = 0; i <= normalized.length - query.length; i++) {
      for (let len = query.length; len <= maxLen && i + len <= normalized.length; len++) {
        const slice = normalized.slice(i, i + len)
        if (Math.abs(slice.length - query.length) > maxDistance) continue
        best = Math.min(best, levenshtein(query, slice))
        if (best <= maxDistance) return best
      }
    }
  }

  return best
}

module.exports = { levenshtein, minDistanceToText }
