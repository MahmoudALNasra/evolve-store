const { generateAnalyticsId, isValidAnalyticsId } = require('../utils/analyticsId')

const VISITOR_COOKIE = 'visitor_id'
const SESSION_COOKIE = 'session_id'

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
const SESSION_MS = 30 * 60 * 1000

function cookieOptions(maxAge) {
  const secure =
    process.env.ANALYTICS_COOKIE_SECURE === 'true' ||
    (process.env.ANALYTICS_COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production')

  const options = {
    httpOnly: true,
    secure,
    // Lax works for same-site SPA + HTTPS API on evolvepharmacy.com
    sameSite: process.env.ANALYTICS_COOKIE_SAMESITE || 'lax',
    path: '/',
    maxAge,
  }

  // Optional: share cookies across apex + www (e.g. .evolvepharmacy.com)
  const domain = String(process.env.COOKIE_DOMAIN || '').trim()
  if (domain) options.domain = domain

  return options
}

/**
 * Ensures visitor_id (1y) and session_id (30m, sliding) cookies on the request.
 * Sets refreshed cookies on res; exposes ids on req.analytics.
 */
function analyticsCookies(req, res, next) {
  let visitorId = req.cookies?.[VISITOR_COOKIE]
  if (!isValidAnalyticsId(visitorId)) {
    visitorId = generateAnalyticsId()
    res.cookie(VISITOR_COOKIE, visitorId, cookieOptions(ONE_YEAR_MS))
  }

  let sessionId = req.cookies?.[SESSION_COOKIE]
  if (!isValidAnalyticsId(sessionId)) {
    sessionId = generateAnalyticsId()
  }
  res.cookie(SESSION_COOKIE, sessionId, cookieOptions(SESSION_MS))

  req.analytics = { visitorId, sessionId }
  next()
}

module.exports = analyticsCookies
