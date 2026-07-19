const STORAGE_KEY = 'evolve_cookie_consent_v1'
const CONSENT_EVENT = 'evolve:cookie-consent'
const GTM_ID = 'GTM-PV2RLR9P'

export const DEFAULT_CONSENT = {
  necessary: true,
  analytics: false,
  marketing: false,
}

function gtag() {
  window.dataLayer = window.dataLayer || []
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments)
}

/** Google Consent Mode v2 defaults — call before GTM loads (also set in index.html). */
export function ensureConsentDefaults() {
  if (typeof window === 'undefined' || window.__evolveConsentDefaults) return
  window.dataLayer = window.dataLayer || []
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  })
  window.__evolveConsentDefaults = true
}

/** @returns {{ necessary: boolean, analytics: boolean, marketing: boolean, decidedAt?: string } | null} */
export function getStoredConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      decidedAt: parsed.decidedAt,
    }
  } catch {
    return null
  }
}

export function hasDecidedConsent() {
  return Boolean(getStoredConsent()?.decidedAt)
}

export function saveConsent(partial) {
  const next = {
    necessary: true,
    analytics: Boolean(partial.analytics),
    marketing: Boolean(partial.marketing),
    decidedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: next }))
  applyConsentToRuntime(next)
  return next
}

export function acceptAllCookies() {
  return saveConsent({ analytics: true, marketing: true })
}

export function acceptNecessaryCookies() {
  return saveConsent({ analytics: false, marketing: false })
}

export function openCookiePreferences() {
  window.dispatchEvent(new CustomEvent('evolve:cookie-preferences-open'))
}

export function onConsentChange(handler) {
  const listener = (e) => handler(e.detail)
  window.addEventListener(CONSENT_EVENT, listener)
  return () => window.removeEventListener(CONSENT_EVENT, listener)
}

export function allowsAnalytics(consent = getStoredConsent()) {
  return Boolean(consent?.analytics)
}

export function allowsMarketing(consent = getStoredConsent()) {
  return Boolean(consent?.marketing)
}

export function allowsGtm(consent = getStoredConsent()) {
  return allowsAnalytics(consent) || allowsMarketing(consent)
}

function pushConsentUpdate(consent) {
  ensureConsentDefaults()
  gtag('consent', 'update', {
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_storage: consent.marketing ? 'granted' : 'denied',
    ad_user_data: consent.marketing ? 'granted' : 'denied',
    ad_personalization: consent.marketing ? 'granted' : 'denied',
  })
  window.dataLayer.push({
    event: 'cookie_consent_update',
    cookie_consent: {
      necessary: true,
      analytics: Boolean(consent.analytics),
      marketing: Boolean(consent.marketing),
    },
  })
}

/**
 * Load GTM only after analytics or marketing consent.
 * Idempotent — safe to call multiple times.
 */
export function loadGtmIfAllowed(consent = getStoredConsent()) {
  if (typeof window === 'undefined') return false
  if (!allowsGtm(consent)) return false
  if (window.__evolveGtmLoaded) return true

  ensureConsentDefaults()
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({
    'gtm.start': new Date().getTime(),
    event: 'gtm.js',
  })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`
  document.head.appendChild(script)

  window.__evolveGtmLoaded = true
  return true
}

export function applyConsentToRuntime(consent = getStoredConsent()) {
  if (!consent) return
  pushConsentUpdate(consent)
  if (allowsGtm(consent)) {
    loadGtmIfAllowed(consent)
  }
}

/** Call once on app boot if user already decided. */
export function initCookieConsentRuntime() {
  ensureConsentDefaults()
  const consent = getStoredConsent()
  if (consent?.decidedAt) applyConsentToRuntime(consent)
}
