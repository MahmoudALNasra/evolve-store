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

// Broad API throttle (scanners / noisy clients). Webhooks are mounted before this.
const apiLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT_PER_MIN) || 300,
  skip: (req) => {
    const url = req.originalUrl || req.url || ''
    return url.startsWith('/api/health') || url.includes('/webhooks')
  },
})

module.exports = { authLimiter, publicFormLimiter, apiLimiter }
