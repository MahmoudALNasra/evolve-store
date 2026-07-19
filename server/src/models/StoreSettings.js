const mongoose = require('mongoose')

// Singleton document — always read/written through StoreSettings.get()/update().
const storeSettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'store', unique: true },
    storeName: { type: String, default: 'Evolve Specialty Pharmacy & Wellness', trim: true },
    supportEmail: { type: String, default: 'support@evolvepharmacy.com', trim: true, lowercase: true },
    currency: { type: String, default: 'USD', trim: true, uppercase: true },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
  },
  { timestamps: true }
)

storeSettingsSchema.statics.get = async function () {
  return this.findOneAndUpdate(
    { singletonKey: 'store' },
    { $setOnInsert: { singletonKey: 'store' } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )
}

storeSettingsSchema.statics.update = async function (fields = {}) {
  const allowed = {}
  if (typeof fields.storeName === 'string' && fields.storeName.trim()) {
    allowed.storeName = fields.storeName.trim()
  }
  if (typeof fields.supportEmail === 'string' && fields.supportEmail.trim()) {
    allowed.supportEmail = fields.supportEmail.trim()
  }
  if (typeof fields.currency === 'string' && fields.currency.trim()) {
    allowed.currency = fields.currency.trim().toUpperCase()
  }
  if (fields.lowStockThreshold != null && Number.isFinite(Number(fields.lowStockThreshold))) {
    allowed.lowStockThreshold = Math.max(0, Number(fields.lowStockThreshold))
  }

  return this.findOneAndUpdate(
    { singletonKey: 'store' },
    { $set: allowed, $setOnInsert: { singletonKey: 'store' } },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
  )
}

module.exports = mongoose.model('StoreSettings', storeSettingsSchema)
