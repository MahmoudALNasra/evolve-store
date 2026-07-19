import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  acceptAllCookies,
  acceptNecessaryCookies,
  DEFAULT_CONSENT,
  getStoredConsent,
  hasDecidedConsent,
  saveConsent,
} from '../lib/cookieConsent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [prefs, setPrefs] = useState(() => {
    const stored = getStoredConsent()
    return stored
      ? { analytics: stored.analytics, marketing: stored.marketing }
      : { analytics: DEFAULT_CONSENT.analytics, marketing: DEFAULT_CONSENT.marketing }
  })

  useEffect(() => {
    if (!hasDecidedConsent()) setVisible(true)

    const open = () => {
      const stored = getStoredConsent()
      setPrefs({
        analytics: Boolean(stored?.analytics),
        marketing: Boolean(stored?.marketing),
      })
      setCustomizing(true)
      setVisible(true)
    }
    window.addEventListener('evolve:cookie-preferences-open', open)
    return () => window.removeEventListener('evolve:cookie-preferences-open', open)
  }, [])

  if (!visible) return null

  const finish = (next) => {
    if (next) saveConsent(next)
    setVisible(false)
    setCustomizing(false)
  }

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie preferences" aria-modal="false">
      <div className="cookie-banner-inner">
        <div className="cookie-banner-copy">
          <h2 className="cookie-banner-title">We use cookies</h2>
          <p className="cookie-banner-text">
            We use necessary cookies to run the store (cart, login, security). With your permission,
            we also use analytics and marketing cookies to improve the site and measure campaigns.
            See our{' '}
            <Link to="/privacy-policy" className="cookie-banner-link">Privacy Policy</Link>.
          </p>

          {customizing && (
            <div className="cookie-banner-options">
              <label className="cookie-option">
                <input type="checkbox" checked disabled readOnly />
                <span>
                  <strong>Necessary</strong>
                  <small>Required for checkout, account, and security. Always on.</small>
                </span>
              </label>
              <label className="cookie-option">
                <input
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}
                />
                <span>
                  <strong>Analytics</strong>
                  <small>Helps us understand how the site is used (page views, journeys).</small>
                </span>
              </label>
              <label className="cookie-option">
                <input
                  type="checkbox"
                  checked={prefs.marketing}
                  onChange={(e) => setPrefs((p) => ({ ...p, marketing: e.target.checked }))}
                />
                <span>
                  <strong>Marketing</strong>
                  <small>Used for advertising measurement and related tags (e.g. via Google Tag Manager).</small>
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="cookie-banner-actions">
          {customizing ? (
            <>
              <button
                type="button"
                className="cookie-btn cookie-btn-secondary"
                onClick={() => setCustomizing(false)}
              >
                Back
              </button>
              <button
                type="button"
                className="cookie-btn cookie-btn-primary"
                onClick={() => finish(prefs)}
              >
                Save preferences
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="cookie-btn cookie-btn-ghost"
                onClick={() => setCustomizing(true)}
              >
                Choose options
              </button>
              <button
                type="button"
                className="cookie-btn cookie-btn-secondary"
                onClick={() => {
                  acceptNecessaryCookies()
                  finish()
                }}
              >
                Accept necessary
              </button>
              <button
                type="button"
                className="cookie-btn cookie-btn-primary"
                onClick={() => {
                  acceptAllCookies()
                  finish()
                }}
              >
                Accept all
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
