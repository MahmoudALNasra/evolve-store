const crypto = require('crypto')

const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'

function randomShareId(length = 8) {
  const bytes = crypto.randomBytes(length)
  let id = ''
  for (let i = 0; i < length; i += 1) {
    id += CHARSET[bytes[i] % CHARSET.length]
  }
  return id
}

async function generateShareId(BlogArticle, length = 8) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = randomShareId(length)
    const exists = await BlogArticle.exists({ share_id: candidate })
    if (!exists) return candidate
  }
  return `${randomShareId(6)}${Date.now().toString(36).slice(-2)}`
}

module.exports = { randomShareId, generateShareId }
