const express = require('express')
const analyticsCookies = require('../middleware/analyticsCookies')
const { getSupabaseAdmin, isSupabaseConfigured } = require('../config/supabase')
const { extractUtmsFromBody } = require('../utils/analyticsUtm')

const router = express.Router()

const MAX_EVENT_NAME_LEN = 128
const MAX_PAGE_URL_LEN = 2048

// @POST /api/analytics/track
router.post('/track', analyticsCookies, async (req, res) => {
  const { event_name, event_data, page_url } = req.body || {}

  if (!event_name || typeof event_name !== 'string') {
    return res.status(400).json({ message: 'event_name is required' })
  }

  const trimmedName = event_name.trim()
  if (!trimmedName || trimmedName.length > MAX_EVENT_NAME_LEN) {
    return res.status(400).json({ message: 'Invalid event_name' })
  }

  if (event_data !== undefined && (typeof event_data !== 'object' || event_data === null || Array.isArray(event_data))) {
    return res.status(400).json({ message: 'event_data must be a plain object' })
  }

  let safePageUrl = null
  if (page_url != null) {
    if (typeof page_url !== 'string') {
      return res.status(400).json({ message: 'page_url must be a string' })
    }
    safePageUrl = page_url.slice(0, MAX_PAGE_URL_LEN)
  }

  if (!isSupabaseConfigured()) {
    console.error('Analytics track: Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    return res.status(503).json({ message: 'Analytics storage is not configured' })
  }

  const supabase = getSupabaseAdmin()
  const { visitorId, sessionId } = req.analytics
  const utm = extractUtmsFromBody(req.body)

  const row = {
    visitor_id: visitorId,
    session_id: sessionId,
    event_name: trimmedName,
    event_data: event_data ?? {},
    page_url: safePageUrl,
    ...utm,
  }

  const { error } = await supabase.from('analytics_events').insert(row)

  if (error) {
    console.error('Analytics insert failed:', error.message)
    return res.status(500).json({ message: 'Failed to record event' })
  }

  res.status(204).send()
})

module.exports = router
