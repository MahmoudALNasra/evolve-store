/**
 * Blocks common scanner / injection probes (sqlmap, nikto, path traversal, etc.).
 * Returns a generic 404 so attackers get no useful fingerprint.
 */

const BLOCKED_UA = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /dirbuster/i,
  /gobuster/i,
  /wfuzz/i,
  /acunetix/i,
  /nessus/i,
  /openvas/i,
  /burpsuite/i,
  /w3af/i,
  /havij/i,
  /libwww-perl/i,
  /python-requests\/0/i,
]

const BLOCKED_PATH = [
  /\.\./,
  /%2e%2e/i,
  /\/etc\/passwd/i,
  /\/proc\/self/i,
  /wp-admin/i,
  /wp-login/i,
  /phpmyadmin/i,
  /adminer/i,
  /\.env\b/i,
  /\.git\b/i,
  /\.svn\b/i,
  /\.htaccess/i,
  /web\.config/i,
  /xmlrpc\.php/i,
  /cgi-bin/i,
  /vendor\/phpunit/i,
  /eval\(/i,
  /base64_decode/i,
  /union(\s|\+|%20)+select/i,
  /select(\s|\+|%20).+(\s|\+|%20)from/i,
  /sleep\s*\(/i,
  /benchmark\s*\(/i,
  /information_schema/i,
  /into(\s|\+|%20)+outfile/i,
  /load_file\s*\(/i,
  /<\?php/i,
  /<script\b/i,
]

function getProbeTarget(req) {
  const rawUrl = req.originalUrl || req.url || ''
  const pathOnly = (req.path || '') + (req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')
  return `${rawUrl}\n${pathOnly}`
}

function isBlockedProbe(req) {
  const ua = String(req.get('user-agent') || '')
  if (BLOCKED_UA.some((re) => re.test(ua))) return 'ua'

  const target = getProbeTarget(req)
  if (BLOCKED_PATH.some((re) => re.test(target))) return 'path'

  // Reject null bytes and obvious binary junk in the URL
  if (target.includes('\0') || /%00/i.test(target)) return 'nullbyte'

  return null
}

function requestGuard(req, res, next) {
  // Never interfere with Stripe webhooks or health checks
  if (req.path === '/api/health' || req.path.startsWith('/api/webhooks')) {
    return next()
  }

  const reason = isBlockedProbe(req)
  if (!reason) return next()

  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[requestGuard] blocked ${reason} ${req.method} ${req.originalUrl}`)
  }

  res.status(404).type('text').send('Not found')
}

module.exports = {
  requestGuard,
  isBlockedProbe,
}
