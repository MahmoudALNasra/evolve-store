require('express-async-errors')
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const connectDB = require('./config/db')
require('./config/passport')

// Route imports
const authRoutes = require('./routes/authRoutes')
const productRoutes = require('./routes/productRoutes')
const categoryRoutes = require('./routes/categoryRoutes')
const orderRoutes = require('./routes/orderRoutes')
const checkoutRoutes = require('./routes/checkoutRoutes')
const webhookRoutes = require('./routes/webhookRoutes')
const userRoutes = require('./routes/userRoutes')
const adminRoutes = require('./routes/adminRoutes')
const prescriptionRoutes = require('./routes/prescriptionRoutes')
const analyticsRoutes = require('./routes/analyticsRoutes')
const contactRoutes = require('./routes/contactRoutes')
const newsletterRoutes = require('./routes/newsletterRoutes')
const shippingRoutes = require('./routes/shippingRoutes')
const sitemapRoutes = require('./routes/sitemapRoutes')
const errorHandler = require('./middleware/errorHandler')
const { logGa4StartupStatus } = require('./utils/ga4MeasurementProtocol')
const { shouldServeSpa, getClientDistPath } = require('./middleware/spaGate')
const createBotProductPrerender = require('./middleware/botProductPrerender')
const createPrerenderMiddleware = require('./middleware/prerenderCrawlers')
const createSpaMiddleware = require('./middleware/serveSpa')
const { startCheckoutReconciliation } = require('./services/checkoutReconciliationService')

const app = express()

// Correct client IP behind reverse proxies (used for GA4 ip_override)
app.set('trust proxy', 1)

connectDB()

// Stripe webhook — must be before express.json()
app.use('/api/webhooks', webhookRoutes)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/checkout', checkoutRoutes)
app.use('/api/users', userRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/prescriptions', prescriptionRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/newsletter', newsletterRoutes)
app.use('/api/shipping', shippingRoutes)

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

// SEO sitemap (before SPA fallback; 24h in-memory cache)
app.use(sitemapRoutes)

// Storefront: crawlers get prerendered HTML; humans get Vite SPA (production / SERVE_SPA)
if (shouldServeSpa()) {
  const clientDist = getClientDistPath()
  app.use(createBotProductPrerender(clientDist))
  app.use(createPrerenderMiddleware())
  app.use(createSpaMiddleware(clientDist))
  console.log(`SPA + crawler prerender enabled → ${clientDist}`)
} else if (process.env.NODE_ENV !== 'production') {
  console.log(
    'SPA not served from Express (use Vite on :5173). Set SERVE_SPA=true after client build to test bots on :5000.'
  )
}

app.use(errorHandler)

const PORT = process.env.PORT || 5000
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  logGa4StartupStatus()
  startCheckoutReconciliation()
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other server or set PORT to another value in server/.env`)
  } else {
    console.error('Server failed to start:', err.message)
  }
  process.exit(1)
})
