const { getSupabaseAdmin, isSupabaseConfigured } = require('../config/supabase')

const MAX_ROWS = 25000

function parseDateRange(query = {}) {
  const now = new Date()
  const to = query.to ? new Date(query.to) : now
  const from = query.from
    ? new Date(query.from)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Invalid date range')
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

async function fetchEvents({ from, to, eventName }) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase analytics is not configured')
  }

  const supabase = getSupabaseAdmin()
  let q = supabase
    .from('analytics_events')
    .select('visitor_id,session_id,event_name,event_data,page_url,created_at')
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: true })
    .limit(MAX_ROWS)

  if (eventName) q = q.eq('event_name', eventName)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

function pathFromEvent(row) {
  const dataPath = row.event_data?.path
  if (dataPath) return dataPath
  try {
    const url = new URL(row.page_url || '')
    return url.pathname || '/'
  } catch {
    return row.page_url || '/'
  }
}

async function getAnalyticsOverview(query) {
  const range = parseDateRange(query)
  const events = await fetchEvents(range)

  const pageViews = events.filter((e) => e.event_name === 'page_view')
  const visitors = new Set(events.map((e) => e.visitor_id))
  const sessions = new Set(events.map((e) => e.session_id))

  const byDay = {}
  for (const row of pageViews) {
    const day = row.created_at.slice(0, 10)
    byDay[day] = (byDay[day] || 0) + 1
  }

  const pageCounts = {}
  for (const row of pageViews) {
    const path = pathFromEvent(row)
    pageCounts[path] = (pageCounts[path] || 0) + 1
  }

  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, views]) => ({ path, views }))

  return {
    range,
    totalEvents: events.length,
    pageViews: pageViews.length,
    uniqueVisitors: visitors.size,
    uniqueSessions: sessions.size,
    clicks: events.filter((e) => e.event_name === 'click').length,
    topPages,
    dailyPageViews: Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, views]) => ({ date, views })),
    truncated: events.length >= MAX_ROWS,
  }
}

async function getTopPages(query) {
  const range = parseDateRange(query)
  const limit = Math.min(Number(query.limit) || 25, 100)
  const events = await fetchEvents({ ...range, eventName: 'page_view' })

  const counts = {}
  for (const row of events) {
    const path = pathFromEvent(row)
    counts[path] = (counts[path] || 0) + 1
  }

  return {
    range,
    pages: Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([path, views]) => ({ path, views })),
    truncated: events.length >= MAX_ROWS,
  }
}

async function getUserJourneys(query) {
  const range = parseDateRange(query)
  const limit = Math.min(Number(query.limit) || 20, 100)
  const events = await fetchEvents(range)

  const bySession = new Map()
  for (const row of events) {
    if (row.event_name !== 'page_view') continue
    const list = bySession.get(row.session_id) || []
    list.push({ path: pathFromEvent(row), at: row.created_at })
    bySession.set(row.session_id, list)
  }

  const journeys = [...bySession.entries()]
    .map(([sessionId, steps]) => ({
      sessionId,
      steps: steps.slice(-12),
      pageCount: steps.length,
      startedAt: steps[0]?.at,
      lastAt: steps[steps.length - 1]?.at,
    }))
    .sort((a, b) => b.pageCount - a.pageCount)
    .slice(0, limit)

  return { range, journeys, truncated: events.length >= MAX_ROWS }
}

async function getHeatmapData(query) {
  const range = parseDateRange(query)
  const pageFilter = query.page ? String(query.page) : ''
  const events = await fetchEvents({ ...range, eventName: 'click' })

  const filtered = pageFilter
    ? events.filter((e) => pathFromEvent(e) === pageFilter)
    : events

  const pageCounts = {}
  for (const row of filtered) {
    const path = pathFromEvent(row)
    pageCounts[path] = (pageCounts[path] || 0) + 1
  }

  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([path, clicks]) => ({ path, clicks }))

  const targetPage = pageFilter || topPages[0]?.path || '/'
  const pageClicks = filtered.filter((e) => pathFromEvent(e) === targetPage)

  const buckets = {}
  const grid = 24
  for (const row of pageClicks) {
    const xPct = Number(row.event_data?.x_pct ?? row.event_data?.xPct)
    const yPct = Number(row.event_data?.y_pct ?? row.event_data?.yPct)
    if (!Number.isFinite(xPct) || !Number.isFinite(yPct)) continue
    const bx = Math.min(grid - 1, Math.max(0, Math.floor((xPct / 100) * grid)))
    const by = Math.min(grid - 1, Math.max(0, Math.floor((yPct / 100) * grid)))
    const key = `${bx},${by}`
    buckets[key] = (buckets[key] || 0) + 1
  }

  const points = Object.entries(buckets).map(([key, count]) => {
    const [bx, by] = key.split(',').map(Number)
    return {
      x: ((bx + 0.5) / grid) * 100,
      y: ((by + 0.5) / grid) * 100,
      count,
    }
  })

  return {
    range,
    page: targetPage,
    topPages,
    totalClicks: pageClicks.length,
    points,
    truncated: events.length >= MAX_ROWS,
  }
}

module.exports = {
  getAnalyticsOverview,
  getTopPages,
  getUserJourneys,
  getHeatmapData,
}
