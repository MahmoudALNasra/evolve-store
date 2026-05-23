/**
 * Product page SEO: meta tags, Open Graph, Twitter Cards, JSON-LD.
 */

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

/** Storefront path segment for a product (slug preferred). */
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
  const raw = product.description?.trim()
  if (raw) return raw.slice(0, 320)
  return `Shop ${product.name} at ${STORE_NAME}. Premium health and wellness products.`
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

/**
 * Schema.org Product JSON-LD (Google Merchant / rich results).
 */
export function buildProductJsonLd(product) {
  const images = getProductImages(product)
  const url = getProductUrl(product)
  const description = getProductDescription(product)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: images,
    description,
    sku: product.sku || product._id,
    mpn: product.barcode || product.sku || product._id,
    brand: {
      '@type': 'Brand',
      name: STORE_BRAND,
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

  if (product.rating > 0 && product.numReviews > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(product.rating.toFixed(1)),
      reviewCount: product.numReviews,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return jsonLd
}

/**
 * Schema.org BreadcrumbList JSON-LD.
 */
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

export function buildProductMeta(product) {
  const images = getProductImages(product)
  const canonical = getProductUrl(product)
  const title = `${product.name} | ${STORE_NAME}`
  const description = getProductDescription(product)
  const ogImage = images[0]
  const price = Number(product.price).toFixed(2)

  return {
    title,
    description,
    canonical,
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
