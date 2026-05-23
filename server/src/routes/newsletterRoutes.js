const express = require('express')
const NewsletterSubscriber = require('../models/NewsletterSubscriber')
const { protect, admin } = require('../middleware/auth')

const router = express.Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const getClientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.socket?.remoteAddress ||
  ''

// POST /api/newsletter/subscribe
router.post('/subscribe', async (req, res) => {
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase()
  const cleanName = String(req.body?.name || '').trim().slice(0, 120)
  const cleanSource = String(req.body?.source || 'footer').trim().slice(0, 80) || 'footer'

  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ message: 'Please enter a valid email address' })
  }

  const subscriber = await NewsletterSubscriber.findOneAndUpdate(
    { email: cleanEmail },
    {
      $set: {
        name: cleanName,
        source: cleanSource,
        status: 'subscribed',
        unsubscribedAt: undefined,
        lastSeenAt: new Date(),
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || '',
      },
      $setOnInsert: {
        subscribedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )

  res.status(201).json({
    message: 'You are subscribed to our newsletter.',
    subscriber: {
      email: subscriber.email,
      status: subscriber.status,
    },
  })
})

// GET /api/newsletter/subscribers?format=csv
router.get('/subscribers', protect, admin, async (req, res) => {
  const subscribers = await NewsletterSubscriber.find({ status: 'subscribed' })
    .sort({ subscribedAt: -1 })
    .select('email name source subscribedAt')
    .lean()

  if (req.query.format === 'csv') {
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = [
      ['email', 'name', 'source', 'subscribedAt'].map(escapeCsv).join(','),
      ...subscribers.map((s) =>
        [s.email, s.name, s.source, s.subscribedAt?.toISOString?.() || ''].map(escapeCsv).join(',')
      ),
    ]

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="newsletter-subscribers.csv"')
    return res.send(rows.join('\n'))
  }

  res.json({ count: subscribers.length, subscribers })
})

module.exports = router
