import { useEffect, useId, useRef, useState } from 'react'
import { MapPinned, Loader2 } from 'lucide-react'
import api from '@/lib/api'

function newSessionToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

/**
 * Street address field with Google Places suggestions via our API
 * (key lives on the server — no client VITE maps key required).
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  name = 'line1',
  placeholder = 'Start typing your street address…',
  error = '',
  disabled = false,
  id = 'checkout-street-address',
}) {
  const listId = useId()
  const wrapRef = useRef(null)
  const sessionRef = useRef(newSessionToken())
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [configured, setConfigured] = useState(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    const q = String(value || '').trim()
    if (disabled || selecting || q.length < 3) {
      setSuggestions([])
      setOpen(false)
      return undefined
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/shipping/address-autocomplete', {
          params: { q, sessionToken: sessionRef.current },
        })
        if (cancelled) return
        setConfigured(Boolean(data.configured))
        setSuggestions(data.suggestions || [])
        setOpen(Boolean(data.configured && data.suggestions?.length))
        setActiveIndex(-1)
      } catch {
        if (!cancelled) {
          setSuggestions([])
          setOpen(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 280)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, disabled, selecting])

  const pickSuggestion = async (suggestion) => {
    if (!suggestion?.placeId) return
    setSelecting(true)
    setOpen(false)
    setLoading(true)
    try {
      const { data } = await api.get('/shipping/address-details', {
        params: {
          placeId: suggestion.placeId,
          sessionToken: sessionRef.current,
        },
      })
      sessionRef.current = newSessionToken()
      if (data?.address) {
        onAddressSelect?.(data.address)
      }
    } catch {
      // Keep typed street; user can finish manually
    } finally {
      setLoading(false)
      setSelecting(false)
    }
  }

  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      pickSuggestion(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="checkout-field" ref={wrapRef}>
      <label htmlFor={id} className="checkout-label">
        Street Address *
      </label>
      <div className="checkout-input-wrap checkout-address-wrap">
        <input
          id={id}
          type="text"
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => {
            if (suggestions.length) setOpen(true)
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          className={`checkout-input${error ? ' checkout-input--error' : ''}`}
          aria-invalid={Boolean(error)}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          role="combobox"
        />
        <span className="checkout-input-badge" title={configured ? 'Powered by Google' : 'Manual entry'}>
          {loading ? <Loader2 size={14} className="spin" /> : <MapPinned size={14} aria-hidden="true" />}
          {configured ? 'Google' : 'Address'}
        </span>

        {open && suggestions.length > 0 && (
          <ul id={listId} className="checkout-suggest-list" role="listbox">
            {suggestions.map((s, index) => (
              <li key={s.placeId} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  className={`checkout-suggest-item${index === activeIndex ? ' is-active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(s)}
                >
                  <strong>{s.mainText}</strong>
                  {s.secondaryText && <span>{s.secondaryText}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id={`${id}-hint`} className="checkout-hint">
        {configured
          ? 'Pick a Google suggestion to auto-fill city, state, and ZIP.'
          : configured === false
            ? 'Address suggestions are off until GOOGLE_MAPS_API_KEY is set on the server. Enter a full USPS-style address.'
            : 'Start typing (3+ characters) for address suggestions.'}
      </p>
      {error && (
        <p id={`${id}-error`} className="checkout-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
