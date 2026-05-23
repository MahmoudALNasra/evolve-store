const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const Product = require('../models/Product')
const escapeHtml = require('../utils/escapeHtml')
const {
  buildProductMeta,
  buildProductJsonLd,
  buildBreadcrumbJsonLd,
  getProductImages,
  getProductDescription,
} = require('../utils/productSeoServer')

let cachedIndexHtml = null
let cachedIndexPath = null

function resolveIndexHtmlPath(clientDist) {
  const distIndex = path.join(clientDist, 'index.html')
  if (fs.existsSync(distIndex)) return distIndex
  const devIndex = path.join(clientDist, '..', 'index.html')
  if (fs.existsSync(devIndex)) return devIndex
  return null
}

function loadIndexTemplate(clientDist) {
  const indexPath = resolveIndexHtmlPath(clientDist)
  if (!indexPath) return null
  if (cachedIndexPath === indexPath && cachedIndexHtml) return cachedIndexHtml
  cachedIndexHtml = fs.readFileSync(indexPath, 'utf8')
  cachedIndexPath = indexPath
  return cachedIndexHtml
}

async function findPublishedProduct(slug) {
  let product = await Product.findOne({ slug, isPublished: true })
  if (
    !product &&
    mongoose.Types.ObjectId.isValid(slug) &&
    String(new mongoose.Types.ObjectId(slug)) === slug
  ) {
    product = await Product.findOne({ _id: slug, isPublished: true })
  }
  return product
}

function buildHeadInjection(meta, product) {
  const productLd = JSON.stringify(buildProductJsonLd(product)).replace(/</g, '\\u003c')
  const breadcrumbLd = JSON.stringify(buildBreadcrumbJsonLd(product)).replace(/</g, '\\u003c')

  return `
    <meta name="description" content="${escapeHtml(meta.description)}" data-bot-seo="true" />
    <link rel="canonical" href="${escapeHtml(meta.canonical)}" data-bot-seo="true" />
    <meta property="og:title" content="${escapeHtml(meta.og.title)}" data-bot-seo="true" />
    <meta property="og:description" content="${escapeHtml(meta.og.description)}" data-bot-seo="true" />
    <meta property="og:image" content="${escapeHtml(meta.og.image)}" data-bot-seo="true" />
    <meta property="og:type" content="${escapeHtml(meta.og.type)}" data-bot-seo="true" />
    <meta property="og:url" content="${escapeHtml(meta.og.url)}" data-bot-seo="true" />
    <meta property="product:price:amount" content="${escapeHtml(meta.og.priceAmount)}" data-bot-seo="true" />
    <meta property="product:price:currency" content="${escapeHtml(meta.og.priceCurrency)}" data-bot-seo="true" />
    <meta name="twitter:card" content="${escapeHtml(meta.twitter.card)}" data-bot-seo="true" />
    <meta name="twitter:title" content="${escapeHtml(meta.twitter.title)}" data-bot-seo="true" />
    <meta name="twitter:description" content="${escapeHtml(meta.twitter.description)}" data-bot-seo="true" />
    <meta name="twitter:image" content="${escapeHtml(meta.twitter.image)}" data-bot-seo="true" />
    <script type="application/ld+json" id="jsonld-product" data-bot-seo="true">${productLd}</script>
    <script type="application/ld+json" id="jsonld-breadcrumb" data-bot-seo="true">${breadcrumbLd}</script>
  `
}

function buildBodySnapshot(product) {
  const images = getProductImages(product)
  const description = escapeHtml(getProductDescription(product))
  const price = Number(product.price).toFixed(2)
  const img = escapeHtml(images[0])

  return `
    <main data-prerender="product" id="prerender-product">
      <article>
        <h1>${escapeHtml(product.name)}</h1>
        <p>${description}</p>
        <p><strong>$${price}</strong> USD</p>
        <img src="${img}" alt="${escapeHtml(product.name)}" width="600" height="600" />
        ${product.category ? `<p>Category: ${escapeHtml(product.category)}</p>` : ''}
      </article>
    </main>
  `
}

function injectProductHtml(template, product) {
  const meta = buildProductMeta(product)
  const headInjection = buildHeadInjection(meta, product)
  const bodySnapshot = buildBodySnapshot(product)

  let html = template.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
  html = html.replace('</head>', `${headInjection}\n  </head>`)
  html = html.replace(
    /<div id="root"><\/div>/i,
    `<div id="root">${bodySnapshot}</div>`
  )
  return html
}

function injectNotFoundHtml(template) {
  const title = 'Product Not Found | Evolve Specialty Pharmacy & Wellness'
  let html = template.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
  html = html.replace(
    /<div id="root"><\/div>/i,
    `<div id="root"><main data-prerender="404"><h1>Product not found</h1></main></div>`
  )
  return html
}

/**
 * Render fully-formed HTML for crawlers on /product/:slug (no headless browser).
 */
async function renderBotProductPage(slug, clientDist) {
  const template = loadIndexTemplate(clientDist)
  if (!template) {
    throw new Error('index.html not found — run: cd client && npm run build')
  }

  const product = await findPublishedProduct(slug)
  if (!product) {
    return { status: 404, html: injectNotFoundHtml(template) }
  }

  return { status: 200, html: injectProductHtml(template, product) }
}

module.exports = {
  renderBotProductPage,
  loadIndexTemplate,
  resolveIndexHtmlPath,
}
