const mongoose = require('mongoose')

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: '', trim: true },
    source: { type: String, default: 'footer', trim: true },
    status: {
      type: String,
      enum: ['subscribed', 'unsubscribed'],
      default: 'subscribed',
      index: true,
    },
    subscribedAt: { type: Date, default: Date.now },
    unsubscribedAt: { type: Date },
    lastSeenAt: { type: Date },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema)
