const express = require('express')
const StoreSettings = require('../models/StoreSettings')

const router = express.Router()

/** Public storefront flags (no auth). Keep this payload non-sensitive. */
router.get('/public', async (req, res) => {
  const settings = await StoreSettings.get()
  res.json({
    cookieConsentEnabled: Boolean(settings.cookieConsentEnabled),
  })
})

module.exports = router
