const axios = require('axios')
const { SHIP_FROM, DEFAULT_PARCEL } = require('../../config/shipFrom')

const SHIPPO_API = 'https://api.goshippo.com'

function isConfigured() {
  return Boolean(process.env.SHIPPO_API_KEY)
}

function shippoHeaders() {
  return {
    Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

function cleanStreet(value) {
  return String(value || '')
    .replace(/#/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toShippoFrom() {
  return {
    name: SHIP_FROM.name,
    street1: cleanStreet(SHIP_FROM.line1),
    city: SHIP_FROM.city,
    state: SHIP_FROM.state,
    zip: String(SHIP_FROM.zip || '').split('-')[0],
    country: 'US',
    phone: SHIP_FROM.phone,
    email: SHIP_FROM.email,
  }
}

function toShippoTo(address = {}, user = {}) {
  const zip = String(address.zip || '').split('-')[0]
  return {
    name: user.name || 'Customer',
    street1: cleanStreet(address.line1),
    street2: cleanStreet(address.line2),
    city: String(address.city || '').trim(),
    state: String(address.state || '').trim().toUpperCase(),
    zip,
    country: 'US',
    phone: address.phone || user.phone || '2105550100',
    email: user.email || 'customer@example.com',
  }
}

function mapRate(rate) {
  const provider = rate.provider || 'Carrier'
  const service = rate.servicelevel?.name || rate.servicelevel_name || 'Standard'
  const amount = Number(rate.amount)
  return {
    objectId: rate.object_id,
    amount,
    currency: rate.currency || 'USD',
    provider,
    service,
    estimatedDays: rate.estimated_days ?? null,
    label: `${provider} — ${service}`,
  }
}

async function createShipmentWithRates({ toAddress, user, weightLb }) {
  const parcel = {
    length: String(DEFAULT_PARCEL.lengthIn),
    width: String(DEFAULT_PARCEL.widthIn),
    height: String(DEFAULT_PARCEL.heightIn),
    distance_unit: 'in',
    weight: String(weightLb || DEFAULT_PARCEL.weightLb),
    mass_unit: 'lb',
  }

  const { data } = await axios.post(
    `${SHIPPO_API}/shipments/`,
    {
      address_from: toShippoFrom(),
      address_to: toShippoTo(toAddress, user),
      parcels: [parcel],
      async: false,
    },
    { headers: shippoHeaders(), timeout: 30000 }
  )

  const messages = data.messages || []
  if (messages.length) {
    console.warn('Shippo shipment messages:', messages)
  }

  const rates = (data.rates || [])
    .map(mapRate)
    .filter((r) => Number.isFinite(r.amount) && r.amount >= 0)
    .sort((a, b) => a.amount - b.amount)

  return {
    shipmentId: data.object_id,
    rates,
    messages,
  }
}

module.exports = {
  isConfigured,
  createShipmentWithRates,
}
