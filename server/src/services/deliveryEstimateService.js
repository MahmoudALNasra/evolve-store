const shippo = require('./shipping/shippoProvider')
const { resolveDestination } = require('./zipLookupService')
const { SHIP_FROM } = require('../config/shipFrom')
const { getShippingZone } = require('../utils/shippingRates')
const { TZ, CUTOFF_HOUR, CUTOFF_MINUTE } = require('../utils/shippingCutoff')

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map()

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ZONE_DELIVERY_DAYS = {
  local: { min: 1, max: 2 },
  nearby: { min: 2, max: 3 },
  contiguous: { min: 3, max: 5 },
  remote: { min: 5, max: 7 },
  unknown: { min: 3, max: 5 },
}

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

function buildEstimateAddress(destination) {
  return {
    line1: '100 Main St',
    city: destination.city || 'San Antonio',
    state: destination.state || 'TX',
    zip: destination.zip,
    country: 'United States',
  }
}

function isUpsGroundRate(rate) {
  const provider = String(rate.provider || '').toLowerCase()
  const service = String(rate.service || '').toLowerCase()
  return provider.includes('ups') && service.includes('ground')
}

function pickBestRate(rates = []) {
  if (!rates.length) return null

  const upsGround = rates.find(isUpsGroundRate)
  if (upsGround?.estimatedDays != null) return upsGround

  const upsWithDays = rates.find((rate) => {
    const provider = String(rate.provider || '').toLowerCase()
    const days = Number(rate.estimatedDays)
    return provider.includes('ups') && Number.isFinite(days) && days > 0
  })
  if (upsWithDays) return upsWithDays

  const withDays = rates
    .filter((rate) => {
      const days = Number(rate.estimatedDays)
      return Number.isFinite(days) && days > 0
    })
    .sort((a, b) => Number(a.estimatedDays) - Number(b.estimatedDays))

  return withDays[0] || null
}

function getZoneDeliveryDays(destination) {
  const originPrefix = String(SHIP_FROM.zip || '').slice(0, 3)
  const destPrefix = String(destination.zip || '').slice(0, 3)

  if (destination.state === 'TX') {
    if (destination.zip === SHIP_FROM.zip || destPrefix === originPrefix) {
      return { min: 1, max: 1, zone: 'local-metro' }
    }
    return { ...ZONE_DELIVERY_DAYS.local, zone: 'local' }
  }

  const zone = getShippingZone({ state: destination.state })
  return { ...(ZONE_DELIVERY_DAYS[zone] || ZONE_DELIVERY_DAYS.unknown), zone }
}

async function fetchCarrierBusinessDays(destination) {
  if (!shippo.isConfigured()) return null

  const { rates } = await shippo.createShipmentWithRates({
    toAddress: buildEstimateAddress(destination),
    user: { name: 'Estimate Guest', email: 'estimate@example.com' },
  })

  const bestRate = pickBestRate(rates)
  if (!bestRate) return null

  const days = Math.round(Number(bestRate.estimatedDays))
  if (!Number.isFinite(days) || days <= 0) return null

  return {
    min: days,
    max: days,
    source: isUpsGroundRate(bestRate) ? 'shippo-ups-ground' : 'shippo',
    carrier: bestRate.provider,
    service: bestRate.service,
  }
}

function buildEstimatePayload({ minBusinessDays, maxBusinessDays, source, zone }, now = new Date()) {
  const parts = getChicagoParts(now)
  const shipParts = getShipDateParts(now)
  const minParts = addBusinessDaysFromParts(shipParts, minBusinessDays)
  const maxParts = addBusinessDaysFromParts(shipParts, maxBusinessDays)

  const todayParts = { year: parts.year, month: parts.month, day: parts.day }
  const nextBusiness = getNextBusinessDayParts(todayParts)
  const isNextDay = dateKeyFromParts(minParts) === dateKeyFromParts(nextBusiness)

  return {
    minDate: dateKeyFromParts(minParts),
    maxDate: dateKeyFromParts(maxParts),
    businessDays: minBusinessDays,
    businessDaysMax: maxBusinessDays,
    isNextDay,
    cutoffTime: formatCutoffLabel(),
    cutoffHour: CUTOFF_HOUR,
    cutoffMinute: CUTOFF_MINUTE,
    timezone: TZ,
    minutesUntilCutoff: minutesUntilCutoff(now),
    fallback: false,
    source,
    zone,
    shipsFrom: `${SHIP_FROM.city}, ${SHIP_FROM.state}`,
    originZip: SHIP_FROM.zip,
  }
}

function buildFallbackPayload() {
  return {
    fallback: true,
    message: 'Enter your ZIP code for a delivery estimate from our San Antonio pharmacy.',
    cutoffTime: formatCutoffLabel(),
    timezone: TZ,
    minutesUntilCutoff: minutesUntilCutoff(),
    shipsFrom: `${SHIP_FROM.city}, ${SHIP_FROM.state}`,
    originZip: SHIP_FROM.zip,
  }
}

async function getDeliveryEstimate({ zip, city, state }) {
  const destination = await resolveDestination({ zip, city, state })
  if (!destination) {
    return buildFallbackPayload()
  }

  const cacheKey = `${destination.zip}:${destination.city}:${destination.state}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return { ...cached.value, minutesUntilCutoff: minutesUntilCutoff() }
  }

  let minBusinessDays
  let maxBusinessDays
  let source
  let zone

  try {
    const carrier = await fetchCarrierBusinessDays(destination)
    if (carrier) {
      minBusinessDays = carrier.min
      maxBusinessDays = carrier.max
      source = carrier.source
      zone = 'carrier'
    } else {
      const zoneDays = getZoneDeliveryDays(destination)
      minBusinessDays = zoneDays.min
      maxBusinessDays = zoneDays.max
      source = shippo.isConfigured() ? 'zone-fallback' : 'zone'
      zone = zoneDays.zone
    }
  } catch {
    const zoneDays = getZoneDeliveryDays(destination)
    minBusinessDays = zoneDays.min
    maxBusinessDays = zoneDays.max
    source = 'zone-fallback'
    zone = zoneDays.zone
  }

  const payload = buildEstimatePayload({
    minBusinessDays,
    maxBusinessDays,
    source,
    zone,
  })

  cache.set(cacheKey, { value: payload, expiresAt: Date.now() + CACHE_TTL_MS })
  return payload
}

module.exports = {
  getDeliveryEstimate,
  formatCutoffLabel,
  minutesUntilCutoff,
  getZoneDeliveryDays,
  TZ,
  CUTOFF_HOUR,
  CUTOFF_MINUTE,
}
