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

// Stricter limit for prescription refill/transfer (bots hammer these).
const prescriptionLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.PRESCRIPTION_RATE_LIMIT_PER_HOUR) || 8,
  message: { message: 'Too many prescription requests from this network. Please try again later or call the pharmacy.' },
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

module.exports = { authLimiter, publicFormLimiter, prescriptionLimiter, apiLimiter }
