const prerender = require('prerender-node')
const {
  CRAWLER_USER_AGENTS,
  isBlacklistedPath,
  PRERENDER_BLACKLIST,
} = require('../config/crawlerUserAgents')

let prerenderConfigured = false

/**
 * prerender-node: proxies crawler requests to a headless render service
 * (Prerender.io or self-hosted). Humans always pass through (next()).
 */
function createPrerenderMiddleware() {
  const serviceUrl = process.env.PRERENDER_SERVICE_URL
  const enabled =
    process.env.PRERENDER_ENABLED === 'true' ||
    (process.env.PRERENDER_ENABLED !== 'false' && Boolean(serviceUrl))

  if (!enabled) {
    return function prerenderDisabled(req, res, next) {
      next()
    }
  }

  if (!prerenderConfigured) {
    prerender.set('prerenderServiceUrl', serviceUrl || 'https://service.prerender.io')
    if (process.env.PRERENDER_TOKEN) {
      prerender.set('prerenderToken', process.env.PRERENDER_TOKEN)
    }

    prerender.set('crawlerUserAgents', CRAWLER_USER_AGENTS)
    prerender.set('forwardHeaders', true)

    if (process.env.PRERENDER_PROTOCOL) {
      prerender.set('protocol', process.env.PRERENDER_PROTOCOL)
    }

    prerender.blacklisted(PRERENDER_BLACKLIST.map((re) => re.source))
    prerenderConfigured = true
  }

  prerender.set('prerenderShouldCrawl', (url) => {
    try {
      const pathname = new URL(url).pathname
      if (isBlacklistedPath(pathname)) return false
      // Product pages use faster server-side HTML injection
      if (/^\/product\/[^/]+\/?$/.test(pathname)) return false
      return true
    } catch {
      return false
    }
  })

  return prerender
}

module.exports = createPrerenderMiddleware
