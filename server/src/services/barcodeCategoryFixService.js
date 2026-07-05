const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { resolveProductStoreCategory } = require('../utils/storeCategoryMapper')
const applyAutoTagsToPayload = require('../utils/applyProductTags')

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return {
    apiKey,
    model: process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_SEO_MODEL || 'gpt-4o-mini',
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
      temperature: 0.1,
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

async function resolveCategoryWithOpenAi(product, allowedCategories) {
  const list = allowedCategories.join('\n- ')
  const prompt = `Pick the single best category for this pharmacy/wellness product.

Allowed categories (pick EXACTLY one name from this list):
- ${list}

Product:
- Name: ${product.name}
- Brand: ${product.brand || 'N/A'}
- Current category: ${product.category || 'Uncategorized'}
- Description: ${String(product.description || '').slice(0, 500)}

Return JSON: { "category": "exact name from list", "reason": "brief" }`

  const result = await callOpenAi([
    { role: 'system', content: 'You assign products to existing store categories. Output strict JSON only.' },
    { role: 'user', content: prompt },
  ])

  const category = String(result.category || '').trim()
  if (!allowedCategories.includes(category)) {
    throw new Error(`OpenAI returned invalid category: ${category}`)
  }

  return { category, reason: result.reason || '', source: 'openai' }
}

async function fixProductCategory(product, allowedCategories, options = {}) {
  const resolved = resolveProductStoreCategory(product, allowedCategories)
  if (resolved.category && !options.forceOpenAi) {
    return resolved
  }

  if (!process.env.OPENAI_API_KEY) {
    return resolved.category
      ? resolved
      : { category: 'Other Categories', source: 'fallback', reason: 'No OpenAI key' }
  }

  try {
    return await resolveCategoryWithOpenAi(product, allowedCategories)
  } catch {
    return resolved.category
      ? resolved
      : { category: 'Other Categories', source: 'fallback', reason: 'OpenAI failed' }
  }
}

function productNeedsCategoryFix(product, allowedCategories) {
  const category = String(product.category || '').trim()
  if (!category || category === 'Uncategorized') return true
  return !allowedCategories.includes(category)
}

async function auditProductCategories(options = {}) {
  const Product = require('../models/Product')
  const Category = require('../models/Category')
  const onlyPublished = options.onlyPublished !== false

  const allowedCategories = (await Category.find().sort({ name: 1 }).lean())
    .map((c) => c.name)
    .filter(Boolean)

  const filter = onlyPublished ? { isPublished: true } : {}
  const products = await Product.find(filter).select('name barcode category').lean()

  const stats = {
    total: products.length,
    valid: 0,
    needsFix: 0,
    uncategorized: 0,
    invalidCategory: 0,
    allowedCategories,
    samples: [],
  }

  for (const product of products) {
    const needs = productNeedsCategoryFix(product, allowedCategories)
    if (!needs) {
      stats.valid += 1
      continue
    }

    stats.needsFix += 1
    const category = String(product.category || '').trim()
    if (!category || category === 'Uncategorized') stats.uncategorized += 1
    else stats.invalidCategory += 1

    if (stats.samples.length < 8) {
      stats.samples.push({
        barcode: product.barcode,
        name: product.name?.slice(0, 60),
        category: category || '(empty)',
      })
    }
  }

  return stats
}

async function fixBarcodeProductCategories(options = {}) {
  const Product = require('../models/Product')
  const Category = require('../models/Category')
  const dryRun = options.dryRun === true
  const onlyPublished = options.onlyPublished !== false
  const onlyNeedsCategory = options.onlyNeedsCategory === true
  const delayMs = Number(process.env.BARCODE_CATEGORY_DELAY_MS || 400)

  const allowedCategories = (await Category.find().sort({ name: 1 }).lean())
    .map((c) => c.name)
    .filter(Boolean)

  let query = {}
  if (options.barcodes?.length) {
    query.barcode = { $in: options.barcodes }
  }
  if (onlyPublished) query.isPublished = true

  let products = await Product.find(query).sort({ name: 1 })

  if (onlyNeedsCategory) {
    products = products.filter((p) => productNeedsCategoryFix(p, allowedCategories))
  }

  if (options.limit > 0) products = products.slice(0, options.limit)

  const report = []
  let changed = 0

  for (const product of products) {
    const before = product.category
    const resolved = await fixProductCategory(product, allowedCategories, {
      forceOpenAi: options.forceOpenAi || before === 'Uncategorized' || productNeedsCategoryFix(product, allowedCategories),
    })

    const after = resolved.category || before
    const didChange = after !== before

    if (didChange && !dryRun) {
      product.category = after
      applyAutoTagsToPayload(product)
      await product.save()
      changed += 1
    } else if (didChange) {
      changed += 1
    }

    report.push({
      barcode: product.barcode,
      name: product.name,
      before,
      after,
      changed: didChange,
      source: resolved.source,
      reason: resolved.reason || '',
    })

    await new Promise((r) => setTimeout(r, delayMs))
  }

  const outDir = path.join(__dirname, '../../reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `category-fix-${Date.now()}.json`)
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

  return {
    scanned: products.length,
    changed,
    dryRun,
    reportPath: outPath,
    report,
  }
}

module.exports = {
  fixProductCategory,
  fixBarcodeProductCategories,
  auditProductCategories,
  productNeedsCategoryFix,
  resolveCategoryWithOpenAi,
}
