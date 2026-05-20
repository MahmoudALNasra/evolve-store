const jwt = require('jsonwebtoken')
const User = require('../models/User')

const protect = async (req, res, next) => {
  let token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token
  }

  if (!token) return res.status(401).json({ message: 'Not authorized, no token' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id).select('-password')
    if (!req.user) return res.status(401).json({ message: 'User not found' })
    next()
  } catch {
    res.status(401).json({ message: 'Not authorized, invalid token' })
  }
}

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next()
  res.status(403).json({ message: 'Admin access required' })
}

module.exports = { protect, admin }
