const { isCrawlerRequest, isBlacklistedPath } = require('../config/crawlerUserAgents')
const { renderBotBlogPage, getBlogArticlePathPattern } = require('../services/botBlogHtml')

/**
 * Crawlers on /blog/:category/:slug get server-injected HTML.
 */
function createBotBlogPrerenderMiddleware(clientDist) {
  const blogPathPattern = getBlogArticlePathPattern()

  return async function botBlogPrerender(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!isCrawlerRequest(req)) return next()
    if (isBlacklistedPath(req.path)) return next()

    const match = req.path.match(blogPathPattern)
    if (!match) return next()

    try {
      const { status, html } = await renderBotBlogPage(match[1], match[2], clientDist)
      res.status(status)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('X-Robots-Tag', 'index, follow')
      res.setHeader('X-Rendered-By', 'estore-bot-blog')
      if (req.method === 'HEAD') return res.end()
      return res.send(html)
    } catch (err) {
      console.error('Bot blog prerender failed:', err.message)
      return next(err)
    }
  }
}

module.exports = createBotBlogPrerenderMiddleware
