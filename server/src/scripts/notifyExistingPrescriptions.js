/**
 * Email existing refill/transfer prescription requests to pharmacy inboxes.
 *
 * Usage (on droplet, from /var/www/evolve-store/server):
 *   node src/scripts/notifyExistingPrescriptions.js
 *
 * Optional env:
 *   PRESCRIPTION_ID=...   only one request
 *   TYPE=refill|transfer  filter by type
 *   STATUS=pending        filter by status (default: all)
 *   LIMIT=100             max rows (default 200)
 *   DRY_RUN=1             list only, do not send
 */
require('dotenv').config()
const connectDB = require('../config/db')
const Prescription = require('../models/Prescription')
const {
  isEmailConfigured,
  sendPrescriptionNotification,
  logEmailStartupStatus,
} = require('../services/emailService')

async function main() {
  await connectDB()
  logEmailStartupStatus()

  if (!isEmailConfigured() && process.env.DRY_RUN !== '1') {
    console.error('Aborting: email provider is not configured (RESEND_API_KEY + EMAIL_FROM).')
    process.exitCode = 1
    return
  }

  const filter = {}
  if (process.env.PRESCRIPTION_ID) filter._id = process.env.PRESCRIPTION_ID
  if (process.env.TYPE && ['refill', 'transfer'].includes(process.env.TYPE)) {
    filter.type = process.env.TYPE
  }
  if (process.env.STATUS) filter.status = process.env.STATUS

  const limit = Math.max(1, Number(process.env.LIMIT || 200))
  const docs = await Prescription.find(filter).sort({ createdAt: -1 }).limit(limit)

  console.log(`Found ${docs.length} prescription(s)`)
  console.log(
    `Notify to: ${process.env.PRESCRIPTION_NOTIFY_EMAIL || 'info@evolvepharmacy.com,evolvepharmacy01@gmail.com'}`
  )

  if (process.env.DRY_RUN === '1') {
    docs.forEach((d) => {
      console.log(`- ${d._id} | ${d.type} | ${d.status} | ${d.patientName} | ${d.createdAt?.toISOString?.() || ''}`)
    })
    return
  }

  let sent = 0
  let failed = 0
  const delayMs = Math.max(0, Number(process.env.DELAY_MS || 200))

  for (const doc of docs) {
    const ok = await sendPrescriptionNotification(doc)
    if (ok) {
      sent += 1
      console.log(`Sent ${doc.type} ${doc._id} (${doc.patientName})`)
    } else {
      failed += 1
      console.error(`Failed ${doc.type} ${doc._id} (${doc.patientName})`)
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs))
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
    const mongoose = require('mongoose')
    await mongoose.connection.close().catch(() => {})
  })
