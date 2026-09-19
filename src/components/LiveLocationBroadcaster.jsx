import { useEffect, useRef } from 'react'
import { rentalService } from '../services/allServices'

const SEND_INTERVAL_MS = 20000 // don't spam the backend — send at most every 20s

// Mounted once inside DriverLayout. Silently does nothing unless the driver has an ACTIVE
// rental right now — in that case it watches the device's GPS (browser Geolocation API) and
// periodically posts the latest fix so the customer can see "where's my driver" live.
export default function LiveLocationBroadcaster({ driverId }) {
  const watchIdRef = useRef(null)
  const lastSentRef = useRef(0)
  const activeRentalIdRef = useRef(null)

  useEffect(() => {
    if (!driverId) return
    let cancelled = false

    const checkAndStartWatching = async () => {
      try {
        const res = await rentalService.getByDriver(driverId)
        const active = (res.data.data || []).find(r => r.rentalStatus === 'ACTIVE')
        if (cancelled) return

        if (active) {
          activeRentalIdRef.current = active.rentalId
          startWatching()
        } else {
          stopWatching()
        }
      } catch { /* fail silently — tracking is a nice-to-have, not critical path */ }
    }

    const startWatching = () => {
      if (watchIdRef.current != null) return // already watching
      if (!navigator.geolocation) return

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now()
          if (now - lastSentRef.current < SEND_INTERVAL_MS) return
          lastSentRef.current = now
          if (!activeRentalIdRef.current) return

          rentalService.updateLocation(activeRentalIdRef.current, driverId, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }).catch(() => {})
        },
        () => { /* permission denied or unavailable — nothing we can do, stay silent */ },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
      )
    }

    const stopWatching = () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      activeRentalIdRef.current = null
    }

    checkAndStartWatching()
    // Re-check every 2 min in case a new trip starts or the current one ends while the driver is idle on other pages
    const pollInterval = setInterval(checkAndStartWatching, 120000)

    return () => {
      cancelled = true
      clearInterval(pollInterval)
      stopWatching()
    }
  }, [driverId])

  return null // renders nothing — purely a background side-effect
}
