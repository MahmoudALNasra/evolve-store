const TZ = 'America/Chicago'
const CUTOFF_HOUR = 16
const CUTOFF_MINUTE = 50

function getChicagoParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const weekday = map.weekday
  const hour = Number(map.hour)
  const minute = Number(map.minute)
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
  return { weekday, hour, minute, dayIndex }
}

function isWeekday(dayIndex) {
  return dayIndex >= 1 && dayIndex <= 5
}

function isBeforeCutoff(hour, minute) {
  if (hour < CUTOFF_HOUR) return true
  if (hour === CUTOFF_HOUR && minute < CUTOFF_MINUTE) return true
  return false
}

function getDispatchInfo(now = new Date()) {
  const { dayIndex, hour, minute } = getChicagoParts(now)
  const weekday = isWeekday(dayIndex)
  const beforeCutoff = isBeforeCutoff(hour, minute)
  const sameDayWindow = weekday && beforeCutoff

  return {
    sameDayWindow,
    message: sameDayWindow
      ? 'Order by 4:50 PM CT Monday–Friday for same-day processing. All carrier options shown below.'
      : 'Orders placed after 4:50 PM CT or on weekends ship the next business day.',
  }
}

module.exports = { getDispatchInfo, TZ, CUTOFF_HOUR, CUTOFF_MINUTE }
