const rateLimit = require('express-rate-limit')

const shared = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
}

// Login/register/password brute-force protection.
const authLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 30,
})

// Public forms: contact, newsletter, prescriptions.
const publicFormLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 20,
})

module.exports = { authLimiter, publicFormLimiter }
