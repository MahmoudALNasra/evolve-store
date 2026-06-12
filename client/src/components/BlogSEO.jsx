import { useEffect } from 'react'
import {
  buildArticleMeta,
  buildNewsArticleJsonLd,
  buildFaqJsonLd,
  buildArticleBreadcrumbJsonLd,
} from '../lib/blogSeo'

const META_ATTR = 'data-blog-seo'
const JSON_LD_ATTR = 'data-blog-jsonld'

function upsertMetaName(name, content) {
  let el = document.head.querySelector(`meta[name="${name}"][${META_ATTR}]`) || document.head.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    el.setAttribute(META_ATTR, 'true')
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertMetaProperty(property, content) {
  let el = document.head.querySelector(`meta[property="${property}"][${META_ATTR}]`) || document.head.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    el.setAttribute(META_ATTR, 'true')
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"][${META_ATTR}]`) || document.head.querySelector(`link[rel="${rel}"]`)
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

function removeBlogSeoArtifacts() {
  document.querySelectorAll(`[${META_ATTR}]`).forEach((n) => n.remove())
  document.querySelectorAll(`[${JSON_LD_ATTR}]`).forEach((n) => n.remove())
}

export default function BlogSEO({ article, product = null, robots }) {
  useEffect(() => {
    if (!article) return undefined

    const meta = buildArticleMeta(article, product)
    document.title = meta.title
    upsertMetaName('description', meta.description)
    upsertMetaName('keywords', meta.keywords.join(', '))
    upsertMetaName('robots', robots || meta.robots)
    upsertMetaName('publisher', meta.publisher)
    upsertLink('canonical', meta.canonical)
    upsertMetaProperty('og:title', meta.og.title)
    upsertMetaProperty('og:description', meta.og.description)
    upsertMetaProperty('og:image', meta.og.image)
    upsertMetaProperty('og:type', meta.og.type)
    upsertMetaProperty('og:url', meta.og.url)
    upsertMetaName('twitter:card', meta.twitter.card)
    upsertMetaName('twitter:title', meta.twitter.title)
    upsertMetaName('twitter:description', meta.twitter.description)
    upsertMetaName('twitter:image', meta.twitter.image)

    upsertJsonLd('jsonld-newsarticle', buildNewsArticleJsonLd(article, product))
    upsertJsonLd('jsonld-breadcrumb', buildArticleBreadcrumbJsonLd(article))

    const faqLd = buildFaqJsonLd(article)
    if (faqLd) upsertJsonLd('jsonld-faq', faqLd)
    else document.getElementById('jsonld-faq')?.remove()

    return () => removeBlogSeoArtifacts()
  }, [article, product, robots])

  return null
}
