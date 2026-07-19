const express = require('express')
const jwt = require('jsonwebtoken')
const Prescription = require('../models/Prescription')
const User = require('../models/User')
const { protect, admin } = require('../middleware/auth')
const { auditWriteLogger } = require('../middleware/auditWriteLogger')
const { logAuditFromReq } = require('../services/auditLogService')

const router = express.Router()
router.use(auditWriteLogger())

// Optionally attach req.user when a valid token is present (does not block request)
const optionalAuth = async (req, _res, next) => {
  try {
    let token
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    } else if (req.cookies?.token) {
      token = req.cookies.token
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.user = await User.findById(decoded.id).select('-password')
    }
  } catch {
    /* ignore — treat as guest */
  }
  next()
}

// POST /api/prescriptions — public submission (refill or transfer)
router.post('/', optionalAuth, async (req, res) => {
  const {
    type,
    patientName,
    dateOfBirth,
    phone,
    email,
    preferredContactMethod,
    prescriptionNumber,
    medicationName,
    currentPharmacyName,
    currentPharmacyPhone,
    currentPharmacyAddress,
    medications,
    notes,
  } = req.body

  if (!['refill', 'transfer'].includes(type)) {
    return res.status(400).json({ message: 'Invalid prescription type' })
  }
  if (!patientName || !dateOfBirth || !phone || !email) {
    return res.status(400).json({ message: 'Missing required patient information' })
  }

  if (type === 'refill') {
    if (!prescriptionNumber && !medicationName) {
      return res.status(400).json({
        message: 'Provide a prescription number or medication name to refill',
      })
    }
  } else {
    if (!currentPharmacyName) {
      return res.status(400).json({ message: 'Current pharmacy name is required' })
    }
    if (!Array.isArray(medications) || medications.length === 0 || !medications[0]?.name) {
      return res.status(400).json({ message: 'At least one medication is required' })
    }
  }

  const doc = await Prescription.create({
    type,
    user: req.user?._id || null,
    patientName,
    dateOfBirth,
    phone,
    email,
    preferredContactMethod: preferredContactMethod || 'phone',
    prescriptionNumber: type === 'refill' ? prescriptionNumber || '' : '',
    medicationName: type === 'refill' ? medicationName || '' : '',
    currentPharmacyName: type === 'transfer' ? currentPharmacyName || '' : '',
    currentPharmacyPhone: type === 'transfer' ? currentPharmacyPhone || '' : '',
    currentPharmacyAddress: type === 'transfer' ? currentPharmacyAddress || '' : '',
    medications:
      type === 'transfer'
        ? medications.filter((m) => m && m.name).map((m) => ({
            name: m.name,
            dosage: m.dosage || '',
            prescriptionNumber: m.prescriptionNumber || '',
          }))
        : [],
    notes: notes || '',
  })

  void logAuditFromReq(req, {
    actorType: req.user ? (req.user.role === 'admin' ? 'admin' : 'user') : 'user',
    action: `prescription.${type}_submit`,
    entityType: 'prescription',
    entityId: doc._id,
    summary: `Submitted ${type} prescription request for ${patientName}`,
    after: { type: doc.type, email, status: doc.status },
  })
  res.locals.auditLogged = true

  res.status(201).json({
    message:
      type === 'refill'
        ? 'Refill request received — we will contact you shortly.'
        : 'Transfer request received — we will reach out to your current pharmacy.',
    prescription: { _id: doc._id, type: doc.type, status: doc.status, createdAt: doc.createdAt },
  })
})

// GET /api/prescriptions — admin: list with filters
router.get('/', protect, admin, async (req, res) => {
  const { type, status, search, page = 1, limit = 20 } = req.query
  const filter = {}
  if (type && ['refill', 'transfer'].includes(type)) filter.type = type
  if (status) filter.status = status
  if (search) {
    const re = new RegExp(search, 'i')
    filter.$or = [
      { patientName: re },
      { email: re },
      { phone: re },
      { prescriptionNumber: re },
      { medicationName: re },
      { currentPharmacyName: re },
    ]
  }

  const skip = (Number(page) - 1) * Number(limit)
  const [prescriptions, total] = await Promise.all([
    Prescription.find(filter)
      .populate('user', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit)),
    Prescription.countDocuments(filter),
  ])
  res.json({
    prescriptions,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)) || 1,
  })
})

// GET /api/prescriptions/stats — admin: counts per status & type
router.get('/stats', protect, admin, async (_req, res) => {
  const [byStatus, byType] = await Promise.all([
    Prescription.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Prescription.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
  ])
  const status = { all: 0 }
  byStatus.forEach(({ _id, count }) => {
    status[_id] = count
    status.all += count
  })
  const type = {}
  byType.forEach(({ _id, count }) => {
    type[_id] = count
  })
  res.json({ status, type })
})

// GET /api/prescriptions/:id — admin
router.get('/:id', protect, admin, async (req, res) => {
  const doc = await Prescription.findById(req.params.id).populate('user', 'name email')
  if (!doc) return res.status(404).json({ message: 'Prescription not found' })
  res.json(doc)
})

// PUT /api/prescriptions/:id — admin: update status / notes
router.put('/:id', protect, admin, async (req, res) => {
  const { status, adminNotes } = req.body
  const update = {}
  if (status && ['pending', 'in_review', 'completed', 'cancelled'].includes(status)) {
    update.status = status
  }
  if (typeof adminNotes === 'string') update.adminNotes = adminNotes

  const doc = await Prescription.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' })
  if (!doc) return res.status(404).json({ message: 'Prescription not found' })
  res.json(doc)
})

// DELETE /api/prescriptions/:id — admin
router.delete('/:id', protect, admin, async (req, res) => {
  const doc = await Prescription.findByIdAndDelete(req.params.id)
  if (!doc) return res.status(404).json({ message: 'Prescription not found' })
  res.json({ message: 'Prescription deleted' })
})

module.exports = router
