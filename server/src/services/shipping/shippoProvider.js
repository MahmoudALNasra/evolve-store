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

async function createShipmentWithRates({ toAddress, user, weightLb, carrierAccountIds } = {}) {
  const parcel = {
    length: String(DEFAULT_PARCEL.lengthIn),
    width: String(DEFAULT_PARCEL.widthIn),
    height: String(DEFAULT_PARCEL.heightIn),
    distance_unit: 'in',
    weight: String(weightLb || DEFAULT_PARCEL.weightLb),
    mass_unit: 'lb',
  }

  const payload = {
    address_from: toShippoFrom(),
    address_to: toShippoTo(toAddress, user),
    parcels: [parcel],
    async: false,
  }

  const accounts = Array.isArray(carrierAccountIds)
    ? carrierAccountIds.filter(Boolean)
    : String(process.env.SHIPPO_UPS_CARRIER_ACCOUNT_ID || process.env.SHIPPO_CARRIER_ACCOUNT_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

  if (accounts.length) {
    payload.carrier_accounts = accounts
  }

  const { data } = await axios.post(
    `${SHIPPO_API}/shipments/`,
    payload,
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

async function purchaseLabel({ rateObjectId, labelFileType = 'PDF_4x6' }) {
  if (!rateObjectId) {
    throw new Error('Missing Shippo rate id — create a live shipping rate at checkout first')
  }

  const tryTypes = [labelFileType, 'PDF'].filter((v, i, a) => v && a.indexOf(v) === i)

  let lastError = null
  for (const fileType of tryTypes) {
    try {
      const { data } = await axios.post(
        `${SHIPPO_API}/transactions/`,
        {
          rate: rateObjectId,
          label_file_type: fileType,
          async: false,
        },
        { headers: shippoHeaders(), timeout: 45000 }
      )

      if (data.status === 'ERROR' || data.status === 'ERROR_CREATING' || !data.label_url) {
        const msg = (data.messages || []).map((m) => m.text).filter(Boolean).join('; ')
          || 'Shippo could not create the shipping label'
        lastError = new Error(msg)
        lastError.shippo = data
        continue
      }

      return {
        transactionId: data.object_id,
        status: data.status,
        trackingNumber: data.tracking_number || '',
        trackingUrl: data.tracking_url_provider || '',
        labelUrl: data.label_url || '',
        commercialInvoiceUrl: data.commercial_invoice_url || '',
        carrier: data.rate?.provider || '',
        labelFileType: fileType,
      }
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('Could not purchase shipping label')
}

module.exports = {
  isConfigured,
  createShipmentWithRates,
  purchaseLabel,
  toShippoFrom,
  toShippoTo,
}
