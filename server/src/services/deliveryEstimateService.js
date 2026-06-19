const shippo = require('./shipping/shippoProvider')
const { TZ, CUTOFF_HOUR, CUTOFF_MINUTE } = require('../utils/shippingCutoff')

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map()

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getChicagoParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]))
  const dayIndex = WEEKDAYS.indexOf(parts.weekday)
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dayIndex,
  }
}

function isWeekendDayIndex(dayIndex) {
  return dayIndex === 0 || dayIndex === 6
}

function isBeforeCutoff(hour, minute) {
  if (hour < CUTOFF_HOUR) return true
  if (hour === CUTOFF_HOUR && minute < CUTOFF_MINUTE) return true
  return false
}

function dateKeyFromParts({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function addCalendarDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  date.setUTCDate(date.getUTCDate() + days)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

function addBusinessDaysFromParts(startParts, businessDays) {
  let current = { ...startParts }
  let added = 0
  while (added < businessDays) {
    current = addCalendarDays(current, 1)
    const dayIndex = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay()
    if (!isWeekendDayIndex(dayIndex)) added += 1
  }
  return current
}

function getShipDateParts(now = new Date()) {
  const parts = getChicagoParts(now)
  const weekday = !isWeekendDayIndex(parts.dayIndex)
  const beforeCutoff = isBeforeCutoff(parts.hour, parts.minute)

  if (weekday && beforeCutoff) {
    return { year: parts.year, month: parts.month, day: parts.day }
  }

  let next = addCalendarDays({ year: parts.year, month: parts.month, day: parts.day }, 1)
  while (isWeekendDayIndex(new Date(Date.UTC(next.year, next.month - 1, next.day)).getUTCDay())) {
    next = addCalendarDays(next, 1)
  }
  return next
}

function getNextBusinessDayParts(fromParts) {
  let next = addCalendarDays(fromParts, 1)
  while (isWeekendDayIndex(new Date(Date.UTC(next.year, next.month - 1, next.day)).getUTCDay())) {
    next = addCalendarDays(next, 1)
  }
  return next
}

function minutesUntilCutoff(now = new Date()) {
  const parts = getChicagoParts(now)
  if (isWeekendDayIndex(parts.dayIndex)) return 0

  const cutoffMinutes = CUTOFF_HOUR * 60 + CUTOFF_MINUTE
  const nowMinutes = parts.hour * 60 + parts.minute
  return Math.max(0, cutoffMinutes - nowMinutes)
}

function formatCutoffLabel() {
  const hour12 = CUTOFF_HOUR % 12 || 12
  const ampm = CUTOFF_HOUR >= 12 ? 'PM' : 'AM'
  const minute = CUTOFF_MINUTE ? `:${String(CUTOFF_MINUTE).padStart(2, '0')}` : ''
  return `${hour12}${minute} ${ampm} CT`
}

function buildEstimateAddress({ zip, city, state }) {
  return {
    line1: '1 Delivery Estimate Ln',
    city: city || 'San Antonio',
    state: state || 'TX',
    zip: String(zip).slice(0, 5),
    country: 'United States',
  }
}

function isUpsGroundRate(rate) {
  const provider = String(rate.provider || '').toLowerCase()
  const service = String(rate.service || '').toLowerCase()
  return provider.includes('ups') && service.includes('ground')
}

async function fetchUpsGroundBusinessDays({ zip, city, state }) {
  if (!shippo.isConfigured()) {
    return { businessDays: 3, source: 'estimate' }
  }

  const { rates } = await shippo.createShipmentWithRates({
    toAddress: buildEstimateAddress({ zip, city, state }),
    user: { name: 'Estimate Guest', email: 'estimate@example.com' },
  })

  const upsGround = rates.find(isUpsGroundRate)
  if (!upsGround) return null

  const days = Number(upsGround.estimatedDays)
  if (Number.isFinite(days) && days > 0) {
    return { businessDays: Math.round(days), source: 'shippo', estimatedDays: upsGround.estimatedDays }
  }

  return { businessDays: 3, source: 'shippo-default' }
}

function buildEstimatePayload(businessDays, now = new Date()) {
  const parts = getChicagoParts(now)
  const shipParts = getShipDateParts(now)
  const minParts = addBusinessDaysFromParts(shipParts, businessDays)
  const maxParts = minParts

  const todayParts = { year: parts.year, month: parts.month, day: parts.day }
  const nextBusiness = getNextBusinessDayParts(todayParts)
  const isNextDay = dateKeyFromParts(minParts) === dateKeyFromParts(nextBusiness)

  return {
    minDate: dateKeyFromParts(minParts),
    maxDate: dateKeyFromParts(maxParts),
    businessDays,
    isNextDay,
    cutoffTime: formatCutoffLabel(),
    cutoffHour: CUTOFF_HOUR,
    cutoffMinute: CUTOFF_MINUTE,
    timezone: TZ,
    minutesUntilCutoff: minutesUntilCutoff(now),
    fallback: false,
  }
}

function buildFallbackPayload() {
  return {
    fallback: true,
    message: 'Free shipping over $150 · Estimated delivery 2–4 business days',
    cutoffTime: formatCutoffLabel(),
    timezone: TZ,
    minutesUntilCutoff: minutesUntilCutoff(),
  }
}

async function getDeliveryEstimate({ zip, city, state }) {
  const cleanZip = String(zip || '').trim().slice(0, 5)
  if (!/^\d{5}$/.test(cleanZip)) {
    return buildFallbackPayload()
  }

  const cacheKey = `${cleanZip}:${city || ''}:${state || ''}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return { ...cached.value, minutesUntilCutoff: minutesUntilCutoff() }
  }

  try {
    const rateInfo = await fetchUpsGroundBusinessDays({ zip: cleanZip, city, state })
    if (!rateInfo) {
      return buildFallbackPayload()
    }

    const payload = buildEstimatePayload(rateInfo.businessDays)
    cache.set(cacheKey, { value: payload, expiresAt: Date.now() + CACHE_TTL_MS })
    return payload
  } catch {
    return buildFallbackPayload()
  }
}

module.exports = {
  getDeliveryEstimate,
  formatCutoffLabel,
  minutesUntilCutoff,
  TZ,
  CUTOFF_HOUR,
  CUTOFF_MINUTE,
}
