// UPS-only tracking utilities (we ship exclusively via UPS)

export const CARRIER_NAME = 'UPS'

// Build a UPS tracking URL
export const getUPSTrackingUrl = (trackingNumber) =>
  `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`

// Validate UPS tracking number format
// Standard formats:
//   1Z + 16 alphanumeric  (most common, e.g. 1Z999AA10123456784)
//   T + 10 digits          (UPS Mail Innovations)
//   9 digits               (UPS Freight reference)
export const isValidUPSTracking = (num) => {
  if (!num) return false
  const t = num.replace(/\s+/g, '').toUpperCase()
  return /^1Z[A-Z0-9]{16}$/.test(t) || /^T\d{10}$/.test(t) || /^\d{9}$/.test(t)
}

// Get tracking info for display
export const getTrackingInfo = (trackingNumber) => {
  if (!trackingNumber) return null
  return {
    carrierName: CARRIER_NAME,
    url: getUPSTrackingUrl(trackingNumber),
    isValid: isValidUPSTracking(trackingNumber),
  }
}
