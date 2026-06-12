const fs = require('fs')
const path = require('path')
const BlogArticle = require('../models/BlogArticle')
const Product = require('../models/Product')
const escapeHtml = require('../utils/escapeHtml')
const { stripMarkdown } = require('../utils/blogMarkdown')
const {
  buildArticleMeta,
  buildNewsArticleJsonLd,
  buildFaqJsonLd,
  buildArticleBreadcrumbJsonLd,
  getBlogBasePath,
  slugifyCategory,
} = require('../utils/blogSeo')

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

async function findPublishedArticle(category, slug) {
  return BlogArticle.findOne({
    status: 'published',
    category: slugifyCategory(category),
    slug,
  }).populate('product', 'name slug category tags')
}

function stripDefaultSeoTags(html) {
  return html
    .replace(/\s*<meta\s+name="(?:description|keywords|robots|publisher|twitter:card|twitter:title|twitter:description|twitter:image)"[^>]*>\s*/gi, '\n')
    .replace(/\s*<meta\s+property="(?:og:title|og:description|og:image|og:type|og:url)"[^>]*>\s*/gi, '\n')
    .replace(/\s*<link\s+rel="canonical"[^>]*>\s*/gi, '\n')
    .replace(/\s*<script[^>]*id="jsonld-organization"[^>]*>[\s\S]*?<\/script>\s*/gi, '\n')
}

function buildHeadInjection(meta, article, product) {
  const newsLd = JSON.stringify(buildNewsArticleJsonLd(article, product)).replace(/</g, '\\u003c')
  const breadcrumbLd = JSON.stringify(buildArticleBreadcrumbJsonLd(article)).replace(/</g, '\\u003c')
  const faqLdObj = buildFaqJsonLd(article)
  const faqLd = faqLdObj
    ? `<script type="application/ld+json" id="jsonld-faq" data-bot-seo="true">${JSON.stringify(faqLdObj).replace(/</g, '\\u003c')}</script>`
    : ''

  return `
    <meta name="description" content="${escapeHtml(meta.description)}" data-bot-seo="true" />
    <meta name="keywords" content="${escapeHtml(meta.keywords.join(', '))}" data-bot-seo="true" />
    <meta name="robots" content="${escapeHtml(meta.robots)}" data-bot-seo="true" />
    <meta name="publisher" content="${escapeHtml(meta.publisher)}" data-bot-seo="true" />
    <link rel="canonical" href="${escapeHtml(meta.canonical)}" data-bot-seo="true" />
    <meta property="og:title" content="${escapeHtml(meta.og.title)}" data-bot-seo="true" />
    <meta property="og:description" content="${escapeHtml(meta.og.description)}" data-bot-seo="true" />
    <meta property="og:image" content="${escapeHtml(meta.og.image)}" data-bot-seo="true" />
    <meta property="og:type" content="${escapeHtml(meta.og.type)}" data-bot-seo="true" />
    <meta property="og:url" content="${escapeHtml(meta.og.url)}" data-bot-seo="true" />
    <meta name="twitter:card" content="${escapeHtml(meta.twitter.card)}" data-bot-seo="true" />
    <meta name="twitter:title" content="${escapeHtml(meta.twitter.title)}" data-bot-seo="true" />
    <meta name="twitter:description" content="${escapeHtml(meta.twitter.description)}" data-bot-seo="true" />
    <meta name="twitter:image" content="${escapeHtml(meta.twitter.image)}" data-bot-seo="true" />
    <script type="application/ld+json" id="jsonld-newsarticle" data-bot-seo="true">${newsLd}</script>
    <script type="application/ld+json" id="jsonld-breadcrumb" data-bot-seo="true">${breadcrumbLd}</script>
    ${faqLd}
  `
}

function buildBodySnapshot(article) {
  const excerpt = escapeHtml(stripMarkdown(article.content).slice(0, 500))
  const image = escapeHtml(article.image_url || '')
  const takeaways = (article.key_takeaways || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('')

  return `
    <main data-prerender="blog" id="prerender-blog">
      <article>
        <h1>${escapeHtml(article.title)}</h1>
        ${image ? `<img src="${image}" alt="${escapeHtml(article.title)}" width="800" height="450" />` : ''}
        ${takeaways ? `<section><h2>TL;DR</h2><ul>${takeaways}</ul></section>` : ''}
        <p>${excerpt}</p>
      </article>
    </main>
  `
}

function injectArticleHtml(template, article, product) {
  const meta = buildArticleMeta(article, product)
  let html = stripDefaultSeoTags(template)
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
  html = html.replace('</head>', `${buildHeadInjection(meta, article, product)}\n</head>`)
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root">${buildBodySnapshot(article)}</div>`
  )
  return html
}

async function renderBotBlogPage(category, slug, clientDist) {
  const template = loadIndexTemplate(clientDist)
  if (!template) {
    return { status: 500, html: '<!DOCTYPE html><html><body>Template not found</body></html>' }
  }

  const article = await findPublishedArticle(category, slug)
  if (!article) {
    return { status: 404, html: template }
  }

  const product = article.product || null
  const html = injectArticleHtml(template, article, product)
  return { status: 200, html }
}

module.exports = {
  renderBotBlogPage,
  getBlogArticlePathPattern: () => {
    const base = getBlogBasePath().replace(/^\//, '')
    return new RegExp(`^/${base}/([^/]+)/([^/]+)/?$`)
  },
}
