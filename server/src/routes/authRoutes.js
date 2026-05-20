const express = require('express')
const passport = require('passport')
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const generateToken = require('../utils/generateToken')
const { protect } = require('../middleware/auth')
const validatePassword = require('../utils/validatePassword')

const router = express.Router()

// @POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Please fill all fields' })

  const pwErrors = validatePassword(password)
  if (pwErrors.length > 0)
    return res.status(400).json({ message: pwErrors[0], errors: pwErrors })

  const exists = await User.findOne({ email })
  if (exists) return res.status(400).json({ message: 'Email already registered' })

  const isFirst = (await User.countDocuments()) === 0
  const user = await User.create({ name, email, password, role: isFirst ? 'admin' : 'user' })

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    token: generateToken(user._id),
  })
})

// @POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ message: 'Please provide email and password' })

  const user = await User.findOne({ email }).select('+password')
  if (!user || !user.password)
    return res.status(401).json({ message: 'Invalid credentials' })

  const match = await user.matchPassword(password)
  if (!match) return res.status(401).json({ message: 'Invalid credentials' })

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    token: generateToken(user._id),
  })
})

// @GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json(req.user)
})

// @GET /api/auth/google
router.get('/google', (req, res, next) => {
  const redirect = req.query.redirect || '/'
  // Pass redirect through OAuth state parameter
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    state: redirect
  })(req, res, next)
})

// @GET /api/auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth` }),
  (req, res) => {
    const token = generateToken(req.user._id)
    // Get redirect from OAuth state parameter
    const redirect = req.query.state || '/'
    res.redirect(`${process.env.CLIENT_URL}/oauth-success?token=${token}&redirect=${encodeURIComponent(redirect)}`)
  }
)

module.exports = router
