const fs = require('fs')
const path = require('path')
const escapeHtml = require('../utils/escapeHtml')
const { getSiteOrigin } = require('../utils/productSeoServer')

const PAGE_PATH = '/what-is-a-compounding-pharmacy-and-how-does-it-work'
const TITLE = 'What Is a Compounding Pharmacy and How Does It Work?'
const DESCRIPTION =
  'Learn how compounding pharmacies customize medications—adjusting doses, removing allergens, and changing forms—and how Evolve Specialty Pharmacy can help.'
const STORE_NAME = 'Evolve Specialty Pharmacy & Wellness'
const HERO_PATH = '/images/what-is-a-compounding-pharmacy.jpg'

const TAKEAWAYS = [
  'Compounding pharmacies create customized medications when mass-produced options do not fit a patient’s needs.',
  'Pharmacists can adjust dosages, remove allergens, change forms (such as pill to liquid), and recreate discontinued formulas.',
  'Patients with allergies, children, seniors, and pets often benefit most from compounded prescriptions.',
  'Evolve Specialty Pharmacy works with your provider to fill personalized compounded medications safely.',
]

const FAQ = [
  {
    question: 'What is a compounding pharmacy?',
    answer:
      'A compounding pharmacy creates customized medications tailored to individual patients, instead of only dispensing mass-produced drugs from manufacturers.',
  },
  {
    question: 'How does medication compounding work?',
    answer:
      'A compounding pharmacist mixes, alters, or combines ingredients based on a provider’s prescription—adjusting strength, removing allergens, changing the dosage form, or preparing medications that are unavailable commercially.',
  },
  {
    question: 'Who benefits from compounded medications?',
    answer:
      'People with allergies to dyes, gluten, lactose, or preservatives; children who need liquid or flavored forms; seniors who need adjusted doses; and pets that need specific strengths or flavors.',
  },
  {
    question: 'Do I need a prescription for compounded medication?',
    answer:
      'Yes. Compounded medications are prepared from a valid prescription written by a licensed healthcare provider. Contact Evolve Specialty Pharmacy if you have questions about transferring or filling a compounded prescription.',
  },
]

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

function stripDefaultSeoTags(html) {
  return html
    .replace(/\s*<meta\s+name="(?:description|keywords|robots|publisher|twitter:card|twitter:title|twitter:description|twitter:image)"[^>]*>\s*/gi, '\n')
    .replace(/\s*<meta\s+property="(?:og:title|og:description|og:image|og:type|og:url)"[^>]*>\s*/gi, '\n')
    .replace(/\s*<link\s+rel="canonical"[^>]*>\s*/gi, '\n')
    .replace(/\s*<script[^>]*id="jsonld-organization"[^>]*>[\s\S]*?<\/script>\s*/gi, '\n')
}

function buildJsonLd(origin, imageUrl, canonical) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: TITLE,
        description: DESCRIPTION,
        image: [imageUrl],
        mainEntityOfPage: canonical,
        author: { '@type': 'Organization', name: STORE_NAME },
        publisher: {
          '@type': 'Organization',
          name: STORE_NAME,
          logo: { '@type': 'ImageObject', url: `${origin}/logo.png` },
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${origin}/blog` },
          { '@type': 'ListItem', position: 3, name: TITLE, item: canonical },
        ],
      },
    ],
  }
}

function buildHeadInjection(origin) {
  const canonical = `${origin}${PAGE_PATH}`
  const imageUrl = `${origin}${HERO_PATH}`
  const keywords = [
    'compounding pharmacy',
    'what is a compounding pharmacy',
    'custom compounded medication',
    'personalized prescriptions',
    'Evolve Specialty Pharmacy',
  ].join(', ')
  const ld = JSON.stringify(buildJsonLd(origin, imageUrl, canonical)).replace(/</g, '\\u003c')

  return `
    <meta name="description" content="${escapeHtml(DESCRIPTION)}" data-bot-seo="true" />
    <meta name="keywords" content="${escapeHtml(keywords)}" data-bot-seo="true" />
    <meta name="robots" content="index, follow" data-bot-seo="true" />
    <meta name="publisher" content="${escapeHtml(STORE_NAME)}" data-bot-seo="true" />
    <link rel="canonical" href="${escapeHtml(canonical)}" data-bot-seo="true" />
    <meta property="og:title" content="${escapeHtml(TITLE)}" data-bot-seo="true" />
    <meta property="og:description" content="${escapeHtml(DESCRIPTION)}" data-bot-seo="true" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" data-bot-seo="true" />
    <meta property="og:type" content="article" data-bot-seo="true" />
    <meta property="og:url" content="${escapeHtml(canonical)}" data-bot-seo="true" />
    <meta name="twitter:card" content="summary_large_image" data-bot-seo="true" />
    <meta name="twitter:title" content="${escapeHtml(TITLE)}" data-bot-seo="true" />
    <meta name="twitter:description" content="${escapeHtml(DESCRIPTION)}" data-bot-seo="true" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" data-bot-seo="true" />
    <script type="application/ld+json" id="jsonld-compounding-guide" data-bot-seo="true">${ld}</script>
  `
}

function buildBodySnapshot(origin) {
  const imageUrl = escapeHtml(`${origin}${HERO_PATH}`)
  const takeaways = TAKEAWAYS.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  const faq = FAQ.map(
    (item) =>
      `<section><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></section>`
  ).join('')

  return `
    <main data-prerender="compounding-guide" id="prerender-compounding-guide">
      <article>
        <h1>${escapeHtml(TITLE)}</h1>
        <img src="${imageUrl}" alt="Pharmacist preparing a customized compounded medication" width="1200" height="630" />
        <section>
          <h2>Key takeaways</h2>
          <ul>${takeaways}</ul>
        </section>
        <p>
          In the world of healthcare, one size does not always fit all. That&apos;s where compounding
          pharmacies come in. Unlike standard retail pharmacies that dispense mass-produced medications,
          compounding pharmacies specialize in creating customized medications tailored to individual
          patients&apos; needs.
        </p>
        <h2>How It Works</h2>
        <p>
          Compounding pharmacists mix, alter, or combine ingredients to produce medications that aren&apos;t
          available commercially—adjusting dosages, removing allergens, changing forms, and recreating
          discontinued medications.
        </p>
        <h2>Who Benefits from Compounding Pharmacies?</h2>
        <ul>
          <li><strong>Patients with Allergies</strong> — Medications free of lactose, dyes, gluten, or preservatives.</li>
          <li><strong>Pediatric Patients</strong> — Liquid or flavored versions when pills are hard to swallow.</li>
          <li><strong>Geriatric Patients</strong> — Adjusted doses or alternative forms.</li>
          <li><strong>Veterinary Needs</strong> — Specific dosages and flavors for pets.</li>
        </ul>
        <h2>Frequently asked questions</h2>
        ${faq}
      </article>
    </main>
  `
}

function renderBotCompoundingGuidePage(clientDist) {
  const template = loadIndexTemplate(clientDist)
  if (!template) {
    return { status: 500, html: '<!DOCTYPE html><html><body>Template not found</body></html>' }
  }

  const origin = getSiteOrigin()
  let html = stripDefaultSeoTags(template)
  html = html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${escapeHtml(`${TITLE} | ${STORE_NAME}`)}</title>`
  )
  html = html.replace('</head>', `${buildHeadInjection(origin)}\n</head>`)
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root">${buildBodySnapshot(origin)}</div>`
  )

  return { status: 200, html }
}

function isCompoundingGuidePath(pathname) {
  const normalized = String(pathname || '').replace(/\/$/, '') || '/'
  return normalized === PAGE_PATH
}

module.exports = {
  PAGE_PATH,
  renderBotCompoundingGuidePage,
  isCompoundingGuidePath,
}
