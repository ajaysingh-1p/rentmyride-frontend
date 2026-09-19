import { useEffect, useState } from 'react'
import api, { resolveFileUrl } from '../../services/api'

// Bug fix: /uploads/documents/** requires login to view (Aadhar/DL/license photos are sensitive),
// but a plain <img src="..."> has no way to attach the Authorization header the backend now
// requires — every such image just failed to load ("Couldn't load image"). This component fetches
// the image through axios (which DOES attach the token, via the interceptor in services/api.js)
// as a blob, then hands the browser a local object URL to actually render.
//
// Car photos don't need this — they're public (see /uploads/cars/**) and can keep using a plain
// <img src={resolveFileUrl(...)}> directly.
export default function AuthenticatedImage({ src, alt, className, onError, ...rest }) {
  const [objectUrl, setObjectUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let currentUrl = null
    let cancelled = false
    setFailed(false)
    setObjectUrl(null)

    if (!src) return undefined

    const resolved = resolveFileUrl(src)
    // baseURL:'' override — `resolved` is already a complete URL (relative for local dev via the
    // Vite proxy, or absolute when VITE_API_BASE_URL points at a different production origin),
    // so we don't want axios prepending its own /api base on top of it.
    api.get(resolved, { responseType: 'blob', baseURL: '' })
      .then(res => {
        if (cancelled) return
        currentUrl = URL.createObjectURL(res.data)
        setObjectUrl(currentUrl)
      })
      .catch(() => { if (!cancelled) setFailed(true) })

    return () => {
      cancelled = true
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [src])

  if (!src || failed) {
    return (
      <div className={className + ' flex items-center justify-center bg-gray-50 text-gray-300 text-xs'} {...rest}>
        {failed ? 'Couldn\u2019t load image' : 'No image'}
      </div>
    )
  }
  if (!objectUrl) {
    return <div className={className + ' bg-gray-100 animate-pulse'} {...rest} />
  }
  return <img src={objectUrl} alt={alt} className={className} onError={onError} {...rest} />
}
