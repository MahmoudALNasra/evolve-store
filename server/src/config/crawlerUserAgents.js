/**
 * Crawler / preview bot User-Agent substrings (case-insensitive match).
 * @see https://github.com/prerender/prerender-node/blob/master/lib/crawlerUserAgents.js
 */
const CRAWLER_USER_AGENTS = [
  'googlebot',
  'google-inspectiontool',
  'googleother',
  'google-extended',
  'bingbot',
  'msnbot',
  'slurp', // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'yandeximages',
  'sogou',
  'exabot',
  'facebot',
  'facebookexternalhit',
  'facebookcatalog',
  'twitterbot',
  'linkedinbot',
  'pinterestbot',
  'discordbot',
  'slackbot',
  'slack-imgproxy',
  'telegrambot',
  'whatsapp',
  'applebot',
  'petalbot',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'rogerbot', // Moz
  'embedly',
  'quora link preview',
  'showyoubot',
  'outbrain',
  'w3c_validator',
  'validator.nu',
  'lighthouse',
  'chrome-lighthouse',
  'headlesschrome',
  'phantomjs',
  'prerender',
  'screaming frog',
  'uptimerobot',
]

/** Paths never sent to prerender / bot HTML (API, admin, assets). */
const PRERENDER_BLACKLIST = [
  /^\/api\b/,
  /^\/admin\b/,
  /^\/sitemap\.xml$/i,
  /\.(js|css|map|json|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|txt|xml)$/i,
]

function matchesCrawler(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return false
  const ua = userAgent.toLowerCase()
  return CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot))
}

/**
 * Detect search/social preview crawlers (not normal browsers).
 */
function isCrawlerRequest(req) {
  const ua = req.headers['user-agent'] || ''
  if (matchesCrawler(ua)) return true
  // Prerender.io loopback / self-hosted prerender
  if (req.headers['x-prerender']) return true
  return false
}

function isBlacklistedPath(pathname) {
  return PRERENDER_BLACKLIST.some((re) => re.test(pathname))
}

module.exports = {
  CRAWLER_USER_AGENTS,
  PRERENDER_BLACKLIST,
  matchesCrawler,
  isCrawlerRequest,
  isBlacklistedPath,
}
