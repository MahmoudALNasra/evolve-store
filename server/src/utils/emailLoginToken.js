const crypto = require('crypto')
const EmailLoginToken = require('../models/EmailLoginToken')
const { UTM_FIELDS } = require('./analyticsUtm')

const TOKEN_BYTES = 32
const EXPIRE_MINUTES = 15

const DEFAULT_EMAIL_UTMS = {
  utm_source: 'email',
  utm_medium: 'transactional',
  utm_campaign: 'order_confirmation',
  utm_content: 'view_orders',
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function getApiPublicBase() {
  return (process.env.API_PUBLIC_URL || process.env.CLIENT_URL || 'http://localhost:5000').replace(/\/$/, '')
}

function sanitizeRedirect(redirect) {
  if (!redirect || typeof redirect !== 'string') return '/orders'
  const path = redirect.trim()
  if (!path.startsWith('/') || path.startsWith('//')) return '/orders'
  if (path.includes('://')) return '/orders'
  return path.split('?')[0] || '/orders'
}

function appendUtmsToUrl(url, utms = {}) {
  const parsed = new URL(url)
  for (const key of UTM_FIELDS) {
    const value = utms[key]
    if (typeof value === 'string' && value.trim()) {
      parsed.searchParams.set(key, value.trim().slice(0, 512))
    }
  }
  return parsed.toString()
}

function extractUtmsFromQuery(query = {}) {
  const utms = { ...DEFAULT_EMAIL_UTMS }
  for (const key of UTM_FIELDS) {
    const value = query[key]
    if (typeof value === 'string' && value.trim()) {
      utms[key] = value.trim().slice(0, 512)
    }
  }
  return utms
}

async function createEmailLoginUrl({ userId, orderId, redirect = '/orders' }) {
  const raw = crypto.randomBytes(TOKEN_BYTES).toString('hex')
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + EXPIRE_MINUTES * 60 * 1000)

  await EmailLoginToken.create({
    user: userId,
    order: orderId,
    tokenHash,
    expiresAt,
  })

  const safeRedirect = sanitizeRedirect(redirect)
  const apiBase = getApiPublicBase()
  const utms = { ...DEFAULT_EMAIL_UTMS }

  let url = `${apiBase}/api/auth/email-login?token=${encodeURIComponent(raw)}&redirect=${encodeURIComponent(safeRedirect)}`
  url = appendUtmsToUrl(url, utms)
  return url
}

async function consumeEmailLoginToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null

  const tokenHash = hashToken(rawToken)
  const doc = await EmailLoginToken.findOne({
    tokenHash,
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  })

  if (!doc) return null

  doc.usedAt = new Date()
  await doc.save()
  return doc
}

module.exports = {
  DEFAULT_EMAIL_UTMS,
  createEmailLoginUrl,
  consumeEmailLoginToken,
  sanitizeRedirect,
  appendUtmsToUrl,
  extractUtmsFromQuery,
  getApiPublicBase,
}
