const path = require('path')
const express = require('express')
const fs = require('fs')
const { isCrawlerRequest } = require('../config/crawlerUserAgents')

/** Do not SPA-fallback for API. React admin is at /admin/* and needs index.html on refresh. */
function shouldSpaFallback(pathname) {
  return !/^\/api\b/.test(pathname)
}

function getPublicOrigin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '')
  if (process.env.CLIENT_URL) return process.env.CLIENT_URL.replace(/\/$/, '')
  return `${req.protocol}://${req.get('host')}`
}

function renderSpaShell(indexPath, req) {
  const origin = getPublicOrigin(req)
  const pathname = req.path === '/' ? '/' : req.path.replace(/\/$/, '')
  const canonical = `${origin}${pathname === '/' ? '' : pathname}`
  const logoUrl = `${origin}/logo.png`

  return fs.readFileSync(indexPath, 'utf8')
    .replace(/<link rel="canonical" href="[^"]*" \/>/i, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/i, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta property="og:image" content="[^"]*" \/>/i, `<meta property="og:image" content="${logoUrl}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/i, `<meta name="twitter:image" content="${logoUrl}" />`)
    .replace(/"url":\s*"[^"]*"/i, `"url": "${origin}"`)
    .replace(/"logo":\s*"[^"]*"/i, `"logo": "${logoUrl}"`)
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
      res.setHeader('X-Robots-Tag', 'index, follow')
      if (isCrawlerRequest(req)) {
        res.setHeader('X-Rendered-By', 'estore-spa-shell')
      }
      if (req.method === 'HEAD') return res.end()
      return res.send(renderSpaShell(indexPath, req))
    })
  }
}

module.exports = createSpaMiddleware
