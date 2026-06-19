import { useEffect, useState, useCallback } from 'react'
import api from '../lib/api'
import useAuthStore from '../store/useAuthStore'
import {
  readStoredLocation,
  saveStoredLocation,
  getDefaultUserAddress,
} from '../lib/shipLocation'

export function useShipLocation() {
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)
  const [location, setLocation] = useState(readStoredLocation)
  const [loadingLocation, setLoadingLocation] = useState(() => !readStoredLocation().zip)

  useEffect(() => {
    if (!initialized) return undefined

    let cancelled = false

    async function resolveLocation() {
      const account = getDefaultUserAddress(user)
      if (account) {
        if (!cancelled) {
          setLocation(account)
          saveStoredLocation(account)
          setLoadingLocation(false)
        }
        return
      }

      const stored = readStoredLocation()
      if (stored.zip) {
        if (!cancelled) {
          setLocation(stored)
          setLoadingLocation(false)
        }
        return
      }

      try {
        const { data } = await api.get('/shipping/guess-location')
        const guessed = data?.location
        if (!cancelled && guessed?.zip) {
          setLocation(guessed)
          saveStoredLocation(guessed)
        }
      } catch {
        /* manual fallback */
      } finally {
        if (!cancelled) setLoadingLocation(false)
      }
    }

    resolveLocation()
    return () => { cancelled = true }
  }, [user, initialized])

  const updateZip = useCallback((zipInput) => {
    const zip = String(zipInput).trim().slice(0, 10)
    if (!/^\d{5}(-\d{4})?$/.test(zip)) return false
    const next = { zip: zip.slice(0, 5), city: '', state: '', source: 'manual' }
    saveStoredLocation(next)
    setLocation(next)
    return true
  }, [])

  return { location, loadingLocation, updateZip }
}
