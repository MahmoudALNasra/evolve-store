const PICKUP_ADDRESS = {
  name: 'Evolve Specialty Pharmacy & Wellness',
  line1: '19239 Stone Oak Pkwy Ste # 103',
  city: 'San Antonio',
  state: 'TX',
  zip: '78258',
}

function validatePickupTime(value) {
  if (!value || typeof value !== 'string') return 'Preferred pickup time is required'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid pickup time'
  if (date.getTime() < Date.now() - 5 * 60 * 1000) return 'Pickup time must be in the future'
  const day = date.getDay()
  if (day === 0 || day === 6) return 'Pickup is available Monday through Friday only'

  const minutes = date.getHours() * 60 + date.getMinutes()
  if (minutes < 9 * 60 || minutes > 16 * 60 + 45) {
    return 'Pickup must be between 9:00 AM and 4:45 PM'
  }
  return null
}

function formatPickupTime(value) {
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

module.exports = { PICKUP_ADDRESS, validatePickupTime, formatPickupTime }
