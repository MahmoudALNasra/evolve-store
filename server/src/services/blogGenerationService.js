const axios = require('axios')
const BlogArticle = require('../models/BlogArticle')
const { generateUniqueBlogSlug } = require('../models/BlogArticle')
const { slugifyCategory } = require('../utils/blogSeo')
const { findArticleSources, findHeroImage } = require('./serperService')
const { auditProductImages } = require('./productImageAuditService')

const STORE_NAME = 'Evolve Specialty Pharmacy & Wellness'

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return {
    apiKey,
    model: process.env.OPENAI_BLOG_MODEL || 'gpt-4o-mini',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  }
}

function buildComplianceRules() {
  return [
    'Write pharmacy-safe educational content only.',
    'Do NOT diagnose, treat, cure, or guarantee outcomes.',
    'Use cautious language such as "may support", "may help", or "some people find".',
    'Include a brief medical disclaimer encouraging readers to consult a pharmacist or healthcare provider.',
    'Avoid making claims about replacing prescription medications.',
    'Do not provide dosing instructions for prescription drugs.',
    'For supplements and OTC products, focus on general education and label-reading guidance.',
  ].join('\n')
}

function buildProductPrompt(product, sources) {
  const sourceLines = sources.map((s) => `- ${s.title}: ${s.link}`).join('\n')
  const tags = (product.tags || []).join(', ')

  return `You are a licensed-pharmacy editorial assistant for ${STORE_NAME}.

Create an SEO-optimized blog article about this product:
- Product name: ${product.name}
- Category: ${product.category}
- Description: ${product.description || 'N/A'}
- Tags: ${tags || 'N/A'}

Compliance rules:
${buildComplianceRules()}

Structure the markdown body exactly like this:
1) Opening paragraph (40-60 words) with a direct educational answer.
2) ## Quick Answer
3) ## Practical Implications
4) ## What to Watch Next
5) ## FAQ (3-4 questions as ### headings with answers)
6) End with: Source: ${STORE_NAME}

Reference sources for context (do not copy verbatim):
${sourceLines || '- General pharmacy education resources'}

Return ONLY valid JSON with this shape:
{
  "title": "string",
  "meta_description": "120-160 chars",
  "key_takeaways": ["bullet1", "bullet2", "bullet3"],
  "content": "full markdown body",
  "seo_keywords": ["keyword1", "keyword2", "..."]
}`
}

function buildTopicPrompt({ topic, category, sourceName, sources }) {
  const sourceLines = sources.map((s) => `- ${s.title}: ${s.link}`).join('\n')

  return `You are a licensed-pharmacy editorial assistant for ${STORE_NAME}.

Create an SEO-optimized editorial article about:
Topic: ${topic}
Category: ${category}

Compliance rules:
${buildComplianceRules()}

Structure the markdown body exactly like this:
1) Opening paragraph (40-60 words) with a direct educational answer.
2) ## Quick Answer
3) ## Step-by-step workflow
4) ## Common mistakes
5) ## Checklist / decision framework
6) ## FAQ (3-4 questions as ### headings with answers)
7) End with: Source: ${sourceName || STORE_NAME}

Reference sources for context (do not copy verbatim):
${sourceLines || '- General pharmacy education resources'}

Return ONLY valid JSON with this shape:
{
  "title": "string",
  "meta_description": "120-160 chars",
  "key_takeaways": ["bullet1", "bullet2", "bullet3"],
  "content": "full markdown body",
  "seo_keywords": ["keyword1", "keyword2", "..."]
}`
}

async function callOpenAi(prompt) {
  const { apiKey, model, baseUrl } = getOpenAiConfig()

  const { data } = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You write compliant pharmacy blog content. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: Number(process.env.OPENAI_TIMEOUT_MS || 90000),
    }
  )

  const raw = data.choices?.[0]?.message?.content
  if (!raw) throw new Error('OpenAI returned an empty response')

  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('OpenAI response was not valid JSON')
  }
}

function normalizeGeneratedPayload(payload) {
  const takeaways = Array.isArray(payload.key_takeaways)
    ? payload.key_takeaways.map(String).filter(Boolean).slice(0, 3)
    : []

  while (takeaways.length < 3) {
    takeaways.push('Consult your pharmacist for personalized guidance.')
  }

  return {
    title: String(payload.title || 'Untitled Article').trim(),
    meta_description: String(payload.meta_description || '').trim().slice(0, 160),
    key_takeaways: takeaways,
    content: String(payload.content || '').trim(),
    seo_keywords: Array.isArray(payload.seo_keywords)
      ? payload.seo_keywords.map(String).filter(Boolean).slice(0, 12)
      : [],
  }
}

async function pickHeroImage({ query, product }) {
  const productImageUrls = product?.images?.map((img) => img.url).filter(Boolean) || []

  try {
    const image = await findHeroImage(query, { productImageUrls })
    return image?.imageUrl || productImageUrls[0] || ''
  } catch (err) {
    console.warn('Serper image search failed:', err.message)
    return productImageUrls[0] || ''
  }
}

async function createDraftFromPayload({
  payload,
  category,
  product = null,
  topic = '',
  articleType = 'editorial',
  sourceName = STORE_NAME,
  sourceUrl = '',
  generationPrompt = '',
  regenerationOf = null,
}) {
  const normalized = normalizeGeneratedPayload(payload)
  const cat = slugifyCategory(category || product?.category || 'wellness')

  const article = new BlogArticle({
    title: normalized.title,
    slug: await generateUniqueBlogSlug(BlogArticle, normalized.title, cat),
    content: normalized.content,
    meta_description: normalized.meta_description,
    key_takeaways: normalized.key_takeaways,
    category: cat,
    source_name: sourceName,
    source_url: sourceUrl,
    image_url: '',
    status: 'draft',
    product: product?._id || null,
    topic,
    article_type: articleType,
    generation_prompt: generationPrompt,
    regeneration_of: regenerationOf,
    seo_keywords: normalized.seo_keywords,
  })

  article.image_url = await pickHeroImage({
    query: normalized.title,
    product,
  })

  await article.save()

  if (product && article.image_url) {
    try {
      await auditProductImages(product, {
        replacementUrls: [article.image_url],
        save: true,
      })
    } catch (err) {
      console.warn('Product image audit after blog generation failed:', err.message)
    }
  }

  return article
}

async function generateProductArticleDraft(product, options = {}) {
  let sources = []
  try {
    sources = await findArticleSources(`${product.name} ${product.category}`)
  } catch (err) {
    console.warn('Serper source search failed:', err.message)
  }

  const prompt = buildProductPrompt(product, sources)
  const payload = await callOpenAi(prompt)

  const primarySource = sources[0]
  return createDraftFromPayload({
    payload,
    category: product.category,
    product,
    topic: product.name,
    articleType: 'product',
    sourceName: primarySource?.source || STORE_NAME,
    sourceUrl: primarySource?.link || '',
    generationPrompt: prompt,
    regenerationOf: options.regenerationOf || null,
  })
}

async function generateTopicArticleDraft({ topic, category, sourceUrl, sourceName, articleType }) {
  let sources = []
  try {
    sources = await findArticleSources(topic)
  } catch (err) {
    console.warn('Serper source search failed:', err.message)
  }

  const prompt = buildTopicPrompt({
    topic,
    category,
    sourceName,
    sources,
  })
  const payload = await callOpenAi(prompt)

  const primarySource = sources[0]
  return createDraftFromPayload({
    payload,
    category,
    topic,
    articleType: articleType || 'topic',
    sourceName: sourceName || primarySource?.source || STORE_NAME,
    sourceUrl: sourceUrl || primarySource?.link || '',
    generationPrompt: prompt,
  })
}

async function regenerateArticleDraft(existing) {
  if (existing.product) {
    const Product = require('../models/Product')
    let product = existing.product
    if (!product?.name) {
      product = await Product.findById(existing.product)
    }
    if (!product) throw new Error('Linked product not found for regeneration')
    return generateProductArticleDraft(product, { regenerationOf: existing._id })
  }

  return generateTopicArticleDraft({
    topic: existing.topic || existing.title,
    category: existing.category,
    sourceUrl: existing.source_url,
    sourceName: existing.source_name,
    articleType: existing.article_type || 'topic',
  })
}

module.exports = {
  generateProductArticleDraft,
  generateTopicArticleDraft,
  regenerateArticleDraft,
  buildProductPrompt,
  buildTopicPrompt,
}
