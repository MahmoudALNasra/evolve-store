const express = require('express')
const { sendContactMessage } = require('../services/emailService')
const { validateContactSubmission } = require('../utils/contactSpamGuard')

const router = express.Router()

// POST /api/contact
router.post('/', async (req, res) => {
  const spamCheck = validateContactSubmission(req.body)
  if (!spamCheck.ok) {
    if (spamCheck.silent) {
      console.warn(`Blocked bot contact (${spamCheck.code}) from ${req.ip}`)
      res.locals.skipAudit = true
      // Look successful to bots so they stop retrying variants
      return res.status(201).json({ message: 'Message sent successfully' })
    }
    return res.status(400).json({ message: spamCheck.message })
  }

  const {
    name = '',
    email = '',
    phone = '',
    subject = '',
    message = '',
  } = req.body || {}

  const cleanName = String(name).trim()
  const cleanEmail = String(email).trim().toLowerCase()
  const cleanPhone = String(phone).trim()
  const cleanSubject = String(subject).trim()
  const cleanMessage = String(message).trim()

  const sent = await sendContactMessage({
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    subject: cleanSubject,
    message: cleanMessage,
  })

  if (!sent) {
    return res.status(500).json({ message: 'Unable to send message right now' })
  }

  res.status(201).json({ message: 'Message sent successfully' })
})

module.exports = router
