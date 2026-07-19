/**
 * Lightweight security headers (no extra dependency).
 * Complements nginx TLS; safe defaults for an API + SPA.
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-DNS-Prefetch-Control', 'off')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)'
  )

  // CSP is intentionally loose for the SPA (inline GTM/consent); tighten later if needed.
  if (!req.path.startsWith('/api')) {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'self'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' https://fonts.gstatic.com data:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://js.stripe.com",
        "connect-src 'self' https: wss:",
        "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      ].join('; ')
    )
  }

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  }

  next()
}

module.exports = securityHeaders
