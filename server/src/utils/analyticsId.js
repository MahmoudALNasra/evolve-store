const crypto = require('crypto')

const LOWERCASE_ALNUM = /^[a-z0-9]+$/

/** 32-char lowercase hex (a–z, 0–9). */
function generateAnalyticsId() {
  return crypto.randomBytes(16).toString('hex')
}

function isValidAnalyticsId(value) {
  return typeof value === 'string' && value.length >= 16 && value.length <= 64 && LOWERCASE_ALNUM.test(value)
}

module.exports = { generateAnalyticsId, isValidAnalyticsId, LOWERCASE_ALNUM }
