const express = require('express')
const { sendContactMessage } = require('../services/emailService')

const router = express.Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /api/contact
router.post('/', async (req, res) => {
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

  if (!cleanName) return res.status(400).json({ message: 'Name is required' })
  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ message: 'Valid email address is required' })
  }
  if (!cleanPhone) return res.status(400).json({ message: 'Phone number is required' })
  if (!cleanSubject) return res.status(400).json({ message: 'Subject is required' })

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
