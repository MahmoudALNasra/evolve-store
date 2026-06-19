const express = require('express')
const { getSiteOrigin } = require('../utils/productSeoServer')

const router = express.Router()

function buildRobotsTxt() {
  const origin = getSiteOrigin()
  return [
    'User-agent: *',
    'Allow: /',
    'Allow: /shop',
    'Allow: /product/',
    'Allow: /blog',
    'Disallow: /admin',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /oauth-success',
    'Disallow: /order-success',
    'Disallow: /account',
    'Disallow: /orders',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
}

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(buildRobotsTxt())
})

module.exports = router
