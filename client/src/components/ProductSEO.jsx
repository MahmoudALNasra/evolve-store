import { useEffect } from 'react'
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  buildProductMeta,
} from '../lib/productSeo'

const META_ATTR = 'data-product-seo'
const JSON_LD_ATTR = 'data-product-jsonld'

function upsertMetaName(name, content) {
  let el = document.head.querySelector(`meta[name="${name}"][${META_ATTR}]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    el.setAttribute(META_ATTR, 'true')
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertMetaProperty(property, content) {
  let el = document.head.querySelector(`meta[property="${property}"][${META_ATTR}]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    el.setAttribute(META_ATTR, 'true')
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"][${META_ATTR}]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    el.setAttribute(META_ATTR, 'true')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function upsertJsonLd(id, data) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.id = id
    el.type = 'application/ld+json'
    el.setAttribute(JSON_LD_ATTR, 'true')
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

function removeProductSeoArtifacts() {
  document.querySelectorAll(`[${META_ATTR}]`).forEach((n) => n.remove())
  document.querySelectorAll(`[${JSON_LD_ATTR}]`).forEach((n) => n.remove())
  document.getElementById('jsonld-product')?.remove()
  document.getElementById('jsonld-breadcrumb')?.remove()
}

/**
 * Injects on-page SEO meta, Open Graph, Twitter Cards, and JSON-LD for product pages.
 */
export default function ProductSEO({ product }) {
  useEffect(() => {
    if (!product) return

    const meta = buildProductMeta(product)

    document.title = meta.title
    upsertMetaName('description', meta.description)
    upsertLink('canonical', meta.canonical)

    upsertMetaProperty('og:title', meta.og.title)
    upsertMetaProperty('og:description', meta.og.description)
    upsertMetaProperty('og:image', meta.og.image)
    upsertMetaProperty('og:type', meta.og.type)
    upsertMetaProperty('og:url', meta.og.url)
    upsertMetaProperty('product:price:amount', meta.og.priceAmount)
    upsertMetaProperty('product:price:currency', meta.og.priceCurrency)

    upsertMetaName('twitter:card', meta.twitter.card)
    upsertMetaName('twitter:title', meta.twitter.title)
    upsertMetaName('twitter:description', meta.twitter.description)
    upsertMetaName('twitter:image', meta.twitter.image)

    upsertJsonLd('jsonld-product', buildProductJsonLd(product))
    upsertJsonLd('jsonld-breadcrumb', buildBreadcrumbJsonLd(product))

    return () => {
      removeProductSeoArtifacts()
      document.title = 'Evolve Specialty Pharmacy & Wellness'
    }
  }, [product])

  return null
}
