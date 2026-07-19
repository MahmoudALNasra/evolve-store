const express = require('express')
const User = require('../models/User')
const { protect, admin } = require('../middleware/auth')
const { auditWriteLogger } = require('../middleware/auditWriteLogger')
const { logAuditFromReq } = require('../services/auditLogService')

const router = express.Router()
router.use(auditWriteLogger())

// GET /api/users  — admin: all users
router.get('/', protect, admin, async (req, res) => {
  const { page = 1, limit = 20, search } = req.query
  const filter = {}
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
  ]
  const skip = (Number(page) - 1) * Number(limit)
  const [users, total] = await Promise.all([
    User.find(filter).sort('-createdAt').skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ])
  res.json({ users, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
})

// PUT /api/users/profile  — update own profile
router.put('/profile', protect, async (req, res) => {
  const { name, avatar } = req.body
  const before = { name: req.user.name, avatar: req.user.avatar }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, avatar },
    { returnDocument: 'after', runValidators: true }
  )
  void logAuditFromReq(req, {
    action: 'user.profile_update',
    entityType: 'user',
    entityId: user._id,
    summary: 'Updated account profile',
    before,
    after: { name: user.name, avatar: user.avatar },
  })
  res.locals.auditLogged = true
  res.json(user)
})

// PUT /api/users/password  — change own password
router.put('/password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' })
  }

  const user = await User.findById(req.user._id).select('+password')
  if (!user) return res.status(404).json({ message: 'User not found' })

  // Google-OAuth accounts have no password yet; let them set one directly.
  if (user.password) {
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required' })
    }
    const matches = await user.matchPassword(currentPassword)
    if (!matches) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }
  }

  user.password = newPassword
  await user.save()
  void logAuditFromReq(req, {
    action: 'user.password_change',
    entityType: 'user',
    entityId: user._id,
    summary: 'Changed account password',
  })
  res.locals.auditLogged = true
  res.json({ message: 'Password updated' })
})

// PUT /api/users/:id/role  — admin: toggle role
router.put('/:id/role', protect, admin, async (req, res) => {
  const { role } = req.body
  if (!['user', 'admin'].includes(role))
    return res.status(400).json({ message: 'Invalid role' })
  const previous = await User.findById(req.params.id).select('name email role')
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { returnDocument: 'after' })
  if (!user) return res.status(404).json({ message: 'User not found' })
  void logAuditFromReq(req, {
    action: 'user.role_change',
    entityType: 'user',
    entityId: user._id,
    summary: `Changed role for ${user.email}: ${previous?.role} → ${role}`,
    before: { role: previous?.role },
    after: { role },
  })
  res.locals.auditLogged = true
  res.json(user)
})

// DELETE /api/users/:id  — admin
router.delete('/:id', protect, admin, async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id)
  if (!user) return res.status(404).json({ message: 'User not found' })
  void logAuditFromReq(req, {
    action: 'user.delete',
    entityType: 'user',
    entityId: user._id,
    summary: `Deleted user ${user.email}`,
    before: { name: user.name, email: user.email, role: user.role },
  })
  res.locals.auditLogged = true
  res.json({ message: 'User deleted' })
})

module.exports = router
