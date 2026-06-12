const { extractFaqFromMarkdown, hasFaqSection } = require('./blogMarkdown')

const STORE_NAME = 'Evolve Specialty Pharmacy & Wellness'
const DEFAULT_BLOG_BASE = '/blog'

function getBlogBasePath() {
  const base = process.env.BLOG_PUBLIC_BASE_PATH || DEFAULT_BLOG_BASE
  return base.startsWith('/') ? base.replace(/\/$/, '') : `/${base.replace(/\/$/, '')}`
}

function getSiteOrigin() {
  const url = process.env.SITE_URL || process.env.CLIENT_URL || 'http://localhost:5173'
  return url.replace(/\/$/, '')
}

function normalizeKeyword(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function slugifyCategory(category) {
  return String(category || 'wellness')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function getArticlePath(article) {
  const category = slugifyCategory(article.category)
  const slug = article.slug
  return `${getBlogBasePath()}/${category}/${slug}`
}

function getArticleUrl(article) {
  return `${getSiteOrigin()}${getArticlePath(article)}`
}

function getArticleKeywords(article, product) {
  const takeaways = Array.isArray(article.key_takeaways) ? article.key_takeaways : []
  const seoKeywords = Array.isArray(article.seo_keywords) ? article.seo_keywords : []
  const productTags = product?.tags || []

  const keywords = [
    article.title,
    article.category,
    ...takeaways,
    ...seoKeywords,
    product?.name,
    product?.category,
    ...productTags,
    `${article.title} ${STORE_NAME}`,
    'pharmacy blog',
    'wellness education',
    'health and wellness',
  ]

  return [...new Set(keywords.map(normalizeKeyword).filter(Boolean))].slice(0, 16)
}

function buildArticleMeta(article, product = null) {
  const canonical = getArticleUrl(article)
  const description = (article.meta_description || '').trim().slice(0, 160)
  const keywords = getArticleKeywords(article, product)
  const image = article.image_url || `${getSiteOrigin()}/logo.png`

  return {
    title: `${article.title} | ${STORE_NAME}`,
    description,
    keywords,
    canonical,
    robots: 'index, follow',
    publisher: STORE_NAME,
    og: {
      title: article.title,
      description,
      image,
      type: 'article',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      image,
    },
  }
}

function buildNewsArticleJsonLd(article, product = null) {
  const url = getArticleUrl(article)
  const image = article.image_url ? [article.image_url] : [`${getSiteOrigin()}/logo.png`]

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: (article.meta_description || '').slice(0, 160),
    image,
    datePublished: article.published_at ? new Date(article.published_at).toISOString() : undefined,
    dateModified: article.updatedAt ? new Date(article.updatedAt).toISOString() : undefined,
    author: {
      '@type': 'Organization',
      name: article.source_name || STORE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: STORE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${getSiteOrigin()}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    keywords: getArticleKeywords(article, product).join(', '),
    articleSection: article.category,
  }
}

function buildFaqJsonLd(article) {
  if (!hasFaqSection(article.content)) return null
  const items = extractFaqFromMarkdown(article.content)
  if (!items.length) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  }
}

function buildArticleBreadcrumbJsonLd(article) {
  const origin = getSiteOrigin()
  const base = getBlogBasePath()
  const category = slugifyCategory(article.category)

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: origin },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${origin}${base}` },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.category,
        item: `${origin}${base}/${category}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: article.title,
        item: getArticleUrl(article),
      },
    ],
  }
}

function getShareUrl(article) {
  return getArticleUrl(article)
}

module.exports = {
  STORE_NAME,
  getBlogBasePath,
  getSiteOrigin,
  getArticlePath,
  getArticleUrl,
  getArticleKeywords,
  buildArticleMeta,
  buildNewsArticleJsonLd,
  buildFaqJsonLd,
  buildArticleBreadcrumbJsonLd,
  getShareUrl,
  slugifyCategory,
}
