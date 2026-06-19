import { useEffect } from 'react'

const SEO_ATTR = 'data-page-seo'

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(`${selector}[${SEO_ATTR}]`) || document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }

  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value))
  el.setAttribute(SEO_ATTR, 'true')
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"][${SEO_ATTR}]`) || document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }

  el.setAttribute('href', href)
  el.setAttribute(SEO_ATTR, 'true')
}

function upsertJsonLd(id, data) {
  if (!data) return
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.id = id
    el.type = 'application/ld+json'
    el.setAttribute(SEO_ATTR, 'true')
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

function getOrigin() {
  if (import.meta.env.VITE_SITE_URL) return import.meta.env.VITE_SITE_URL.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export default function SEO({
  title,
  description,
  path = '/',
  keywords = [],
  image = '/logo.png',
  type = 'website',
  includeWebSiteSchema = false,
}) {
  useEffect(() => {
    const origin = getOrigin()
    const canonical = `${origin}${path}`
    const keywordText = Array.isArray(keywords) ? keywords.filter(Boolean).join(', ') : keywords
    const imageUrl = image?.startsWith('http') ? image : `${origin}${image}`

    document.title = title
    upsertMeta('meta[name="description"]', { name: 'description', content: description })
    upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywordText })
    upsertMeta('meta[name="robots"]', { name: 'robots', content: 'index, follow' })
    upsertMeta('meta[name="publisher"]', { name: 'publisher', content: 'Evolve Specialty Pharmacy & Wellness' })
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type })
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl })
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl })
    upsertLink('canonical', canonical)

    upsertJsonLd('jsonld-organization', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Evolve Specialty Pharmacy & Wellness',
      url: origin,
      logo: imageUrl,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@evolvepharmacy.com',
      },
    })

    if (includeWebSiteSchema) {
      upsertJsonLd('jsonld-website', {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Evolve Specialty Pharmacy & Wellness',
        url: origin,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin}/shop?search={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      })
    } else {
      document.getElementById('jsonld-website')?.remove()
    }
  }, [description, image, includeWebSiteSchema, keywords, path, title, type])

  return null
}
