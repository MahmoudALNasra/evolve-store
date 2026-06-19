export function formatShortDate(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatDateRange(minDate, maxDate) {
  const min = formatShortDate(minDate)
  const max = formatShortDate(maxDate)
  if (!min) return ''
  if (!max || min === max) return min
  return `${min} – ${max}`
}

export function formatCutoffCountdown(minutesUntilCutoff) {
  if (!Number.isFinite(minutesUntilCutoff) || minutesUntilCutoff <= 0) return null
  const hours = Math.floor(minutesUntilCutoff / 60)
  const minutes = minutesUntilCutoff % 60
  if (hours <= 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}
