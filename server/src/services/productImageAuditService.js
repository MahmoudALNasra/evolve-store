const axios = require('axios')
const Product = require('../models/Product')

const DEFAULT_TIMEOUT = Number(process.env.IMAGE_AUDIT_TIMEOUT_MS || 8000)

async function isImageUrlWorking(url) {
  if (!url || typeof url !== 'string') return false

  try {
    const response = await axios.head(url, {
      timeout: DEFAULT_TIMEOUT,
      maxRedirects: 3,
      validateStatus: (status) => status >= 200 && status < 400,
    })
    const contentType = String(response.headers['content-type'] || '')
    if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
      return false
    }
    return true
  } catch {
    try {
      const response = await axios.get(url, {
        timeout: DEFAULT_TIMEOUT,
        maxRedirects: 3,
        responseType: 'stream',
        validateStatus: (status) => status >= 200 && status < 400,
      })
      response.data.destroy()
      const contentType = String(response.headers['content-type'] || '')
      return !contentType || contentType.startsWith('image/') || contentType.includes('octet-stream')
    } catch {
      return false
    }
  }
}

function dedupeUrls(urls) {
  const seen = new Set()
  const out = []
  for (const url of urls) {
    const normalized = String(url || '').trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

async function filterWorkingImageUrls(urls) {
  const unique = dedupeUrls(urls)
  const checks = await Promise.all(
    unique.map(async (url) => ({ url, ok: await isImageUrlWorking(url) }))
  )
  return checks.filter((item) => item.ok).map((item) => item.url)
}

async function auditProductImages(product, options = {}) {
  const save = options.save !== false
  const replacementUrls = dedupeUrls(options.replacementUrls || [])
  const existingUrls = (product.images || []).map((img) => img.url).filter(Boolean)

  const workingExisting = []
  for (const img of product.images || []) {
    if (await isImageUrlWorking(img.url)) {
      workingExisting.push(img)
    }
  }

  const workingReplacements = await filterWorkingImageUrls(replacementUrls)
  const existingWorkingUrls = new Set(workingExisting.map((img) => img.url))

  for (const url of workingReplacements) {
    if (!existingWorkingUrls.has(url)) {
      workingExisting.push({ url, source: 'link' })
      existingWorkingUrls.add(url)
    }
  }

  const removed = existingUrls.filter(
    (url) => !workingExisting.some((img) => img.url === url)
  )
  const added = workingExisting
    .map((img) => img.url)
    .filter((url) => !existingUrls.includes(url))

  if (save) {
    product.images = workingExisting
    await product.save()
  }

  return {
    productId: product._id,
    productName: product.name,
    beforeCount: existingUrls.length,
    afterCount: workingExisting.length,
    removed,
    added,
    images: workingExisting,
  }
}

async function auditProductsBatch({ limit = 10, onlyMissingImages = false } = {}) {
  const query = onlyMissingImages
    ? { $or: [{ images: { $size: 0 } }, { images: { $exists: false } }] }
    : {}

  const products = await Product.find(query).limit(limit)
  const results = []

  for (const product of products) {
    try {
      const result = await auditProductImages(product, { save: true })
      results.push(result)
    } catch (err) {
      results.push({
        productId: product._id,
        productName: product.name,
        error: err.message,
      })
    }
  }

  return {
    scanned: products.length,
    results,
    totalRemoved: results.reduce((sum, r) => sum + (r.removed?.length || 0), 0),
    totalAdded: results.reduce((sum, r) => sum + (r.added?.length || 0), 0),
  }
}

module.exports = {
  isImageUrlWorking,
  filterWorkingImageUrls,
  auditProductImages,
  auditProductsBatch,
}
