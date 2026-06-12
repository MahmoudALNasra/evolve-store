const axios = require('axios')

const SERPER_BASE = 'https://google.serper.dev'

function getSerperKey() {
  const key = process.env.SERPER_API_KEY
  if (!key) throw new Error('SERPER_API_KEY is not configured')
  return key
}

async function serperRequest(endpoint, payload) {
  const { data } = await axios.post(`${SERPER_BASE}${endpoint}`, payload, {
    headers: {
      'X-API-KEY': getSerperKey(),
      'Content-Type': 'application/json',
    },
    timeout: Number(process.env.SERPER_TIMEOUT_MS || 15000),
  })
  return data
}

async function searchWeb(query, options = {}) {
  const data = await serperRequest('/search', {
    q: query,
    num: options.num || 5,
    gl: options.gl || 'us',
    hl: options.hl || 'en',
  })

  return (data.organic || []).map((item) => ({
    title: item.title,
    link: item.link,
    snippet: item.snippet,
    source: item.source,
  }))
}

async function searchImages(query, options = {}) {
  const data = await serperRequest('/images', {
    q: query,
    num: options.num || 5,
    gl: options.gl || 'us',
    hl: options.hl || 'en',
  })

  return (data.images || [])
    .map((item) => ({
      title: item.title,
      imageUrl: item.imageUrl,
      link: item.link,
      source: item.source,
    }))
    .filter((item) => item.imageUrl)
}

async function findArticleSources(topic, options = {}) {
  const results = await searchWeb(`${topic} pharmacy wellness education`, {
    num: options.num || 5,
  })

  const trusted = results.filter((item) => {
    const link = String(item.link || '').toLowerCase()
    return !link.includes('pinterest') && !link.includes('facebook.com')
  })

  return trusted.slice(0, options.max || 3)
}

async function findHeroImage(query, options = {}) {
  const images = await searchImages(`${query} wellness pharmacy`, { num: options.num || 8 })
  const productImages = options.productImageUrls || []

  const candidates = [
    ...productImages.map((url) => ({ imageUrl: url, source: 'product' })),
    ...images,
  ]

  return candidates.find((item) => item.imageUrl) || null
}

module.exports = {
  searchWeb,
  searchImages,
  findArticleSources,
  findHeroImage,
}
