/** Shared pharmacy contact details for storefront pages */
export const PHARMACY_PHONE_DISPLAY = '(210) 314-6464'
export const PHARMACY_PHONE_TEL = '+12103146464'
export const PHARMACY_EMAIL = 'info@evolvepharmacy.com'
export const PHARMACY_ADDRESS_LINES = [
  '19239 Stone Oak Pkwy Ste 103',
  'San Antonio, TX 78258',
]
export const PHARMACY_MAPS_QUERY = '19239 Stone Oak Pkwy Ste 103, San Antonio, TX 78258'
export const PHARMACY_MAPS_EMBED_URL =
  `https://maps.google.com/maps?q=${encodeURIComponent(PHARMACY_MAPS_QUERY)}&z=15&output=embed`
export const PHARMACY_MAPS_LINK =
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(PHARMACY_MAPS_QUERY)}`

/** Display hours (matches Google Business listing) */
export const PHARMACY_HOURS = [
  { days: 'Monday – Thursday', hours: '9:00 AM – 5:00 PM' },
  { days: 'Friday', hours: '9:00 AM – 6:00 PM' },
  { days: 'Saturday – Sunday', hours: 'Closed' },
]

export const PHARMACY_HOURS_SHORT = 'Mon–Thu 9 AM–5 PM · Fri 9 AM–6 PM · Sat–Sun Closed'

/** Schema.org OpeningHoursSpecification entries */
export const PHARMACY_OPENING_HOURS_SPEC = [
  {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    opens: '09:00',
    closes: '17:00',
  },
  {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: 'Friday',
    opens: '09:00',
    closes: '18:00',
  },
]
