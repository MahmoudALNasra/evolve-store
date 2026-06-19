const fs = require('fs')
const path = require('path')
const axios = require('axios')
const crypto = require('crypto')
const {
  getProductMediaDir,
  buildLocalProductImageUrl,
  sanitizeSlug,
} = require('../utils/productMediaPaths')

const MAX_BYTES = Number(process.env.PRODUCT_IMAGE_MAX_BYTES || 8 * 1024 * 1024)
const MIN_BYTES = Number(process.env.PRODUCT_IMAGE_MIN_BYTES || 2048)

const EXT_BY_TYPE = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
}

function extensionFromContentType(contentType) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase()
  return EXT_BY_TYPE[type] || '.jpg'
}

function extensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname
    const ext = path.extname(pathname).toLowerCase()
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext)) {
      return ext === '.jpeg' ? '.jpg' : ext
    }
  } catch {
    /* ignore */
  }
  return '.jpg'
}

async function downloadImageBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: Number(process.env.IMAGE_DOWNLOAD_TIMEOUT_MS || 25000),
    maxRedirects: 5,
    headers: {
      'User-Agent': 'EvolvePharmacy-ImageBot/1.0',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    validateStatus: (status) => status >= 200 && status < 400,
  })

  const contentType = String(response.headers['content-type'] || '')
  if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
    throw new Error(`Unsupported content type: ${contentType}`)
  }

  const buffer = Buffer.from(response.data)
  if (buffer.length < MIN_BYTES) {
    throw new Error('Image too small')
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error('Image too large')
  }

  return { buffer, contentType }
}

/**
 * Download a remote image and store under media/products/{slug}/.
 * Returns public URL on this site.
 */
async function saveProductImageFromUrl(productSlug, sourceUrl, options = {}) {
  const slug = sanitizeSlug(productSlug)
  const { buffer, contentType } = await downloadImageBuffer(sourceUrl)
  const ext = extensionFromContentType(contentType) || extensionFromUrl(sourceUrl)
  const index = options.index ?? 1
  const hash = crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 8)
  const filename = `${slug}-${index}-${hash}${ext}`
  const dir = getProductMediaDir(slug)

  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, buffer)

  return {
    url: buildLocalProductImageUrl(slug, filename),
    filePath,
    source: options.source || 'serper',
  }
}

function localFileExists(publicUrl) {
  const { localPathFromPublicUrl } = require('../utils/productMediaPaths')
  const filePath = localPathFromPublicUrl(publicUrl)
  return filePath ? fs.existsSync(filePath) : false
}

module.exports = {
  saveProductImageFromUrl,
  downloadImageBuffer,
  localFileExists,
}
