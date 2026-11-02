const { isCrawlerRequest, isBlacklistedPath } = require('../config/crawlerUserAgents')
const {
  isCompoundingGuidePath,
  renderBotCompoundingGuidePage,
} = require('../services/botCompoundingGuideHtml')

/**
 * Crawlers on the legacy Zyro compounding guide URL get server-injected HTML.
 */
function createBotCompoundingGuidePrerender(clientDist) {
  return function botCompoundingGuidePrerender(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!isCrawlerRequest(req)) return next()
    if (isBlacklistedPath(req.path)) return next()
    if (!isCompoundingGuidePath(req.path)) return next()

    try {
      const { status, html } = renderBotCompoundingGuidePage(clientDist)
      res.status(status)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('X-Robots-Tag', 'index, follow')
      res.setHeader('X-Rendered-By', 'estore-bot-compounding-guide')
      if (req.method === 'HEAD') return res.end()
      return res.send(html)
    } catch (err) {
      console.error('Bot compounding guide prerender failed:', err.message)
      return next(err)
    }
  }
}

module.exports = createBotCompoundingGuidePrerender
