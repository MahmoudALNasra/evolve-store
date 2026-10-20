/**
 * Email customers with unpaid / awaiting-payment orders.
 *
 * Usage (on droplet, from /var/www/evolve-store/server):
 *   DRY_RUN=1 npm run orders:followup-pending
 *   npm run orders:followup-pending
 *
 * Optional:
 *   LIMIT=2              max orders (default 2)
 *   ORDER_ID=...         only one order
 */
require('dotenv').config()
const connectDB = require('../config/db')
const Order = require('../models/Order')
// Required so Order.populate('user') can resolve the model in this standalone script.
require('../models/User')
const {
  isEmailConfigured,
  sendPendingPaymentFollowUp,
  logEmailStartupStatus,
} = require('../services/emailService')

async function main() {
  await connectDB()
  logEmailStartupStatus()

  if (!isEmailConfigured() && process.env.DRY_RUN !== '1') {
    console.error('Aborting: email provider is not configured.')
    process.exitCode = 1
    return
  }

  const filter = {
    isPaid: { $ne: true },
    status: 'pending',
  }
  if (process.env.ORDER_ID) filter._id = process.env.ORDER_ID

  const limit = Math.max(1, Number(process.env.LIMIT || 2))
  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email')

  console.log(`Found ${orders.length} unpaid pending order(s)`)

  if (process.env.DRY_RUN === '1') {
    orders.forEach((o) => {
      console.log(
        `- ${o._id} | ${o.user?.email || 'NO EMAIL'} | ${o.user?.name || '—'} | total=${o.total} | ${o.createdAt?.toISOString?.() || ''}`
      )
    })
    return
  }

  let sent = 0
  let failed = 0

  for (const order of orders) {
    const ok = await sendPendingPaymentFollowUp({ order, user: order.user })
    if (ok) {
      sent += 1
      console.log(`Sent → ${order.user?.email} (${order._id})`)
    } else {
      failed += 1
      console.error(`Failed → ${order.user?.email || 'no-email'} (${order._id})`)
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  console.log(`Done. sent=${sent} failed=${failed}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    const mongoose = require('mongoose')
    await mongoose.connection.close().catch(() => {})
  })
