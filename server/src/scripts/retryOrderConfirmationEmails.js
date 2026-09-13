/**
 * Retry confirmation emails for paid orders that never got one.
 * Usage: node src/scripts/retryOrderConfirmationEmails.js
 * Optional: ORDER_ID=... node src/scripts/retryOrderConfirmationEmails.js
 */
require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const Order = require('../models/Order')
const { isEmailConfigured, sendOrderConfirmation, logEmailStartupStatus } = require('../services/emailService')
const { resolveRecipient } = require('../services/orderFulfillmentService')

async function main() {
  await connectDB()
  logEmailStartupStatus()

  if (!isEmailConfigured()) {
    console.error('Aborting: email provider is not configured.')
    process.exitCode = 1
    return
  }

  const filter = {
    isPaid: true,
    confirmationEmailSent: { $ne: true },
  }
  if (process.env.ORDER_ID) {
    filter._id = process.env.ORDER_ID
    delete filter.confirmationEmailSent
  }

  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(process.env.LIMIT || 50))
    .populate('user', 'name email')

  console.log(`Found ${orders.length} order(s) to retry`)

  let sent = 0
  let failed = 0

  for (const order of orders) {
    const recipient = await resolveRecipient(order, null)
    if (!recipient?.email) {
      console.warn(`Skip ${order._id}: no email`)
      failed += 1
      continue
    }

    const ok = await sendOrderConfirmation(order, recipient)
    if (ok) {
      order.confirmationEmailSent = true
      await order.save()
      sent += 1
      console.log(`Sent confirmation for ${order._id} → ${recipient.email}`)
    } else {
      failed += 1
      console.error(`Failed confirmation for ${order._id} → ${recipient.email}`)
    }
  }

  console.log(`Done. sent=${sent} failed=${failed}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {})
  })
