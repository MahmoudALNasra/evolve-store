const path = require('path')
const express = require('express')
const fs = require('fs')
const { isCrawlerRequest } = require('../config/crawlerUserAgents')

/** Do not SPA-fallback for API/admin; prerender blacklist also skips .js/.css — must not apply here. */
function shouldSpaFallback(pathname) {
  return !/^\/api\b/.test(pathname) && !/^\/admin\b/.test(pathname)
}

/**
 * Serve Vite build + SPA fallback. Crawlers on non-product routes may be
 * handled earlier by prerender-node; humans always get index.html + client bundle.
 */
function createSpaMiddleware(clientDist) {
  const absoluteDist = path.resolve(clientDist)
  const indexPath = path.join(absoluteDist, 'index.html')
  const indexExists = fs.existsSync(indexPath)

  const staticMiddleware = express.static(absoluteDist, {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  })

  return function serveSpa(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()

    return staticMiddleware(req, res, (err) => {
      if (err) return next(err)
      if (res.headersSent) return
      if (!shouldSpaFallback(req.path)) return next()

      if (!indexExists) {
        return res.status(503).send(
          'SPA not built. Run: cd client && npm run build'
        )
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      if (isCrawlerRequest(req)) {
        res.setHeader('X-Rendered-By', 'estore-spa-shell')
      }
      if (req.method === 'HEAD') return res.end()
      return res.sendFile(indexPath)
    })
  }
}

module.exports = createSpaMiddleware
