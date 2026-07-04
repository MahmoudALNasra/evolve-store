import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import api from '../lib/api'
import { prefersReducedMotion } from '../lib/animation'

const SEEN_KEY = 'evolve_email_popup_seen'
const SUBSCRIBED_KEY = 'evolve_email_subscribed'
const DISCOUNT_CODE = 'WELCOME15'

const SHOW_PATHS = ['/', '/shop']

function hasSeenPopup() {
  try {
    return Boolean(localStorage.getItem(SEEN_KEY) || localStorage.getItem(SUBSCRIBED_KEY))
  } catch {
    return false
  }
}

function markPopupSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

export default function EmailCaptureModal() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const shownRef = useRef(false)
  const reduceMotion = prefersReducedMotion()

  useEffect(() => {
    if (hasSeenPopup() || shownRef.current) return undefined

    const path = window.location.pathname
    if (!SHOW_PATHS.includes(path) && !path.startsWith('/product/')) return undefined

    const timer = window.setTimeout(() => {
      if (hasSeenPopup() || shownRef.current) return
      shownRef.current = true
      markPopupSeen()
      setOpen(true)
    }, 9000)

    return () => clearTimeout(timer)
  }, [])

  const dismiss = () => {
    markPopupSeen()
    setOpen(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const clean = email.trim()
    if (!clean) return
    setSubmitting(true)
    try {
      await api.post('/newsletter/subscribe', { email: clean, source: 'popup' })
      try { localStorage.setItem(SUBSCRIBED_KEY, '1') } catch { /* ignore */ }
      setSuccess(true)
    } catch {
      dismiss()
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        className="email-capture-backdrop"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        onClick={dismiss}
        role="presentation"
      >
        <motion.div
          className="email-capture-modal"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
          transition={{ duration: reduceMotion ? 0 : 0.22 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="email-capture-title"
        >
          {!success ? (
            <>
              <h2 id="email-capture-title" className="email-capture-title">Get 15% off your first order</h2>
              <p className="email-capture-sub">Join our wellness list for exclusive pharmacy offers.</p>
              <form onSubmit={handleSubmit} className="email-capture-form">
                <input
                  type="email"
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-label="Email address"
                />
                <button type="submit" className="email-capture-btn" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Get My Code'}
                </button>
              </form>
              <button type="button" className="email-capture-dismiss" onClick={dismiss}>No thanks</button>
            </>
          ) : (
            <>
              <h2 className="email-capture-title">You&apos;re in!</h2>
              <p className="email-capture-sub">Use code at checkout:</p>
              <p className="email-capture-code">{DISCOUNT_CODE}</p>
              <button type="button" className="email-capture-btn" onClick={dismiss}>Start Shopping</button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
