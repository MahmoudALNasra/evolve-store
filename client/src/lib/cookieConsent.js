const STORAGE_KEY = 'evolve_cookie_consent_v1'
const CONSENT_REQUIRED_KEY = 'evolve_cookie_consent_required_v1'
const CONSENT_EVENT = 'evolve:cookie-consent'
const CONSENT_MODE_EVENT = 'evolve:cookie-consent-mode'
const GTM_ID = 'GTM-PV2RLR9P'

export const DEFAULT_CONSENT = {
  necessary: true,
  analytics: false,
  marketing: false,
}

const BYPASS_CONSENT = {
  necessary: true,
  analytics: true,
  marketing: true,
  decidedAt: 'bypass',
}

function gtag() {
  window.dataLayer = window.dataLayer || []
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments)
}

/**
 * Cached admin setting: whether the cookie banner / Consent Mode gate is required.
 * Default false (consent off) until server says otherwise — matches current store preference.
 */
export function isCookieConsentRequired() {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(CONSENT_REQUIRED_KEY)
    if (raw == null) return false
    return raw === '1' || raw === 'true'
  } catch {
    return false
  }
}

export function setCookieConsentRequired(enabled) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CONSENT_REQUIRED_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(CONSENT_MODE_EVENT, { detail: { cookieConsentEnabled: Boolean(enabled) } })
  )
}

export function onCookieConsentModeChange(handler) {
  const listener = (e) => handler(e.detail)
  window.addEventListener(CONSENT_MODE_EVENT, listener)
  return () => window.removeEventListener(CONSENT_MODE_EVENT, listener)
}

/** Google Consent Mode v2 defaults — call before GTM loads (also set in index.html). */
export function ensureConsentDefaults() {
  if (typeof window === 'undefined' || window.__evolveConsentDefaults) return
  const required = isCookieConsentRequired()
  window.dataLayer = window.dataLayer || []
  gtag('consent', 'default', {
    ad_storage: required ? 'denied' : 'granted',
    ad_user_data: required ? 'denied' : 'granted',
    ad_personalization: required ? 'denied' : 'granted',
    analytics_storage: required ? 'denied' : 'granted',
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
  if (!isCookieConsentRequired()) return true
  return Boolean(consent?.analytics)
}

export function allowsMarketing(consent = getStoredConsent()) {
  if (!isCookieConsentRequired()) return true
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
 * Load GTM only after analytics or marketing consent (or when consent gate is off).
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

/** Grant analytics + marketing without showing the banner (admin toggle off). */
export function applyConsentBypass() {
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: BYPASS_CONSENT }))
  applyConsentToRuntime(BYPASS_CONSENT)
}

/** Call once on app boot if user already decided, or bypass when consent is disabled. */
export function initCookieConsentRuntime() {
  ensureConsentDefaults()
  if (!isCookieConsentRequired()) {
    applyConsentBypass()
    return
  }
  const consent = getStoredConsent()
  if (consent?.decidedAt) applyConsentToRuntime(consent)
}

/**
 * Fetch Admin → Settings flag and apply. Safe to call on every app boot.
 * @returns {Promise<boolean>} whether cookie consent is required
 */
export async function syncCookieConsentSettingFromServer() {
  try {
    const res = await fetch('/api/settings/public', { credentials: 'same-origin' })
    if (!res.ok) throw new Error(`settings ${res.status}`)
    const data = await res.json()
    const required = Boolean(data.cookieConsentEnabled)
    setCookieConsentRequired(required)
    if (!required) {
      applyConsentBypass()
    } else {
      const consent = getStoredConsent()
      if (consent?.decidedAt) applyConsentToRuntime(consent)
    }
    return required
  } catch {
    if (!isCookieConsentRequired()) applyConsentBypass()
    return isCookieConsentRequired()
  }
}
