const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { searchWeb } = require('./serperService')
const {
  generateSEOTitle,
  generateMetaDescription,
  getProductBrand,
} = require('../utils/seoUtils')

const STORE_NAME = 'Evolve Specialty Pharmacy & Wellness'

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return {
    apiKey,
    model: process.env.OPENAI_SEO_MODEL || process.env.OPENAI_BLOG_MODEL || 'gpt-4o-mini',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  }
}

async function callOpenAi(messages) {
  const { apiKey, model, baseUrl } = getOpenAiConfig()
  const { data } = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.4,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: Number(process.env.OPENAI_TIMEOUT_MS || 60000),
    }
  )
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty OpenAI response')
  return JSON.parse(content)
}

async function fetchSerpSnippets(product) {
  const brand = getProductBrand(product)
  const query = [product.name, brand].filter(Boolean).join(' ')
  const results = await searchWeb(query, { num: 5 })
  return results.slice(0, 5).map((r) => r.snippet || r.title || '').filter(Boolean)
}

function buildOptimizationPrompt(product, serpSnippets) {
  const serpBlock = serpSnippets.map((s, i) => `${i + 1}. ${s}`).join('\n')

  return `You are a pharmacy SEO editor for ${STORE_NAME}.

Rewrite the product description for SEO while staying compliant with pharmacy regulations.

Product:
- Name: ${product.name}
- Category: ${product.category || 'Wellness'}
- Brand: ${getProductBrand(product) || 'N/A'}
- Original description (FACTUAL GROUND TRUTH — do not contradict or invent beyond this):
${product.description || 'No description provided.'}

SERP snippets (tone/keyword reference ONLY — not facts to copy):
${serpBlock || 'None available.'}

Rules:
- REWRITE the original text; do not invent dosages, medical claims, or efficacy statements not in the original.
- Do not add medical claims, dosage recommendations, or treatment promises.
- Keep all factual claims from the original intact.
- 150–200 words, short paragraphs, optional bullet list if source supports it.
- Naturally include product name, category, and 1–2 relevant keywords without stuffing.
- Generate 2–3 FAQ Q&As genuinely useful and grounded in the original description.

Return ONLY valid JSON:
{
  "descriptionDraft": "rewritten body",
  "seoTitle": "suggested title fragment without suffix",
  "seoMetaDescription": "150-155 char meta",
  "seoFaqs": [{ "question": "...", "answer": "..." }]
}`
}

async function suggestProductSeo(product) {
  const serpSnippets = await fetchSerpSnippets(product)
  const prompt = buildOptimizationPrompt(product, serpSnippets)
  const result = await callOpenAi([
    { role: 'system', content: 'You output strict JSON for regulated pharmacy product SEO.' },
    { role: 'user', content: prompt },
  ])

  const seoTitle = generateSEOTitle(result.seoTitle || product.name, 60)
  const seoMetaDescription = generateMetaDescription(
    result.seoMetaDescription || result.descriptionDraft || product.description,
    155
  )

  return {
    original: {
      description: product.description || '',
      seoTitle: generateSEOTitle(product.name, 60),
      seoMetaDescription: generateMetaDescription(product.description, 155),
    },
    suggested: {
      descriptionDraft: result.descriptionDraft || '',
      seoTitle,
      seoMetaDescription,
      seoFaqs: Array.isArray(result.seoFaqs) ? result.seoFaqs.slice(0, 3) : [],
    },
    serpSnippets,
  }
}

async function optimizeAllProducts(options = {}) {
  const Product = require('../models/Product')
  const limit = Number(options.limit || 50)
  const skip = Number(options.skip || 0)
  const dryRun = options.dryRun === true
  const delayMs = Number(process.env.PRODUCT_SEO_DELAY_MS || 1200)

  const products = await Product.find({ isPublished: true })
    .sort({ updatedAt: 1 })
    .skip(skip)
    .limit(limit)

  const report = []

  for (const product of products) {
    try {
      const suggestion = await suggestProductSeo(product)
      if (!dryRun) {
        product.descriptionDraft = suggestion.suggested.descriptionDraft
        product.seoTitle = suggestion.suggested.seoTitle.replace(/\s*\|\s*Evolve.*/i, '').trim()
        product.seoMetaDescription = suggestion.suggested.seoMetaDescription
        product.seoFaqs = suggestion.suggested.seoFaqs
        await product.save()
      }
      report.push({
        productId: product._id,
        slug: product.slug,
        name: product.name,
        before: suggestion.original,
        after: suggestion.suggested,
      })
      await new Promise((r) => setTimeout(r, delayMs))
    } catch (err) {
      report.push({
        productId: product._id,
        slug: product.slug,
        name: product.name,
        error: err.message,
      })
    }
  }

  const outDir = path.join(__dirname, '../../reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `product-seo-${Date.now()}.json`)
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

  return { scanned: products.length, reportPath: outPath, report }
}

module.exports = { suggestProductSeo, optimizeAllProducts }
