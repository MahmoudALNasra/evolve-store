import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, Phone } from 'lucide-react'
import SEO from '../components/SEO'
import { PHARMACY_PHONE_DISPLAY, PHARMACY_PHONE_TEL } from '../lib/pharmacyContact'
import { pushPhoneCall } from '../lib/gtm'

const PAGE_PATH = '/what-is-a-compounding-pharmacy-and-how-does-it-work'
const HERO_IMAGE = '/images/what-is-a-compounding-pharmacy.jpg'
const TITLE = 'What Is a Compounding Pharmacy and How Does It Work?'
const DESCRIPTION =
  'Learn how compounding pharmacies customize medications—adjusting doses, removing allergens, and changing forms—and how Evolve Specialty Pharmacy can help.'

const KEYWORDS = [
  'compounding pharmacy',
  'what is a compounding pharmacy',
  'custom compounded medication',
  'personalized prescriptions',
  'allergen-free medication',
  'liquid compounded medicine',
  'Evolve Specialty Pharmacy',
]

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

function upsertArticleJsonLd(origin) {
  const id = 'jsonld-compounding-article'
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.id = id
    el.type = 'application/ld+json'
    el.setAttribute('data-page-seo', 'true')
    document.head.appendChild(el)
  }

  el.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: TITLE,
        description: DESCRIPTION,
        image: [`${origin}${HERO_IMAGE}`],
        mainEntityOfPage: `${origin}${PAGE_PATH}`,
        author: {
          '@type': 'Organization',
          name: 'Evolve Specialty Pharmacy & Wellness',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Evolve Specialty Pharmacy & Wellness',
          logo: {
            '@type': 'ImageObject',
            url: `${origin}/logo.png`,
          },
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${origin}/blog` },
          { '@type': 'ListItem', position: 3, name: TITLE, item: `${origin}${PAGE_PATH}` },
        ],
      },
    ],
  })
}

export default function CompoundingPharmacyPage() {
  useEffect(() => {
    const origin = (import.meta.env.VITE_SITE_URL || window.location.origin || '').replace(/\/$/, '')
    upsertArticleJsonLd(origin)
    return () => {
      document.getElementById('jsonld-compounding-article')?.remove()
    }
  }, [])

  return (
    <div className="blog-article-page compounding-guide-page">
      <SEO
        title={`${TITLE} | Evolve Specialty Pharmacy & Wellness`}
        description={DESCRIPTION}
        path={PAGE_PATH}
        keywords={KEYWORDS}
        image={HERO_IMAGE}
        type="article"
      />

      <article className="blog-article-shell">
        <nav className="blog-article-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/blog">Blog</Link>
          <span>/</span>
          <span>Compounding pharmacy</span>
        </nav>

        <header className="blog-article-header">
          <p className="blog-article-kicker">Pharmacy services</p>
          <h1>{TITLE}</h1>
          <div className="blog-article-meta">
            <span><Calendar size={14} aria-hidden="true" /> Updated for 2026</span>
            <span><Clock size={14} aria-hidden="true" /> 5 min read</span>
          </div>
        </header>

        <div className="blog-article-hero">
          <img
            src={HERO_IMAGE}
            alt="Pharmacist preparing a customized compounded medication"
            width={1200}
            height={630}
            loading="eager"
          />
        </div>

        <aside className="blog-tldr-card" aria-label="Key takeaways">
          <div className="blog-tldr-header">
            <div>
              <p className="blog-tldr-label">Key takeaways</p>
              <p className="blog-tldr-title">Custom meds, made for you</p>
            </div>
          </div>
          <ul className="blog-tldr-list">
            {TAKEAWAYS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>

        <div className="blog-markdown">
          <p>
            In the world of healthcare, one size does not always fit all. That&apos;s where
            compounding pharmacies come in. Unlike standard retail pharmacies that dispense
            mass-produced medications, compounding pharmacies specialize in creating customized
            medications tailored to individual patients&apos; needs.
          </p>

          <h2 id="how-it-works">How It Works</h2>
          <p>
            Compounding pharmacists mix, alter, or combine ingredients to produce medications
            that aren&apos;t available commercially. This process is useful for:
          </p>
          <ul>
            <li>Adjusting dosages to suit patient needs</li>
            <li>Removing allergens like gluten, dyes, or preservatives</li>
            <li>Changing medication forms (e.g., turning a pill into a liquid for easier consumption)</li>
            <li>Creating medications that are otherwise unavailable or discontinued</li>
          </ul>
          <p>
            By working closely with healthcare providers, compounding pharmacies ensure that
            patients receive medication that is safe, effective, and personalized.
          </p>

          <h2 id="who-benefits">Who Benefits from Compounding Pharmacies?</h2>
          <ul>
            <li>
              <strong>Patients with Allergies</strong> — Those who need medications free of
              lactose, dyes, gluten, or preservatives.
            </li>
            <li>
              <strong>Pediatric Patients</strong> — Kids who have difficulty swallowing pills can
              receive liquid or flavored versions.
            </li>
            <li>
              <strong>Geriatric Patients</strong> — Seniors who require adjusted doses or
              alternative medication forms.
            </li>
            <li>
              <strong>Veterinary Needs</strong> — Pets who need specific dosages and flavors.
            </li>
          </ul>

          <h2 id="evolve-compounding">Compounding at Evolve Specialty Pharmacy</h2>
          <p>
            Evolve Specialty Pharmacy &amp; Wellness helps patients and providers with personalized
            compounded prescriptions when commercial products are not the right fit. If you already
            have a prescription, you can{' '}
            <Link to="/transfer-prescription">transfer it to Evolve</Link>,{' '}
            <Link to="/refill-prescription">request a refill</Link>, or{' '}
            <Link to="/contact">contact our team</Link> with questions about compounding options.
          </p>

          <div className="compounding-cta-row">
            <a
              href={`tel:${PHARMACY_PHONE_TEL}`}
              className="footer-rx-btn footer-rx-btn-primary"
              onClick={() => pushPhoneCall({
                phone: PHARMACY_PHONE_TEL,
                label: 'Call about compounding',
                location: PAGE_PATH,
              })}
            >
              <Phone size={14} aria-hidden="true" /> Call {PHARMACY_PHONE_DISPLAY}
            </a>
            <Link to="/contact" className="footer-rx-btn footer-rx-btn-secondary">
              Ask about compounding
            </Link>
          </div>

          <h2 id="faq">Frequently asked questions</h2>
          {FAQ.map((item) => (
            <div key={item.question} className="compounding-faq-item">
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </div>
          ))}
        </div>

        <p className="blog-disclaimer">
          This article is for educational purposes and does not replace medical advice. Always
          consult your healthcare provider before starting, stopping, or changing any medication.
        </p>

        <div className="blog-article-source">
          <Link to="/about">
            <ArrowLeft size={14} aria-hidden="true" /> About Evolve Specialty Pharmacy
          </Link>
        </div>
      </article>
    </div>
  )
}
