const { isCrawlerRequest, isBlacklistedPath } = require('../config/crawlerUserAgents')
const { renderBotProductPage } = require('../services/botProductHtml')

const PRODUCT_PATH = /^\/product\/([^/]+)\/?$/

/**
 * Crawlers on /product/:slug get server-injected HTML (meta, JSON-LD, visible snapshot).
 * Humans pass through to Vite/static SPA.
 */
function createBotProductPrerenderMiddleware(clientDist) {
  return async function botProductPrerender(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!isCrawlerRequest(req)) return next()
    if (isBlacklistedPath(req.path)) return next()

    const match = req.path.match(PRODUCT_PATH)
    if (!match) return next()

    try {
      const { status, html } = await renderBotProductPage(match[1], clientDist)
      res.status(status)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('X-Rendered-By', 'estore-bot-product')
      if (req.method === 'HEAD') return res.end()
      return res.send(html)
    } catch (err) {
      console.error('Bot product prerender failed:', err.message)
      return next(err)
    }
  }
}

module.exports = createBotProductPrerenderMiddleware
