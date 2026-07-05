const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { searchWeb } = require('./serperService')
const {
  generateSEOTitle,
  generateMetaDescription,
  getProductBrand,
} = require('../utils/seoUtils')
const {
  analyzeDescriptionQuality,
  needsDescriptionOptimization,
  MIN_WORDS,
} = require('../utils/productDescriptionQuality')

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

function buildOptimizationPrompt(product, serpSnippets, options = {}) {
  const serpBlock = serpSnippets.map((s, i) => `${i + 1}. ${s}`).join('\n')
  const tabFields = options.includeTabs ? `
Also generate product detail tabs (compliant, no medical claims):
- ingredients: active ingredients / formula highlights from original data only
- suggestedUse: general use directions if supported by source, otherwise "Follow package directions or your healthcare provider's guidance."
- moreInfo: storage, count, form factor, NDC/SKU notes from source only

Add to JSON:
  "ingredients": "...",
  "suggestedUse": "...",
  "moreInfo": "..."
` : ''

  return `You are a pharmacy SEO editor for ${STORE_NAME}.

Rewrite the product description for SEO while staying compliant with pharmacy regulations.

Product:
- Name: ${product.name}
- Category: ${product.category || 'Wellness'}
- Brand: ${getProductBrand(product) || product.brand || 'N/A'}
- Ingredients (source): ${product.ingredients || 'N/A'}
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
${tabFields}

Return ONLY valid JSON:
{
  "descriptionDraft": "rewritten body",
  "seoTitle": "suggested title fragment without suffix",
  "seoMetaDescription": "150-155 char meta",
  "seoFaqs": [{ "question": "...", "answer": "..." }]${options.includeTabs ? ',\n  "ingredients": "...",\n  "suggestedUse": "...",\n  "moreInfo": "..."' : ''}
}`
}

async function suggestProductSeo(product, options = {}) {
  const serpSnippets = await fetchSerpSnippets(product)
  const prompt = buildOptimizationPrompt(product, serpSnippets, options)
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
      ingredients: result.ingredients || '',
      suggestedUse: result.suggestedUse || '',
      moreInfo: result.moreInfo || '',
    },
    serpSnippets,
  }
}

async function auditDescriptionQuality(options = {}) {
  const Product = require('../models/Product')
  const onlyPublished = options.onlyPublished !== false

  const filter = onlyPublished ? { isPublished: true } : {}
  const products = await Product.find(filter).select('name slug barcode description descriptionDraft seoMetaDescription seoFaqs').lean()

  const stats = {
    total: products.length,
    optimized: 0,
    needsWork: 0,
    empty: 0,
    veryShort: 0,
    thin: 0,
    missingSeoMeta: 0,
    missingFaqs: 0,
    minWordsThreshold: MIN_WORDS,
    samples: [],
  }

  for (const product of products) {
    const quality = analyzeDescriptionQuality(product)
    if (quality.optimized) {
      stats.optimized += 1
      continue
    }

    stats.needsWork += 1
    if (quality.reasons.includes('empty')) stats.empty += 1
    if (quality.reasons.some((r) => r.startsWith('very_short'))) stats.veryShort += 1
    if (quality.reasons.some((r) => r.startsWith('thin'))) stats.thin += 1
    if (quality.reasons.includes('missing_seo_meta')) stats.missingSeoMeta += 1
    if (quality.reasons.includes('missing_faqs')) stats.missingFaqs += 1

    if (stats.samples.length < 8) {
      stats.samples.push({
        barcode: product.barcode,
        name: product.name?.slice(0, 60),
        wordCount: quality.wordCount,
        reasons: quality.reasons,
      })
    }
  }

  return stats
}

async function optimizeProductsBatch(options = {}) {
  const Product = require('../models/Product')
  const limit = Number(options.limit || 50)
  const skip = Number(options.skip || 0)
  const dryRun = options.dryRun === true
  const onlyMissing = options.onlyMissing === true
  const onlyNeedsWork = options.onlyNeedsWork === true
  const delayMs = Number(process.env.PRODUCT_SEO_DELAY_MS || 1200)

  let products = await Product.find({ isPublished: true })
    .sort({ updatedAt: 1 })
    .skip(onlyNeedsWork ? 0 : skip)
    .limit(onlyNeedsWork ? 0 : limit)

  if (onlyNeedsWork) {
    const all = await Product.find({ isPublished: true }).sort({ updatedAt: 1 })
    products = all.filter((p) => needsDescriptionOptimization(p))
    if (skip > 0) products = products.slice(skip)
    if (limit > 0) products = products.slice(0, limit)
  } else if (onlyMissing) {
    products = products.filter((p) =>
      !p.description?.trim()
      || !p.seoMetaDescription?.trim()
      || !p.seoTitle?.trim()
    )
  }

  const report = []
  let optimized = 0
  let skipped = 0
  let errors = 0

  for (const product of products) {
    if (onlyNeedsWork && !needsDescriptionOptimization(product)) {
      skipped += 1
      continue
    }

    try {
      const beforeQuality = analyzeDescriptionQuality(product)
      const suggestion = await suggestProductSeo(product)
      if (!dryRun) {
        product.description = suggestion.suggested.descriptionDraft || product.description
        product.descriptionDraft = suggestion.suggested.descriptionDraft
        product.seoTitle = suggestion.suggested.seoTitle.replace(/\s*\|\s*Evolve.*/i, '').trim()
        product.seoMetaDescription = suggestion.suggested.seoMetaDescription
        product.seoFaqs = suggestion.suggested.seoFaqs
        await product.save()
      }
      optimized += 1
      report.push({
        productId: product._id,
        slug: product.slug,
        name: product.name,
        beforeQuality,
        before: suggestion.original,
        after: suggestion.suggested,
      })
      await new Promise((r) => setTimeout(r, delayMs))
    } catch (err) {
      errors += 1
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

  return { scanned: products.length, optimized, skipped, errors, dryRun, reportPath: outPath, report }
}

async function optimizeAllProducts(options = {}) {
  const batchSize = Number(options.limit || 50)
  let skip = 0
  const totals = { batches: 0, scanned: 0, optimized: 0, skipped: 0, errors: 0, dryRun: options.dryRun === true, reportPaths: [] }

  while (true) {
    const result = await optimizeProductsBatch({ ...options, limit: batchSize, skip })

    if (result.scanned === 0) break

    totals.batches += 1
    totals.scanned += result.scanned
    totals.optimized += result.optimized
    totals.skipped += result.skipped
    totals.errors += result.errors
    totals.reportPaths.push(result.reportPath)

    console.log(
      `[seo batch ${totals.batches}] scanned=${result.scanned} optimized=${result.optimized} ` +
      `errors=${result.errors} (total: ${totals.scanned})`
    )

    if (!options.onlyNeedsWork) {
      skip += result.scanned
    } else if (result.optimized === 0) {
      break
    } else {
      skip = 0
    }

    if (options.onlyNeedsWork && result.optimized === 0) break
    if (!options.all) break
    if (!options.onlyNeedsWork && result.scanned < batchSize) break
  }

  return totals
}

module.exports = {
  suggestProductSeo,
  auditDescriptionQuality,
  optimizeProductsBatch,
  optimizeAllProducts,
  needsDescriptionOptimization,
  analyzeDescriptionQuality,
}
