const axios = require('axios')

const COLLECT_URL = 'https://www.google-analytics.com/mp/collect'
const DEFAULT_TIMEOUT_MS = 8000
const MAX_ATTEMPTS = 3
const INITIAL_RETRY_DELAY_MS = 500

function isGa4Configured() {
  return Boolean(process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET)
}

/** One-line startup status (never logs the API secret). */
function logGa4StartupStatus() {
  const measurementId = process.env.GA4_MEASUREMENT_ID?.trim()
  const hasSecret = Boolean(process.env.GA4_API_SECRET?.trim())

  if (measurementId && hasSecret) {
    console.log(
      `GA4 Measurement Protocol: enabled (${measurementId}) — server-side begin_checkout & purchase`
    )
    return
  }

  const missing = []
  if (!measurementId) missing.push('GA4_MEASUREMENT_ID')
  if (!hasSecret) missing.push('GA4_API_SECRET')
  console.warn(
    `GA4 Measurement Protocol: disabled (missing ${missing.join(', ')}) — set in server/.env to track checkout/purchase`
  )
}

function isRetryableError(err) {
  if (!err) return false
  const code = err.code
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ENOTFOUND') {
    return true
  }
  const status = err.response?.status
  return status === 429 || (status >= 500 && status < 600)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * POST to GA4 Measurement Protocol with timeout and exponential backoff retries.
 * Never throws — failures are logged and swallowed so callers stay stable.
 *
 * @see https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference
 */
async function sendGa4Event(payload, options = {}) {
  if (!isGa4Configured()) {
    return { ok: false, skipped: true, reason: 'not_configured' }
  }

  const measurementId = process.env.GA4_MEASUREMENT_ID
  const apiSecret = process.env.GA4_API_SECRET
  const timeout = Number(process.env.GA4_REQUEST_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  const maxAttempts = Number(process.env.GA4_MAX_RETRIES) || MAX_ATTEMPTS

  const url = `${COLLECT_URL}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`

  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout,
        validateStatus: (status) => status >= 200 && status < 300,
      })
      return { ok: true, status: response.status, attempt }
    } catch (err) {
      lastError = err
      const retryable = isRetryableError(err)
      if (!retryable || attempt === maxAttempts) {
        const message = err.response?.data || err.message
        console.error(
          `GA4 Measurement Protocol failed (attempt ${attempt}/${maxAttempts}):`,
          message
        )
        return { ok: false, error: message, attempt }
      }
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(
        `GA4 Measurement Protocol retry ${attempt}/${maxAttempts} in ${delay}ms:`,
        err.code || err.message
      )
      await sleep(delay)
    }
  }

  return { ok: false, error: lastError?.message, attempt: maxAttempts }
}

module.exports = {
  isGa4Configured,
  logGa4StartupStatus,
  sendGa4Event,
}
