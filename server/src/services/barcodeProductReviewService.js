const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { searchWeb } = require('./serperService')
const { PHARMACY_CATEGORIES } = require('./barcodeProductLookupService')
const { generateUniqueSlug } = require('../utils/productSlug')
const applyAutoTagsToPayload = require('../utils/applyProductTags')
const {
  generateSEOTitle,
  generateMetaDescription,
} = require('../utils/seoUtils')

const STORE_NAME = 'Evolve Specialty Pharmacy & Wellness'

const AUTO_UNPUBLISH_NAME_PATTERNS = [
  /seller\s*store\s*front/i,
  /amazon\s*online\s*main\s*store/i,
  /products\s*360\s*@\s*amazon/i,
  /^product\s+[A-Z0-9]{6,}$/i,
]

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return {
    apiKey,
    model: process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_SEO_MODEL || process.env.OPENAI_BLOG_MODEL || 'gpt-4o-mini',
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
      temperature: 0.2,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: Number(process.env.OPENAI_TIMEOUT_MS || 90000),
    }
  )
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty OpenAI response')
  return JSON.parse(content)
}

function looksGarbled(text) {
  const value = String(text || '')
  if (!value) return false
  const priceHits = (value.match(/\$\d+/g) || []).length
  const skuHits = (value.match(/\bSKU\s*:/gi) || []).length
  const outOfStockHits = (value.match(/out of stock/gi) || []).length
  return priceHits >= 2 || skuHits >= 2 || outOfStockHits >= 2 || value.length > 400
}

function shouldAutoUnpublishByName(name) {
  return AUTO_UNPUBLISH_NAME_PATTERNS.some((pattern) => pattern.test(String(name || '')))
}

async function fetchBarcodeResearch(barcode, productName) {
  if (!process.env.SERPER_API_KEY) return []

  const queries = [
    `"${barcode}" UPC product`,
    `${barcode} barcode ${productName}`.trim(),
  ]

  const snippets = []
  for (const q of queries) {
    try {
      const results = await searchWeb(q, { num: 5 })
      for (const row of results) {
        const line = [row.title, row.snippet].filter(Boolean).join(' — ')
        if (line.length > 12) snippets.push(line.slice(0, 280))
      }
    } catch {
      /* continue */
    }
  }

  return [...new Set(snippets)].slice(0, 6)
}

function buildReviewPrompt(product, researchSnippets) {
  const categories = PHARMACY_CATEGORIES.join(', ')
  const researchBlock = researchSnippets.length
    ? researchSnippets.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : 'No web research available.'

  return `You are a catalog quality reviewer for ${STORE_NAME}, a specialty pharmacy and wellness retailer.

Review this barcode-imported product. The name/description may be WRONG or GARBLED (multiple unrelated products pasted together from bad web search).

Product record:
- Barcode/UPC: ${product.barcode || 'unknown'}
- Current name: ${product.name}
- Current brand: ${product.brand || 'unknown'}
- Current category: ${product.category || 'Uncategorized'}
- Price: $${product.price}
- Current description (may be unreliable):
${product.description || '(empty)'}

Web research for this barcode (reference only — verify consistency):
${researchBlock}

Tasks:
1. Identify the SINGLE most likely real product for this barcode using web research + barcode knowledge (ignore wrong current title if research disagrees).
2. Decide if THAT real product belongs in a pharmacy/wellness store (vitamins, supplements, OTC, personal care, skincare, lip balm, first aid, medical supplies, health devices).
3. REJECT (fitForStore=false) only when the TRUE product is clearly NOT sold in a pharmacy: home improvement, power tools, electronics, furniture, cookware, automotive, office supplies, or unidentifiable junk.
4. If barcode research shows a wellness product but the current record title is wrong (e.g. tool blades instead of lip balm), set fitForStore=true, dataQuality=wrong_product, and correct the listing.
5. Write a clean customer-facing description (80–140 words) for the TRUE product. No medical claims, dosages, or treatment promises. No pasted SERP junk, prices, SKUs, or "Out of stock" lines.
6. Pick category from: ${categories}

Return ONLY valid JSON:
{
  "fitForStore": boolean,
  "confidence": number between 0 and 1,
  "dataQuality": "good" | "garbled" | "wrong_product" | "unknown",
  "reason": "brief explanation for admin",
  "correctName": "accurate product title",
  "correctBrand": "brand or empty string",
  "correctDescription": "clean description",
  "correctCategory": "one allowed category"
}`
}

async function reviewBarcodeProduct(product, options = {}) {
  if (shouldAutoUnpublishByName(product.name)) {
    return {
      fitForStore: false,
      confidence: 0.95,
      dataQuality: 'wrong_product',
      reason: 'Auto-flagged: listing title is a generic storefront or placeholder, not a real product.',
      correctName: product.name,
      correctBrand: product.brand || '',
      correctDescription: product.description || '',
      correctCategory: product.category || 'Uncategorized',
      source: 'heuristic',
    }
  }

  const researchSnippets = options.skipResearch
    ? []
    : await fetchBarcodeResearch(product.barcode, product.name)

  const prompt = buildReviewPrompt(product, researchSnippets)
  const result = await callOpenAi([
    {
      role: 'system',
      content: 'You review pharmacy catalog imports. Output strict JSON. Be conservative: unpublish ambiguous or non-wellness items.',
    },
    { role: 'user', content: prompt },
  ])

  const category = PHARMACY_CATEGORIES.includes(result.correctCategory)
    ? result.correctCategory
    : 'Uncategorized'

  const confidence = Number(result.confidence) || 0
  const dataQuality = result.dataQuality || 'unknown'

  let fitForStore = Boolean(result.fitForStore)
  if (dataQuality === 'unknown' && confidence < 0.35) fitForStore = false
  if (!result.correctName || result.correctName.length < 4) fitForStore = false

  const combined = `${result.correctName} ${result.correctDescription} ${result.reason}`.toLowerCase()
  const clearlyNotFit = /does not belong|not suitable for a pharmacy|not a wellness|kitchen faucet|tool blade|screwdriver|oscillating tool|speaker|bathroom mirror|ceiling fan|cookware|mattress topper|collapsible wagon|lighting fixture|salon tray|tomato cage|dishwasher|wood stain|dry erase|toilet brush|solar post|sun shade|porcelain creamer|storefront|placeholder|hexagonal handle bit|kitchen organizer|shoe horn|silicone lubricant|hot tub handrail|coffee percolator|electric coffee|clear poly bag|self-sealing bag/i.test(`${result.reason || ''} ${result.correctName || ''}`)
  const clearlyWellness = /hydrocortisone|otc medication|vitamin|supplement|lip balm|test strip|urinary tract|bandage|sanitizer|toothpaste|sensodyne|moisturiz|probiotic|collagen|first aid|grab bar|nebulizer|pulse oximeter|blood pressure|glucose|enema|laxative|pain relief|dermatitis|eczema|sunblock|sunscreen|deodorant|razor|denture|gauze|thermometer|incontinence|wheelchair|walker|stool softener|iron supplement|magnesium|turmeric|omega|propolis|elderberry|germ-x|efferdent|curad|panoxyl|azo /i.test(combined)

  if (!clearlyNotFit && clearlyWellness && PHARMACY_CATEGORIES.includes(category)) {
    fitForStore = true
  }
  if (clearlyNotFit) fitForStore = false

  return {
    fitForStore,
    confidence,
    dataQuality,
    reason: String(result.reason || '').slice(0, 500),
    correctName: String(result.correctName || product.name).trim().slice(0, 180),
    correctBrand: String(result.correctBrand || '').trim().slice(0, 80),
    correctDescription: String(result.correctDescription || product.description || '').trim().slice(0, 1200),
    correctCategory: category,
    researchSnippets,
    source: 'openai',
  }
}

async function applyReviewToProduct(product, review, { dryRun = false } = {}) {
  const Product = product.constructor
  const before = {
    name: product.name,
    isPublished: product.isPublished,
    description: product.description,
  }

  if (!review.fitForStore) {
    if (!dryRun) {
      product.isPublished = false
      await product.save()
    }
    return { action: 'unpublished', before, after: { isPublished: false, reason: review.reason } }
  }

  const updates = {
    name: review.correctName || product.name,
    brand: review.correctBrand || product.brand || '',
    description: review.correctDescription || product.description,
    category: review.correctCategory || product.category,
    isPublished: true,
  }

  if (!dryRun) {
    const nameChanged = updates.name !== product.name
    product.name = updates.name
    product.brand = updates.brand
    product.description = updates.description
    product.category = updates.category
    product.isPublished = true
    product.seoTitle = generateSEOTitle(updates.name, 60)
    product.seoMetaDescription = generateMetaDescription(updates.description, 155)

    if (nameChanged) {
      product.slug = await generateUniqueSlug(Product, updates.name, { excludeId: product._id })
    }

    applyAutoTagsToPayload(product)
    await product.save()
  }

  return {
    action: 'updated',
    before,
    after: updates,
  }
}

async function reviewImportedProducts(options = {}) {
  const Product = require('../models/Product')
  const Category = require('../models/Category')
  const dryRun = options.dryRun === true
  const limit = Number(options.limit || 0)
  const delayMs = Number(process.env.BARCODE_REVIEW_DELAY_MS || 800)
  const barcodes = options.barcodes || []

  let query = {}
  if (barcodes.length) {
    query = { barcode: { $in: barcodes } }
  } else if (options.recentDays) {
    const since = new Date(Date.now() - Number(options.recentDays) * 86400000)
    query = { createdAt: { $gte: since } }
  }

  if (options.onlyUnpublished) {
    query.isPublished = false
  }

  let products = await Product.find(query).sort({ createdAt: -1 })
  if (limit > 0) products = products.slice(0, limit)

  const report = []
  let updated = 0
  let unpublished = 0
  let skipped = 0

  for (const product of products) {
    try {
      const review = await reviewBarcodeProduct(product, { skipResearch: options.skipResearch })
      const result = await applyReviewToProduct(product, review, { dryRun })

      if (result.action === 'unpublished') unpublished += 1
      else if (result.action === 'updated') updated += 1

      report.push({
        barcode: product.barcode,
        productId: product._id,
        slug: product.slug,
        action: result.action,
        confidence: review.confidence,
        dataQuality: review.dataQuality,
        reason: review.reason,
        before: result.before,
        after: result.after,
        source: review.source,
      })

      if (review.fitForStore && review.correctCategory && !dryRun) {
        await Category.updateOne(
          { name: { $regex: `^${review.correctCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
          { $setOnInsert: { name: review.correctCategory, description: '' } },
          { upsert: true }
        )
      }
    } catch (err) {
      skipped += 1
      report.push({
        barcode: product.barcode,
        productId: product._id,
        slug: product.slug,
        action: 'error',
        error: err.message,
      })
    }

    await new Promise((r) => setTimeout(r, delayMs))
  }

  const outDir = path.join(__dirname, '../../reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `barcode-review-${Date.now()}.json`)
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

  return {
    scanned: products.length,
    updated,
    unpublished,
    skipped,
    dryRun,
    reportPath: outPath,
    report,
  }
}

module.exports = {
  reviewBarcodeProduct,
  applyReviewToProduct,
  reviewImportedProducts,
  looksGarbled,
  shouldAutoUnpublishByName,
}
