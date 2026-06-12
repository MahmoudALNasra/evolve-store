/**
 * Blog article SEO helpers (client-side).
 */

export const STORE_NAME = 'Evolve Specialty Pharmacy & Wellness'
const DEFAULT_BLOG_BASE = '/blog'

export function getBlogBasePath() {
  const base = import.meta.env.VITE_BLOG_BASE_PATH || DEFAULT_BLOG_BASE
  return base.startsWith('/') ? base.replace(/\/$/, '') : `/${base.replace(/\/$/, '')}`
}

export function getSiteOrigin() {
  if (import.meta.env.VITE_SITE_URL) {
    return import.meta.env.VITE_SITE_URL.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function normalizeKeyword(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function slugifyCategory(category) {
  return String(category || 'wellness')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function getArticlePath(article) {
  const category = slugifyCategory(article.category)
  return `${getBlogBasePath()}/${category}/${article.slug}`
}

export function getArticleUrl(article) {
  return `${getSiteOrigin()}${getArticlePath(article)}`
}

export function getArticleKeywords(article, product) {
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
  ]

  return [...new Set(keywords.map(normalizeKeyword).filter(Boolean))].slice(0, 16)
}

export function buildArticleMeta(article, product = null) {
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

function extractFaqFromMarkdown(content) {
  if (!content) return []
  const faqMatch = content.match(/##\s*FAQ[\s\S]*?(?=\n##\s|\n---|\nSource:|$)/i)
  if (!faqMatch) return []

  const section = faqMatch[0]
  const items = []
  const qaRegex = /###\s*(.+?)\n([\s\S]*?)(?=\n###\s|\n##\s|$)/g
  let match

  while ((match = qaRegex.exec(section)) !== null) {
    const question = match[1].trim().replace(/\?$/, '') + '?'
    const answer = match[2].trim().replace(/\n+/g, ' ')
    if (question && answer) items.push({ question, answer })
  }

  return items.slice(0, 6)
}

export function buildNewsArticleJsonLd(article, product = null) {
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

export function buildFaqJsonLd(article) {
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

export function buildArticleBreadcrumbJsonLd(article) {
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

export function getSectionAnchors(content) {
  const anchors = []
  const headingRegex = /^##\s+(.+)$/gm
  let match

  const anchorMap = {
    'quick answer': 'quick-answer',
    'practical implications': 'practical-implications',
    'what to watch next': 'what-to-watch-next',
    faq: 'faq',
    'key takeaways': 'key-takeaways',
    'common mistakes': 'common-mistakes',
    checklist: 'checklist',
    'step-by-step workflow': 'step-by-step',
  }

  while ((match = headingRegex.exec(content)) !== null) {
    const label = match[1].trim()
    const key = label.toLowerCase()
    const id = anchorMap[key] || label.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
    anchors.push({ label, id })
  }

  return anchors
}

export function getReadingTimeMinutes(content) {
  const words = String(content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`[\]()!-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}
