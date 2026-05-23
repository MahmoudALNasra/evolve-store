const SHIP_FROM = {
  name: process.env.SHIP_FROM_NAME || 'Evolve Specialty Pharmacy & Wellness',
  line1: process.env.SHIP_FROM_LINE1 || '19239 Stone Oak Pkwy Ste # 103',
  city: process.env.SHIP_FROM_CITY || 'San Antonio',
  state: process.env.SHIP_FROM_STATE || 'TX',
  zip: process.env.SHIP_FROM_ZIP || '78258',
  country: 'US',
  phone: process.env.SHIP_FROM_PHONE || '2105550100',
  email: process.env.SHIP_FROM_EMAIL || process.env.SUPPORT_EMAIL || 'support@evolvepharmacy.com',
}

const DEFAULT_PARCEL = {
  lengthIn: Number(process.env.SHIP_PARCEL_LENGTH_IN) || 8,
  widthIn: Number(process.env.SHIP_PARCEL_WIDTH_IN) || 6,
  heightIn: Number(process.env.SHIP_PARCEL_HEIGHT_IN) || 4,
  weightLb: Number(process.env.SHIP_PARCEL_WEIGHT_LB) || 1,
}

module.exports = { SHIP_FROM, DEFAULT_PARCEL }
