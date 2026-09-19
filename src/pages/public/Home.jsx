import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { carService } from '../../services/allServices'
import { resolveFileUrl } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../utils/helpers'
import { FiUsers, FiZap, FiArrowRight, FiMapPin, FiShield, FiClock } from 'react-icons/fi'

// New feature: a genuinely public landing page. Previously "/" just did
// <Navigate to="/login" replace /> — a visitor couldn't see a single car until they'd already
// registered/logged in, which is backwards for a rental site (people shop around before
// committing to an account). The backend already permitAll's GET /api/cars/available (see
// SecurityConfig) — nothing there needed to change, only the frontend never built a page that
// used it without auth. Booking itself still requires an account: "Book Now" always points at
// the normal protected /customer/booking/:carId route, so an anonymous click naturally bounces
// through CustomerRoute → /login exactly as before, just now preserving where they were headed
// (see ProtectedRoute.jsx + UnifiedLogin.jsx) so they land straight back on that car's booking
// page the moment they've signed in — no need to re-search for the same car twice.
export default function Home() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await carService.getAvailable()
        // Bug fix: this used to hard-cap the homepage to 9 cars with .slice(0, 9) — combined
        // with the global `overflow: hidden` on html/body/#root (see index.css, meant for the
        // dashboard layouts' own internal-scroll pattern), a fleet with more cars than fit in
        // one screen had no way to reach the rest: nothing below the fold was reachable AND the
        // page was silently truncated besides. Now every available car is shown, and the page
        // itself scrolls (see the root div's h-screen overflow-y-auto below) exactly like the
        // dashboard layouts already do for their own main content area.
        setCars(res.data.data || [])
      } catch {
        toast.error('Could not load cars right now — please try again.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleBookNow = (carId) => {
    // No auth check needed here at all — /customer/booking/:carId is already behind
    // CustomerRoute, which redirects to /login (remembering this exact URL) when there's no
    // logged-in customer. Duplicating that check here would just be two sources of truth for
    // the same rule.
    navigate('/customer/booking/' + carId)
  }

  return (
    <div className="h-screen overflow-y-auto bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <span className="text-xl font-extrabold text-gray-800">RentMy<span className="text-orange-500">Ride</span></span>
            <p className="text-[11px] text-gray-400 -mt-0.5">Dharm Dev Travels</p>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated() ? (
              <Link to="/customer/dashboard" className="btn-primary px-5 py-2 text-sm">Go to Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-2">Login</Link>
                <Link to="/register" className="btn-primary px-5 py-2 text-sm">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-sky-50 to-orange-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 py-14 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-3">
            Self-drive & chauffeur cars, ready when you are
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto mb-6">
            Browse our fleet, pick your dates, and book in minutes — local packages or outstation trips, both covered.
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500 flex-wrap mb-8">
            <span className="flex items-center gap-1.5"><FiShield className="text-orange-500" /> Verified drivers</span>
            <span className="flex items-center gap-1.5"><FiClock className="text-orange-500" /> 24×7 support</span>
            <span className="flex items-center gap-1.5"><FiMapPin className="text-orange-500" /> Local & outstation</span>
          </div>
          {/* New: a small trust-stats row, matching the same style already used on the login
              page's left panel, so the two feel like one consistent brand rather than two
              unrelated screens. */}
          <div className="flex items-center justify-center gap-3">
            {[['500+', 'Locations'], ['240+', 'Cars'], ['18%', 'GST Incl.']].map(([n, l]) => (
              <div key={l} className="bg-white border border-gray-100 rounded-xl px-5 py-2.5 text-center shadow-sm">
                <p className="text-orange-500 font-bold text-lg leading-tight">{n}</p>
                <p className="text-gray-400 text-[11px]">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Car grid */}
      <section className="max-w-6xl mx-auto px-5 py-10">
        <h2 className="text-xl font-bold text-gray-800 mb-5">Available Cars</h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
                <div className="h-44 bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-8 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : cars.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🚗</p>
            <p className="text-gray-500">No cars available right now — please check back soon.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {cars.map(car => (
                <div key={car.carId}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg
                             transition-all duration-300 border border-gray-100 group">
                  <div className="relative h-44 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                    {car.imageUrl ? (
                      <img src={resolveFileUrl(car.imageUrl)} alt={car.brand + ' ' + car.model}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-6xl opacity-20">🚗</span>
                      </div>
                    )}
                    <span className="absolute top-3 left-3 bg-white text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {car.transmissionType}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-gray-800 text-base">{car.brand} {car.model}</h3>
                        <p className="text-gray-400 text-xs">{car.year} • {car.carCategory?.replace('_', ' ')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-orange-500 font-bold text-lg">{formatCurrency(car.rentPerDay)}</p>
                        <p className="text-gray-400 text-xs">per day (local)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><FiUsers size={12} /> {car.seatingCapacity} seats</span>
                      <span className="flex items-center gap-1"><FiZap size={12} /> {car.fuelType}</span>
                    </div>
                    <button onClick={() => handleBookNow(car.carId)}
                      className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-sm">
                      Book Now <FiArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!isAuthenticated() && (
              <p className="text-center text-gray-400 text-xs mt-8">
                New here? <Link to="/register" className="text-orange-500 font-semibold hover:underline">Create a free account</Link> — takes less than a minute.
              </p>
            )}
          </>
        )}
      </section>

      {/* New: minimal footer — brand blurb, a couple of real quick links, and a copyright line.
          Kept deliberately small (no fake social icons, app-store badges, or link columns that
          go nowhere) since the site doesn't have that content to back it up yet. */}
      <footer className="border-t border-gray-100 bg-white mt-6">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <span className="font-extrabold text-gray-800">RentMy<span className="text-orange-500">Ride</span></span>
            <p className="text-gray-400 text-xs mt-0.5">Dharm Dev Travels · Local & outstation car rentals</p>
          </div>
          <div className="flex items-center gap-5 text-sm text-gray-500">
            <Link to="/login" className="hover:text-gray-800">Login</Link>
            <Link to="/register" className="hover:text-gray-800">Sign Up</Link>
          </div>
          <p className="text-gray-400 text-xs">© {new Date().getFullYear()} RentMyRide. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
