const mongoose = require('mongoose')

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  image: { type: String, default: '' },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
})

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    shippingAddress: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    fulfillmentMethod: {
      type: String,
      enum: ['shipping', 'pickup'],
      default: 'shipping',
    },
    pickup: {
      requestedAt: { type: Date },
      display: { type: String, default: '' },
      address: {
        name: { type: String, default: '' },
        line1: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        zip: { type: String, default: '' },
      },
    },
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    shippingMethod: {
      provider: { type: String, default: '' },
      shipmentId: { type: String, default: '' },
      rateObjectId: { type: String, default: '' },
      carrier: { type: String, default: '' },
      service: { type: String, default: '' },
      label: { type: String, default: '' },
      amount: { type: Number, default: 0 },
    },
    total: { type: Number, required: true },
    paymentMethod: { type: String, default: 'stripe' },
    stripeSessionId: { type: String, default: '' },
    stripePaymentIntentId: { type: String, default: '' },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    stockReduced: { type: Boolean, default: false },
    trackingNumber: { type: String, default: '' },
    notes: { type: String, default: '' },
    confirmationEmailSent: { type: Boolean, default: false },
    newOrderEmailSent: { type: Boolean, default: false },
    shippedEmailSent: { type: Boolean, default: false },
    ga4BeginCheckoutSent: { type: Boolean, default: false },
    ga4PurchaseSent: { type: Boolean, default: false },
    analyticsContext: {
      clientIp: { type: String, default: '' },
      userAgent: { type: String, default: '' },
      ga4ClientId: { type: String, default: '' },
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Order', orderSchema)
