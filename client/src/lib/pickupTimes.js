export const PICKUP_ADDRESS = {
  name: 'Evolve Specialty Pharmacy & Wellness',
  line1: '19239 Stone Oak Pkwy Ste # 103',
  city: 'San Antonio',
  state: 'TX',
  zip: '78258',
}

const OPEN_HOUR = 9
const CLOSE_HOUR = 17
const LAST_PICKUP_HOUR = 16
const LAST_PICKUP_MINUTE = 45
const INTERVAL_MINUTES = 15

const isBusinessDay = (date) => {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

const nextBusinessDay = (date) => {
  const next = new Date(date)
  next.setDate(next.getDate() + 1)
  next.setHours(OPEN_HOUR, 0, 0, 0)
  while (!isBusinessDay(next)) next.setDate(next.getDate() + 1)
  return next
}

const roundUpToInterval = (date) => {
  const rounded = new Date(date)
  const mins = rounded.getMinutes()
  const add = (INTERVAL_MINUTES - (mins % INTERVAL_MINUTES)) % INTERVAL_MINUTES
  rounded.setMinutes(mins + add, 0, 0)
  return rounded
}

const lastPickupFor = (date) => {
  const last = new Date(date)
  last.setHours(LAST_PICKUP_HOUR, LAST_PICKUP_MINUTE, 0, 0)
  return last
}

function earliestPickup(now = new Date()) {
  if (!isBusinessDay(now) || now >= lastPickupFor(now)) return nextBusinessDay(now)

  const plusOneHour = new Date(now.getTime() + 60 * 60 * 1000)
  let earliest = new Date(plusOneHour)
  earliest.setSeconds(0, 0)
  const last = lastPickupFor(now)

  if (earliest > last) earliest = last
  if (earliest.getHours() < OPEN_HOUR) earliest.setHours(OPEN_HOUR, 0, 0, 0)
  return earliest
}

const formatLabel = (date) => {
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} at ${time}`
}

const formatTimeLabel = (date) =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

const pad = (value) => String(value).padStart(2, '0')

const toDateValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const toTimeValue = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

const dateFromValue = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const isSameDay = (a, b) => toDateValue(a) === toDateValue(b)

export function getPickupOptions(now = new Date(), businessDays = 5) {
  const first = earliestPickup(now)
  const options = []
  const seen = new Set()
  let day = new Date(first)

  while (options.length < businessDays * 32) {
    if (isBusinessDay(day)) {
      const start = new Date(day)
      start.setHours(OPEN_HOUR, 0, 0, 0)
      const end = lastPickupFor(day)
      let slot = new Date(Math.max(start.getTime(), first.toDateString() === day.toDateString() ? first.getTime() : start.getTime()))

      while (slot <= end) {
        const value = slot.toISOString()
        if (!seen.has(value)) {
          options.push({ value, label: formatLabel(slot) })
          seen.add(value)
        }

        const nextQuarter = roundUpToInterval(new Date(slot.getTime() + 60 * 1000))
        slot = nextQuarter <= slot ? new Date(slot.getTime() + INTERVAL_MINUTES * 60 * 1000) : nextQuarter
      }
    }

    const uniqueDays = new Set(options.map((o) => new Date(o.value).toDateString()))
    if (uniqueDays.size >= businessDays) break
    day = nextBusinessDay(day)
  }

  return options
}

export function getPickupDefaults(now = new Date()) {
  const first = earliestPickup(now)
  return {
    date: toDateValue(first),
    time: toTimeValue(first),
    value: first.toISOString(),
    label: formatLabel(first),
  }
}

export function getPickupDateBounds(now = new Date(), daysAhead = 30) {
  const first = earliestPickup(now)
  const max = new Date(now)
  max.setDate(max.getDate() + daysAhead)
  return {
    min: toDateValue(first),
    max: toDateValue(max),
  }
}

export function getPickupTimeOptionsForDate(dateValue, now = new Date()) {
  const selectedDate = dateFromValue(dateValue)
  if (!selectedDate || !isBusinessDay(selectedDate)) return []

  const first = earliestPickup(now)
  const start = new Date(selectedDate)
  start.setHours(OPEN_HOUR, 0, 0, 0)

  const end = lastPickupFor(selectedDate)
  let slot = isSameDay(selectedDate, first) && first > start ? new Date(first) : start
  const options = []

  while (slot <= end) {
    options.push({ value: toTimeValue(slot), label: formatTimeLabel(slot) })
    const nextQuarter = roundUpToInterval(new Date(slot.getTime() + 60 * 1000))
    slot = nextQuarter <= slot ? new Date(slot.getTime() + INTERVAL_MINUTES * 60 * 1000) : nextQuarter
  }

  return options
}

export function buildPickupDateTime(dateValue, timeValue) {
  const date = dateFromValue(dateValue)
  if (!date || !timeValue) return ''
  const [hours, minutes] = String(timeValue).split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return ''
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

export const formatPickupAddress = () =>
  `${PICKUP_ADDRESS.line1}, ${PICKUP_ADDRESS.city}, ${PICKUP_ADDRESS.state} ${PICKUP_ADDRESS.zip}`
