const { google } = require('googleapis')

const CONTENT_SCOPE = ['https://www.googleapis.com/auth/content']

function isMerchantConfigured() {
  return Boolean(process.env.GOOGLE_MERCHANT_ID)
}

function getMerchantAuth() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_USE_APPLICATION_DEFAULT === 'true') {
    return new google.auth.GoogleAuth({ scopes: CONTENT_SCOPE })
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!clientEmail || !privateKey) {
    throw new Error('Google Merchant auth is not configured')
  }

  return new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: CONTENT_SCOPE,
  })
}

async function getContentClient() {
  const auth = await getMerchantAuth().getClient()
  return google.content({ version: 'v2.1', auth })
}

function merchantProductId(offerId) {
  const channel = process.env.GOOGLE_MERCHANT_CHANNEL || 'online'
  const language = process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE || 'en'
  const country = process.env.GOOGLE_MERCHANT_TARGET_COUNTRY || 'US'
  return `${channel}:${language}:${country}:${offerId}`
}

function buildMerchantProduct(payload) {
  const offerId = payload.sku || payload.barcode
  const baseUrl = (process.env.SITE_URL || process.env.CLIENT_URL || '').replace(/\/$/, '')
  const productLinkPath = payload.productLinkPath
    ? `${payload.productLinkPath}`.startsWith('/')
      ? payload.productLinkPath
      : `/${payload.productLinkPath}`
    : ''
  const imageUrls = String(payload.imageUrls || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)

  return {
    offerId,
    title: payload.name,
    description: payload.description || payload.name,
    link: productLinkPath && baseUrl ? `${baseUrl}${productLinkPath}` : payload.productUrl || `${baseUrl}/shop`,
    imageLink: imageUrls[0],
    additionalImageLinks: imageUrls.slice(1, 10),
    contentLanguage: process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE || 'en',
    targetCountry: process.env.GOOGLE_MERCHANT_TARGET_COUNTRY || 'US',
    channel: process.env.GOOGLE_MERCHANT_CHANNEL || 'online',
    availability: Number(payload.stock) > 0 ? 'in stock' : 'out of stock',
    condition: 'new',
    googleProductCategory: payload.googleProductCategory || payload.category,
    gtin: payload.barcode || undefined,
    mpn: payload.sku || undefined,
    brand: String(payload.tags || '').split(',')[0]?.trim() || undefined,
    price: {
      value: Number(payload.price || 0).toFixed(2),
      currency: process.env.GOOGLE_MERCHANT_CURRENCY || 'USD',
    },
  }
}

async function upsertMerchantProduct(payload) {
  if (!isMerchantConfigured()) return { skipped: true, reason: 'GOOGLE_MERCHANT_ID is not configured' }

  const merchantId = process.env.GOOGLE_MERCHANT_ID
  const content = await getContentClient()
  const requestBody = buildMerchantProduct(payload)

  await content.products.insert({
    merchantId,
    requestBody,
  })

  return {
    skipped: false,
    offerId: requestBody.offerId,
    productId: merchantProductId(requestBody.offerId),
  }
}

async function updateMerchantStock(payload) {
  return upsertMerchantProduct(payload)
}

module.exports = {
  upsertMerchantProduct,
  updateMerchantStock,
  buildMerchantProduct,
}
