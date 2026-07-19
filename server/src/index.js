require('express-async-errors')
require('dotenv').config()
const path = require('path')
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
const robotsRoutes = require('./routes/robotsRoutes')
const inventorySyncRoutes = require('./routes/inventorySyncRoutes')
const blogRoutes = require('./routes/blogRoutes')
const adminBlogRoutes = require('./routes/adminBlogRoutes')
const errorHandler = require('./middleware/errorHandler')
const { authLimiter, publicFormLimiter } = require('./middleware/rateLimiters')
const { logGa4StartupStatus } = require('./utils/ga4MeasurementProtocol')
const { shouldServeSpa, getClientDistPath } = require('./middleware/spaGate')
const createBotProductPrerender = require('./middleware/botProductPrerender')
const createBotBlogPrerender = require('./middleware/botBlogPrerender')
const createPrerenderMiddleware = require('./middleware/prerenderCrawlers')
const createSpaMiddleware = require('./middleware/serveSpa')
const { startCheckoutReconciliation } = require('./services/checkoutReconciliationService')
const { startInventorySyncScheduler } = require('./services/inventorySyncService')

const app = express()

// Correct client IP behind reverse proxies (used for GA4 ip_override)
app.set('trust proxy', 1)

connectDB()

// Stripe webhook — must be before express.json()
app.use('/api/webhooks', webhookRoutes)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
const { corsOriginCallback } = require('./utils/corsOrigins')
app.use(
  cors({
    origin: corsOriginCallback,
    credentials: true,
  })
)

// Routes
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/checkout', checkoutRoutes)
app.use('/api/users', userRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/prescriptions', publicFormLimiter, prescriptionRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/contact', publicFormLimiter, contactRoutes)
app.use('/api/newsletter', publicFormLimiter, newsletterRoutes)
app.use('/api/shipping', shippingRoutes)
app.use('/api/inventory', inventorySyncRoutes)
app.use('/webhooks', inventorySyncRoutes)
app.use('/api/blog', blogRoutes)
app.use('/api/admin/blog', adminBlogRoutes)

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    features: {
      // Bump when new admin APIs ship so you can confirm the live process reloaded
      auditLog: true,
    },
  })
})

// Locally hosted product media — e.g. https://yoursite.com/media/products/{slug}/...
const mediaRoot = process.env.MEDIA_ROOT || path.join(__dirname, '../media')
app.use('/media', express.static(mediaRoot, {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  fallthrough: true,
}))

// SEO sitemap + robots (before SPA fallback; 24h in-memory cache)
app.use(robotsRoutes)
app.use(sitemapRoutes)

// Storefront: crawlers get prerendered HTML; humans get Vite SPA (production / SERVE_SPA)
if (shouldServeSpa()) {
  const clientDist = getClientDistPath()
  app.use(createBotProductPrerender(clientDist))
  app.use(createBotBlogPrerender(clientDist))
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
  startInventorySyncScheduler()
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other server or set PORT to another value in server/.env`)
  } else {
    console.error('Server failed to start:', err.message)
  }
  process.exit(1)
})
