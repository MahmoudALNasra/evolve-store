const mongoose = require('mongoose')

const medicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dosage: { type: String, default: '', trim: true },
    prescriptionNumber: { type: String, default: '', trim: true },
  },
  { _id: false }
)

const prescriptionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['refill', 'transfer'],
      required: true,
      index: true,
    },

    // Optional link to authenticated user (null for guests)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Patient info
    patientName: { type: String, required: true, trim: true },
    dateOfBirth: { type: String, required: true }, // ISO date string yyyy-mm-dd
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    preferredContactMethod: {
      type: String,
      enum: ['phone', 'email', 'text'],
      default: 'phone',
    },

    // Refill-specific (single medication)
    prescriptionNumber: { type: String, default: '', trim: true },
    medicationName: { type: String, default: '', trim: true },

    // Transfer-specific
    currentPharmacyName: { type: String, default: '', trim: true },
    currentPharmacyPhone: { type: String, default: '', trim: true },
    currentPharmacyAddress: { type: String, default: '', trim: true },
    medications: { type: [medicationSchema], default: [] },

    // Common
    notes: { type: String, default: '', trim: true },

    status: {
      type: String,
      enum: ['pending', 'in_review', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    adminNotes: { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Prescription', prescriptionSchema)
