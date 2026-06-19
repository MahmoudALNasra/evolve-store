import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { useShipLocation } from '../hooks/useShipLocation'
import { formatShipLabel } from '../lib/shipLocation'

export default function ShipToBar({ className = '' }) {
  const { location, loadingLocation, updateZip } = useShipLocation()
  const [editing, setEditing] = useState(false)
  const [zipInput, setZipInput] = useState(location.zip)

  const shipLabel = loadingLocation ? 'Detecting location…' : formatShipLabel(location)

  const saveZip = () => {
    if (updateZip(zipInput)) {
      setEditing(false)
    }
  }

  const startEditing = () => {
    setZipInput(location.zip)
    setEditing(true)
  }

  return (
    <div className={`home-ship-to-bar${className ? ` ${className}` : ''}`}>
      <MapPin size={15} aria-hidden="true" />
      <span className="home-ship-to-label">
        Ships to: <strong>{shipLabel || 'Enter ZIP to check'}</strong>
      </span>
      {!editing ? (
        <button type="button" className="home-ship-to-change" onClick={startEditing}>
          Change
        </button>
      ) : (
        <span className="home-ship-to-edit">
          <input
            type="text"
            inputMode="numeric"
            placeholder="ZIP code"
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
            aria-label="ZIP code"
          />
          <button type="button" onClick={saveZip}>Save</button>
          <button type="button" onClick={() => setEditing(false)}>Cancel</button>
        </span>
      )}
    </div>
  )
}
