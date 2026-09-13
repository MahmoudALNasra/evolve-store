import { useEffect, useRef, useState } from 'react'
import { MapPinned } from 'lucide-react'
import { hasGoogleMapsApiKey, loadGoogleMapsPlaces, placeToShippingAddress } from '@/lib/googleMaps'

/**
 * Street address field with optional Google Places Autocomplete.
 * Falls back to a normal input when VITE_GOOGLE_MAPS_API_KEY is unset.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  name = 'line1',
  placeholder = 'Start typing your address…',
  error = '',
  disabled = false,
  id = 'checkout-street-address',
}) {
  const inputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const onSelectRef = useRef(onAddressSelect)
  onSelectRef.current = onAddressSelect
  const [mapsReady, setMapsReady] = useState(false)
  const [mapsFailed, setMapsFailed] = useState(false)
  const placesEnabled = hasGoogleMapsApiKey()

  useEffect(() => {
    if (!placesEnabled || disabled) return undefined

    let cancelled = false

    loadGoogleMapsPlaces()
      .then((google) => {
        if (cancelled || !google?.maps?.places || !inputRef.current) return

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'us' },
          fields: ['address_components', 'formatted_address'],
          types: ['address'],
        })

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          if (!place?.address_components?.length) return
          const parsed = placeToShippingAddress(place)
          onSelectRef.current?.(parsed)
        })

        autocompleteRef.current = autocomplete
        setMapsReady(true)
      })
      .catch(() => {
        if (!cancelled) setMapsFailed(true)
      })

    return () => {
      cancelled = true
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
      autocompleteRef.current = null
    }
  }, [placesEnabled, disabled])

  return (
    <div className="checkout-field">
      <label htmlFor={id} className="checkout-label">
        Street Address *
      </label>
      <div className="checkout-input-wrap">
        <input
          ref={inputRef}
          id={id}
          type="text"
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={placesEnabled ? 'off' : 'address-line1'}
          disabled={disabled}
          className={`checkout-input${error ? ' checkout-input--error' : ''}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
        />
        {placesEnabled && mapsReady && (
          <span className="checkout-input-badge" title="Powered by Google">
            <MapPinned size={14} aria-hidden="true" />
            Google
          </span>
        )}
      </div>
      <p id={`${id}-hint`} className="checkout-hint">
        {placesEnabled && !mapsFailed
          ? 'Search with Google address suggestions, then confirm apt/suite if needed.'
          : 'Enter house/building number first, then street name (e.g. 123 Main St).'}
      </p>
      {error && (
        <p id={`${id}-error`} className="checkout-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
