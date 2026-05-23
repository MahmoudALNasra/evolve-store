const Product = require('../models/Product')
const { sendGa4Event, isGa4Configured } = require('../utils/ga4MeasurementProtocol')
const { buildGa4TransactionParams } = require('../utils/ga4Ecommerce')
const {
  buildGa4UserData,
  parseDeviceFromUserAgent,
  getClientIp,
  hashUserAgent,
  hashIpAddress,
  normalizeIp,
} = require('../utils/ga4UserData')

const ENGAGEMENT_TIME_MSEC = 100

async function loadProductMap(order) {
  const ids = (order.items || []).map((i) => i.product).filter(Boolean)
  if (ids.length === 0) return new Map()
  const products = await Product.find({ _id: { $in: ids } }).select('sku category').lean()
  return new Map(products.map((p) => [p._id.toString(), p]))
}

function resolveClientId(order, user) {
  const fromOrder = order.analyticsContext?.ga4ClientId
  if (fromOrder?.trim()) return fromOrder.trim()
  const userId = user?._id?.toString() || order.user?._id?.toString() || order.user?.toString()
  return userId ? `srv.${userId}` : `srv.${order._id}`
}

function buildMeasurementPayload({ order, user, eventName, eventParams, context = {} }) {
  const userId = user?._id?.toString() || order.user?._id?.toString() || order.user?.toString()
  const clientId = resolveClientId(order, user)

  const ip =
    normalizeIp(context.clientIp) ||
    normalizeIp(order.analyticsContext?.clientIp) ||
    null
  const userAgent = context.userAgent || order.analyticsContext?.userAgent || ''

  const payload = {
    client_id: clientId,
    events: [
      {
        name: eventName,
        params: {
          ...eventParams,
          engagement_time_msec: ENGAGEMENT_TIME_MSEC,
          ...(hashUserAgent(userAgent) ? { hashed_user_agent: hashUserAgent(userAgent) } : {}),
          ...(hashIpAddress(ip) ? { hashed_ip_address: hashIpAddress(ip) } : {}),
        },
      },
    ],
  }

  if (userId) payload.user_id = userId

  const userData = buildGa4UserData({
    email: user?.email || context.email,
    phone: context.phone,
    name: user?.name,
    shippingAddress: order.shippingAddress,
  })
  if (userData) payload.user_data = userData

  // GA4 geo matching requires plain IP (not hashed).
  if (ip) payload.ip_override = ip

  const device = parseDeviceFromUserAgent(userAgent)
  if (device) payload.device = device

  return payload
}

/**
 * Fire-and-forget wrapper — never rejects.
 */
function trackGa4EventSafe(promiseFactory) {
  if (!isGa4Configured()) return
  Promise.resolve()
    .then(promiseFactory)
    .catch((err) => console.error('GA4 tracking error:', err.message))
}

/**
 * Server-side `begin_checkout` when an order is created at checkout.
 */
async function trackBeginCheckout(order, user, req) {
  const productById = await loadProductMap(order)
  const params = buildGa4TransactionParams(order, productById)

  const payload = buildMeasurementPayload({
    order,
    user,
    eventName: 'begin_checkout',
    eventParams: params,
    context: {
      clientIp: getClientIp(req),
      userAgent: req?.get?.('user-agent'),
      email: user?.email,
    },
  })

  return sendGa4Event(payload)
}

/**
 * Server-side `purchase` after Stripe payment succeeds.
 */
async function trackPurchase(order, user, options = {}) {
  const productById = await loadProductMap(order)
  const params = buildGa4TransactionParams(order, productById)

  const payload = buildMeasurementPayload({
    order,
    user,
    eventName: 'purchase',
    eventParams: params,
    context: {
      clientIp: order.analyticsContext?.clientIp,
      userAgent: order.analyticsContext?.userAgent,
      email: user?.email || options.email,
      phone: options.phone,
    },
  })

  if (order.paidAt) {
    payload.timestamp_micros = Math.floor(new Date(order.paidAt).getTime() * 1000)
  }

  return sendGa4Event(payload)
}

module.exports = {
  isGa4Configured,
  trackBeginCheckout,
  trackPurchase,
  trackGa4EventSafe,
  buildMeasurementPayload,
}
