const { getSupabaseAdmin, isSupabaseConfigured } = require('../config/supabase')

const MAX_JSON = 12000
const MAX_SUMMARY = 500
const SENSITIVE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'authorization',
  'stripeSecret',
  'secret',
  'client_secret',
  'service_role_key',
])

function truncate(value, max) {
  const text = String(value ?? '')
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function sanitizeValue(value, depth = 0) {
  if (value == null) return value
  if (depth > 4) return '[truncated]'
  if (Array.isArray(value)) {
    return value.slice(0, 40).map((item) => sanitizeValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    if (typeof value.toObject === 'function') {
      return sanitizeValue(value.toObject(), depth + 1)
    }
    if (value._bsontype === 'ObjectID' || value._bsontype === 'ObjectId') {
      return String(value)
    }
    const out = {}
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key) || /password|secret|token/i.test(key)) {
        out[key] = '[redacted]'
      } else {
        out[key] = sanitizeValue(nested, depth + 1)
      }
    }
    return out
  }
  if (typeof value === 'string' && value.length > 2000) {
    return truncate(value, 2000)
  }
  return value
}

function clampJson(value) {
  const sanitized = sanitizeValue(value) || {}
  let json = JSON.stringify(sanitized)
  if (json.length <= MAX_JSON) return sanitized
  return {
    _truncated: true,
    preview: json.slice(0, MAX_JSON - 80),
  }
}

function clientIp(req) {
  if (!req) return null
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || null
}

/**
 * Fire-and-forget audit write to Supabase.
 * Never throws — failures are logged to console only.
 */
async function logAudit(event = {}) {
  try {
    if (!isSupabaseConfigured()) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[audit] Supabase not configured — skipped', event.action)
      }
      return { ok: false, skipped: true, reason: 'supabase_not_configured' }
    }

    const action = truncate(event.action || 'unknown', 160)
    if (!action) return { ok: false, skipped: true, reason: 'missing_action' }

    const row = {
      actor_type: truncate(event.actorType || 'system', 40) || 'system',
      actor_id: event.actorId != null ? truncate(String(event.actorId), 120) : null,
      actor_email: event.actorEmail ? truncate(event.actorEmail, 200) : null,
      actor_name: event.actorName ? truncate(event.actorName, 200) : null,
      action,
      entity_type: event.entityType ? truncate(event.entityType, 80) : null,
      entity_id: event.entityId != null ? truncate(String(event.entityId), 120) : null,
      summary: event.summary ? truncate(event.summary, MAX_SUMMARY) : null,
      before_data: clampJson(event.before || {}),
      after_data: clampJson(event.after || {}),
      meta: clampJson(event.meta || {}),
      ip: event.ip ? truncate(event.ip, 80) : null,
      user_agent: event.userAgent ? truncate(event.userAgent, 400) : null,
      request_method: event.requestMethod ? truncate(event.requestMethod, 12) : null,
      request_path: event.requestPath ? truncate(event.requestPath, 500) : null,
      status: truncate(event.status || 'success', 40) || 'success',
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('audit_events').insert(row)
    if (error) {
      console.error('[audit] insert failed:', error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    console.error('[audit] unexpected error:', err.message)
    return { ok: false, error: err.message }
  }
}

/** Convenience: fill actor + request context from Express req. */
function logAuditFromReq(req, event = {}) {
  const user = req?.user
  const actorType =
    event.actorType ||
    (user?.role === 'admin' ? 'admin' : user ? 'user' : 'system')

  return logAudit({
    ...event,
    actorType,
    actorId: event.actorId ?? (user?._id ? String(user._id) : null),
    actorEmail: event.actorEmail ?? user?.email ?? null,
    actorName: event.actorName ?? user?.name ?? null,
    ip: event.ip ?? clientIp(req),
    userAgent: event.userAgent ?? req?.get?.('user-agent') ?? null,
    requestMethod: event.requestMethod ?? req?.method ?? null,
    requestPath: event.requestPath ?? (`${req?.baseUrl || ''}${req?.path || ''}` || null),
  })
}

async function listAuditEvents({
  page = 1,
  limit = 50,
  actorType,
  action,
  entityType,
  search,
  from,
  to,
} = {}) {
  if (!isSupabaseConfigured()) {
    const err = new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    err.status = 503
    throw err
  }

  const supabase = getSupabaseAdmin()
  const pageNum = Math.max(1, Number(page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 50))
  const fromIdx = (pageNum - 1) * pageSize
  const toIdx = fromIdx + pageSize - 1

  let query = supabase
    .from('audit_events')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(fromIdx, toIdx)

  if (actorType) query = query.eq('actor_type', actorType)
  if (action) query = query.ilike('action', `%${action}%`)
  if (entityType) query = query.eq('entity_type', entityType)
  if (from) query = query.gte('created_at', new Date(from).toISOString())
  if (to) query = query.lte('created_at', new Date(to).toISOString())
  if (search && search.trim()) {
    const q = search.trim()
    query = query.or(
      `summary.ilike.%${q}%,actor_email.ilike.%${q}%,actor_name.ilike.%${q}%,entity_id.ilike.%${q}%,action.ilike.%${q}%`
    )
  }

  const { data, error, count } = await query
  if (error) {
    const code = error.code || ''
    let message = error.message || 'Failed to load audit events'
    if (code === 'PGRST205' || /schema cache|does not exist|Could not find the table/i.test(message)) {
      message =
        'audit_events table not found in Supabase API. Re-run server/sql/audit_events.sql, then in Supabase: Settings → API → Reload schema (or wait 1–2 min).'
    } else if (/JWT|Invalid API key|permission/i.test(message)) {
      message = 'Supabase service role key rejected. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.'
    }
    console.error('[audit] list failed:', code, error.message)
    const err = new Error(message)
    err.status = 500
    throw err
  }

  const total = count || 0
  return {
    events: data || [],
    total,
    page: pageNum,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    limit: pageSize,
  }
}

module.exports = {
  logAudit,
  logAuditFromReq,
  listAuditEvents,
  sanitizeValue,
}
