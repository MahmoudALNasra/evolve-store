/**
 * Product page SEO: meta tags, Open Graph, Twitter Cards, JSON-LD.
 */

import {
  generateSEOTitle,
  generateMetaDescription,
  getProductBrand,
  hasProductReviews,
} from './seoUtils'

export const STORE_NAME = 'Evolve Specialty Pharmacy & Wellness'
export const STORE_BRAND = 'Evolve Specialty Pharmacy & Wellness'
export const DEFAULT_CURRENCY = 'USD'

export function getSiteOrigin() {
  if (import.meta.env.VITE_SITE_URL) {
    return import.meta.env.VITE_SITE_URL.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function getProductPath(product) {
  const slug = product?.slug || product?._id
  return `/product/${slug}`
}

export function getProductUrl(product) {
  if (typeof product === 'string') {
    return `${getSiteOrigin()}/product/${product}`
  }
  return `${getSiteOrigin()}${getProductPath(product)}`
}

export function getProductImages(product) {
  const urls = product.images?.map((img) => img.url).filter(Boolean) || []
  if (urls.length) return urls
  return ['https://placehold.co/600x600?text=No+Image']
}

export function getProductDescription(product) {
  const raw = product.seoMetaDescription?.trim()
    || product.description?.trim()
  if (raw) return generateMetaDescription(raw, 320)
  return generateMetaDescription(
    `Shop ${product.name} at ${STORE_NAME}. Premium health and wellness products.`,
    155
  )
}

export function getProductMetaDescription(product) {
  if (product.seoMetaDescription?.trim()) {
    return generateMetaDescription(product.seoMetaDescription, 155)
  }
  return generateMetaDescription(product.description, 155)
    || generateMetaDescription(
      `Shop ${product.name} — ${product.category || 'wellness'} at Evolve Pharmacy.`,
      155
    )
}

export function getProductTitle(product) {
  if (product.seoTitle?.trim()) {
    return generateSEOTitle(product.seoTitle.replace(/\s*\|\s*Evolve.*/i, '').trim(), 60)
  }
  return generateSEOTitle(product.name, 60)
}

function normalizeKeyword(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function getProductKeywords(product) {
  const tags = Array.isArray(product.tags) ? product.tags : []
  const brand = getProductBrand(product)
  const keywords = [
    product.name,
    product.category,
    brand,
    product.sku,
    product.barcode,
    ...tags,
    `${product.category || 'wellness'} supplements`,
    'specialty pharmacy',
    'Evolve Pharmacy',
  ]

  return [...new Set(keywords.map(normalizeKeyword).filter(Boolean))].slice(0, 14)
}

function schemaAvailability(stock) {
  return stock > 0
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock'
}

function priceValidUntilDate() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split('T')[0]
}

export function buildProductJsonLd(product) {
  const images = getProductImages(product)
  const url = getProductUrl(product)
  const description = getProductMetaDescription(product)
  const brandName = getProductBrand(product) || STORE_BRAND

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: images,
    description,
    sku: product.sku || String(product._id),
    brand: {
      '@type': 'Brand',
      name: brandName,
    },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: DEFAULT_CURRENCY,
      price: Number(product.price).toFixed(2),
      priceValidUntil: priceValidUntilDate(),
      itemCondition: 'https://schema.org/NewCondition',
      availability: schemaAvailability(product.stock),
      seller: {
        '@type': 'Organization',
        name: STORE_NAME,
      },
    },
  }

  if (hasProductReviews(product)) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(Number(product.rating).toFixed(1)),
      reviewCount: product.numReviews,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return jsonLd
}

export function buildBreadcrumbJsonLd(product) {
  const origin = getSiteOrigin()
  const items = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
    { '@type': 'ListItem', position: 2, name: 'Shop', item: `${origin}/shop` },
  ]

  if (product.category) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: product.category,
      item: `${origin}/shop?category=${encodeURIComponent(product.category)}`,
    })
    items.push({
      '@type': 'ListItem',
      position: 4,
      name: product.name,
      item: getProductUrl(product),
    })
  } else {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: product.name,
      item: getProductUrl(product),
    })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

export function buildProductFaqJsonLd(product) {
  const faqs = (product.seoFaqs || []).filter((f) => f?.question && f?.answer)
  if (!faqs.length) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

export function buildSpeakableJsonLd(product) {
  const text = getProductMetaDescription(product)
  if (!text) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['#product-speakable-summary'],
    },
    name: product.name,
    description: text,
  }
}

export function buildProductMeta(product) {
  const images = getProductImages(product)
  const canonical = getProductUrl(product)
  const title = getProductTitle(product)
  const description = getProductMetaDescription(product)
  const keywords = getProductKeywords(product)
  const ogImage = images[0]
  const price = Number(product.price).toFixed(2)

  return {
    title,
    description,
    keywords,
    canonical,
    robots: 'index, follow',
    publisher: STORE_NAME,
    og: {
      title: product.name,
      description,
      image: ogImage,
      type: 'product',
      priceAmount: price,
      priceCurrency: DEFAULT_CURRENCY,
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description,
      image: ogImage,
    },
  }
}

export { hasProductReviews, getProductBrand, generateSEOTitle, generateMetaDescription }
