const jwt = require('jsonwebtoken')

const TOKEN_TTL = '30m'

function signShippingRateSelection(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL })
}

function verifyShippingRateSelection(token) {
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return null
  }
}

module.exports = { signShippingRateSelection, verifyShippingRateSelection }
