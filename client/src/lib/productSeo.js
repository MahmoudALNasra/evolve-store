/**
 * Product page SEO: meta tags, Open Graph, Twitter Cards, JSON-LD.
 * Patterns inspired by major retail product pages (rich Product + Offer + return/shipping + GEO).
 */

import {
  generateSEOTitle,
  generateMetaDescription,
  getProductBrand,
  hasProductReviews,
} from './seoUtils'
import {
  applyProductIdentifierSchema,
  buildProductKeywordList,
  buildProductTitleBase,
} from './productIdentifierSeo'

export const STORE_NAME = 'Evolve Specialty Pharmacy & Wellness'
export const STORE_BRAND = 'Evolve Specialty Pharmacy & Wellness'
export const DEFAULT_CURRENCY = 'USD'

/** San Antonio pharmacy — GEO for LocalBusiness / pharmacy entity */
export const PHARMACY_GEO = {
  name: STORE_NAME,
  streetAddress: '19239 Stone Oak Pkwy Ste # 103',
  addressLocality: 'San Antonio',
  addressRegion: 'TX',
  postalCode: '78258',
  addressCountry: 'US',
  telephone: '+1-210-314-6464',
  latitude: 29.6165,
  longitude: -98.4852,
  priceRange: '$$',
}

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
  const brand = getProductBrand(product)
  const base = product.description?.trim()
    || `Buy ${product.name}${brand ? ` by ${brand}` : ''} online from ${STORE_NAME} in San Antonio, TX. Secure Stripe checkout, fast shipping, and a 14-day return policy on eligible unopened items.`
  return generateMetaDescription(base, 155)
}

export function getProductTitle(product) {
  if (product.seoTitle?.trim()) {
    return generateSEOTitle(product.seoTitle.replace(/\s*\|\s*Evolve.*/i, '').trim(), 60)
  }
  return generateSEOTitle(buildProductTitleBase(product), 60)
}

export function getProductKeywords(product) {
  const extra = [
    'buy online',
    'San Antonio pharmacy',
    'Evolve Specialty Pharmacy',
    product.category,
  ].filter(Boolean)
  return buildProductKeywordList(product, extra).slice(0, 18)
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

function buildMerchantReturnPolicy(origin) {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'US',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 14,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
    refundType: 'https://schema.org/FullRefund',
    returnPolicySeasonalOverride: undefined,
    merchantReturnLink: `${origin}/return-policy`,
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Opened products',
        value: 'Not eligible for return',
      },
      {
        '@type': 'PropertyValue',
        name: 'Refund timing',
        value: 'After product is received and inspected at the pharmacy',
      },
    ],
  }
}

function buildShippingDetails() {
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: '0',
      currency: DEFAULT_CURRENCY,
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'US',
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 1,
        maxValue: 2,
        unitCode: 'd',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: 2,
        maxValue: 7,
        unitCode: 'd',
      },
    },
  }
}

export function buildPharmacyLocalBusinessJsonLd() {
  const origin = getSiteOrigin()
  return {
    '@context': 'https://schema.org',
    '@type': ['Pharmacy', 'LocalBusiness'],
    '@id': `${origin}/#pharmacy`,
    name: PHARMACY_GEO.name,
    url: origin || 'https://evolvepharmacy.com',
    image: `${origin}/logo.png`,
    telephone: PHARMACY_GEO.telephone,
    priceRange: PHARMACY_GEO.priceRange,
    address: {
      '@type': 'PostalAddress',
      streetAddress: PHARMACY_GEO.streetAddress,
      addressLocality: PHARMACY_GEO.addressLocality,
      addressRegion: PHARMACY_GEO.addressRegion,
      postalCode: PHARMACY_GEO.postalCode,
      addressCountry: PHARMACY_GEO.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: PHARMACY_GEO.latitude,
      longitude: PHARMACY_GEO.longitude,
    },
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
  }
}

export function buildProductJsonLd(product) {
  const images = getProductImages(product)
  const url = getProductUrl(product)
  const origin = getSiteOrigin()
  const description = getProductMetaDescription(product)
  const brandName = getProductBrand(product) || STORE_BRAND

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    url,
    image: images,
    description,
    sku: product.sku || String(product._id),
    category: product.category || 'Health & Wellness',
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
        url: origin || 'https://evolvepharmacy.com',
        '@id': `${origin}/#pharmacy`,
      },
      hasMerchantReturnPolicy: buildMerchantReturnPolicy(origin || 'https://evolvepharmacy.com'),
      shippingDetails: buildShippingDetails(),
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

  applyProductIdentifierSchema(jsonLd, product)

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

function defaultProductFaqs(product) {
  return [
    {
      question: `Is ${product.name} authentic when purchased from Evolve?`,
      answer: `Yes. ${product.name} is sold by ${STORE_NAME}, a licensed San Antonio pharmacy. We source from authorized channels and process payments securely through Stripe.`,
    },
    {
      question: 'What is your return policy?',
      answer: 'Eligible unopened wellness / OTC items may be returned within 14 days of delivery. Opened or unsealed products are not accepted. Refunds are issued after we receive and inspect the product at our pharmacy. See /return-policy for full terms. Prescription medications are generally non-returnable.',
    },
    {
      question: 'How long does shipping take?',
      answer: 'Most US orders ship within 1–2 business days via UPS or comparable carriers, with typical delivery in 2–7 business days. Free shipping applies on qualifying orders over $100.',
    },
  ]
}

export function buildProductFaqJsonLd(product) {
  const custom = (product.seoFaqs || []).filter((f) => f?.question && f?.answer)
  const faqs = custom.length ? custom : defaultProductFaqs(product)

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
    '@id': `${getProductUrl(product)}#webpage`,
    url: getProductUrl(product),
    name: getProductTitle(product),
    description: text,
    isPartOf: {
      '@type': 'WebSite',
      name: STORE_NAME,
      url: getSiteOrigin() || 'https://evolvepharmacy.com',
    },
    about: {
      '@id': `${getProductUrl(product)}#product`,
    },
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['#product-speakable-summary', 'h1'],
    },
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
    robots: 'index, follow, max-image-preview:large, max-snippet:-1',
    publisher: STORE_NAME,
    geoRegion: 'US-TX',
    geoPlacename: 'San Antonio',
    og: {
      title: product.name,
      description,
      image: ogImage,
      type: 'product',
      priceAmount: price,
      priceCurrency: DEFAULT_CURRENCY,
      url: canonical,
      locale: 'en_US',
      siteName: STORE_NAME,
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
