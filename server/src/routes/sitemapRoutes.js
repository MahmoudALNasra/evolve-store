const express = require('express')
const { getSitemapXml } = require('../services/sitemapService')

const router = express.Router()

// GET /sitemap.xml
router.get('/sitemap.xml', async (req, res) => {
  const xml = await getSitemapXml()
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.send(xml)
})

module.exports = router
