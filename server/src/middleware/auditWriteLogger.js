const { logAuditFromReq } = require('../services/auditLogService')

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function guessEntity(req) {
  const full = `${req.baseUrl || ''}${req.path || ''}`
  if (full.includes('/products')) return { entityType: 'product', entityId: req.params?.id }
  if (full.includes('/orders')) return { entityType: 'order', entityId: req.params?.id }
  if (full.includes('/users')) return { entityType: 'user', entityId: req.params?.id }
  if (full.includes('/categories')) return { entityType: 'category', entityId: req.params?.id }
  if (full.includes('/prescriptions')) return { entityType: 'prescription', entityId: req.params?.id }
  if (full.includes('/blog') || full.includes('/admin/blog')) return { entityType: 'blog', entityId: req.params?.id }
  if (full.includes('/settings')) return { entityType: 'settings' }
  if (full.includes('/ops')) return { entityType: 'ops', entityId: req.params?.job }
  if (full.includes('/checkout')) return { entityType: 'checkout' }
  if (full.includes('/auth')) return { entityType: 'auth' }
  return { entityType: null, entityId: req.params?.id || null }
}

function actionName(req) {
  const base = (req.baseUrl || '').replace(/^\/api\/?/, '').replace(/\//g, '.') || 'api'
  const routePath = (req.route?.path || req.path || '/')
    .replace(/^\//, '')
    .replace(/:[^/]+/g, 'id')
    .replace(/\//g, '.')
  const method = String(req.method || 'GET').toLowerCase()
  const parts = [base, method]
  if (routePath && routePath !== '/') parts.push(routePath)
  return parts.filter(Boolean).join('.').replace(/\.+/g, '.')
}

/**
 * Logs successful write requests after the response finishes.
 * Skip with res.locals.skipAudit = true or mark richer logs with res.locals.auditLogged = true.
 */
function auditWriteLogger(defaults = {}) {
  return (req, res, next) => {
    if (!WRITE_METHODS.has(req.method)) return next()

    res.on('finish', () => {
      if (res.locals.skipAudit || res.locals.auditLogged) return
      // Skip pure reads accidentally mounted; allow 2xx and 202
      if (res.statusCode < 200 || res.statusCode >= 400) {
        // Still record auth failures / forbidden admin writes
        if (![401, 403, 409, 422, 429].includes(res.statusCode) && res.statusCode < 500) return
      }

      const { entityType, entityId } = guessEntity(req)
      const status =
        res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'denied' : 'success'

      void logAuditFromReq(req, {
        actorType: defaults.actorType,
        action: defaults.action || actionName(req),
        entityType: defaults.entityType || entityType,
        entityId: defaults.entityId || entityId,
        summary:
          defaults.summary ||
          `${req.method} ${req.baseUrl || ''}${req.route?.path || req.path || ''} → ${res.statusCode}`,
        status,
        meta: {
          statusCode: res.statusCode,
          query: req.query || {},
          ...(defaults.meta || {}),
        },
      })
    })

    next()
  }
}

module.exports = {
  auditWriteLogger,
  actionName,
}
