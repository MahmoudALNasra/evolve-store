const DEFAULT_EMAIL_UTMS = {
  utm_source: 'email',
  utm_medium: 'transactional',
}

function withEmailUtms(url, { campaign = 'transactional_email', content = 'link' } = {}) {
  if (!url || typeof url !== 'string') return url

  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return url

    parsed.searchParams.set('utm_source', DEFAULT_EMAIL_UTMS.utm_source)
    parsed.searchParams.set('utm_medium', DEFAULT_EMAIL_UTMS.utm_medium)
    parsed.searchParams.set('utm_campaign', campaign)
    parsed.searchParams.set('utm_content', content)
    return parsed.toString()
  } catch {
    return url
  }
}

module.exports = { DEFAULT_EMAIL_UTMS, withEmailUtms }
