const mongoose = require('mongoose')

const inventorySyncProductSchema = new mongoose.Schema(
  {
    sheetId: { type: String, required: true, index: true },
    sheetName: { type: String, default: '' },
    rowNumber: { type: Number, required: true },
    barcode: { type: String, default: '', index: true },
    sku: { type: String, default: '', index: true },
    sourceHash: { type: String, required: true },
    payloadHash: { type: String, required: true },
    sourceRow: { type: mongoose.Schema.Types.Mixed, default: {} },
    websitePayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    websiteProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    merchantOfferId: { type: String, default: '' },
    merchantFeedLink: { type: String, default: '' },
    merchantFeedLinkSyncedAt: { type: Date },
    lastSyncedAt: { type: Date },
    syncStatus: {
      type: String,
      enum: ['pending', 'synced', 'failed'],
      default: 'pending',
      index: true,
    },
    lastError: { type: String, default: '' },
  },
  { timestamps: true }
)

inventorySyncProductSchema.index(
  { sheetId: 1, rowNumber: 1 },
  { unique: true }
)

module.exports = mongoose.model('InventorySyncProduct', inventorySyncProductSchema)
