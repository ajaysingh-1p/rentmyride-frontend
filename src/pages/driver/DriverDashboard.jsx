import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { rentalService, reservationService } from '../../services/allServices'
import DriverLayout from '../../components/layout/DriverLayout'
import { formatCurrency } from '../../utils/helpers'
import { FiKey, FiTruck, FiCheckCircle, FiClock } from 'react-icons/fi'

export default function DriverDashboard() {
  const { user } = useAuth()
  const [rentals, setRentals] = useState([])
  const [pendingPickups, setPendingPickups] = useState([])
  // New feature: Driver Trip Accept/Reject
  const [tripRequests, setTripRequests] = useState([])
  const [resolvingId, setResolvingId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [user.userId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [rentalsRes, pickupsRes, requestsRes] = await Promise.all([
        rentalService.getByDriver(user.userId),
        reservationService.getPendingPickups(user.userId),
        reservationService.getPendingTripRequests(),
      ])
      setRentals(rentalsRes.data.data || [])
      setPendingPickups(pickupsRes.data.data || [])
      setTripRequests(requestsRes.data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleTripDecision = async (reservationId, accept) => {
    setResolvingId(reservationId)
    try {
      if (accept) {
        await reservationService.acceptTripAssignment(reservationId)
        toast.success('Trip accepted!')
      } else {
        const reason = window.prompt('Reason for declining (optional):') || ''
        await reservationService.rejectTripAssignment(reservationId, reason)
        toast.success('Trip declined.')
      }
      setTripRequests(prev => prev.filter(r => r.reservationId !== reservationId))
      if (accept) fetchData() // refresh pending pickups too, since it now qualifies
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to respond to trip.')
    } finally {
      setResolvingId(null)
    }
  }

  const activeRentals    = rentals.filter(r => r.rentalStatus === 'ACTIVE')
  const completedRentals = rentals.filter(r => r.rentalStatus === 'COMPLETED')

  const stats = [
    { label: 'Pending Pickups',  value: pendingPickups.length,   icon: FiClock,       bg: 'bg-purple-50', ic: 'text-purple-500' },
    { label: 'Active Now',       value: activeRentals.length,    icon: FiTruck,       bg: 'bg-orange-50', ic: 'text-orange-500' },
    { label: 'Completed',        value: completedRentals.length, icon: FiCheckCircle, bg: 'bg-green-50',  ic: 'text-green-500'  },
  ]

  return (
    <DriverLayout>
      {/* Welcome */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Welcome, {user?.name?.split(' ')[0]}! 👋
        </h2>
        <p className="text-gray-500 mt-1">Ready to handle pickups and returns today!</p>
      </div>

      {/* Quick Action Banner */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-6 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-white font-bold text-xl mb-1">Pickup or Drop-off a Customer</h3>
          <p className="text-sky-100 text-sm">Start a new trip or close out an ongoing one.</p>
        </div>
        <Link to="/driver/pickup-dropoff"
          className="bg-white text-sky-600 font-bold px-6 py-3 rounded-xl
                     hover:bg-sky-50 transition-all flex items-center gap-2 whitespace-nowrap">
          🚗 Go to Pickup / Drop-off
        </Link>
      </div>

      {/* New feature: Driver Trip Accept/Reject — needs immediate action, so it sits right up top */}
      {!loading && tripRequests.length > 0 && (
        <div className="card mb-6 border-2 border-purple-200 bg-purple-50">
          <h3 className="font-bold text-purple-800 text-sm mb-3 flex items-center gap-2">
            🔔 New Trip Requests — Please Respond ({tripRequests.length})
          </h3>
          <div className="space-y-2">
            {tripRequests.map(r => (
              <div key={r.reservationId} className="bg-white rounded-xl p-3 flex items-center justify-between gap-3 border border-purple-100 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-gray-800">#RES-{r.reservationId} — {r.carBrand} {r.carModel}</p>
                  <p className="text-xs text-gray-500">
                    Pickup: {r.pickupDate} at {r.pickupTime} · {r.pickupLocation} → {r.dropLocation}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button disabled={resolvingId === r.reservationId} onClick={() => handleTripDecision(r.reservationId, true)}
                    className="text-xs font-semibold bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                    Accept
                  </button>
                  <button disabled={resolvingId === r.reservationId} onClick={() => handleTripDecision(r.reservationId, false)}
                    className="text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, bg, ic }) => (
          <div key={label} className="stat-card">
            <div className={'stat-icon ' + bg}>
              <Icon className={ic} size={20} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">{loading ? '—' : value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* Pending Pickups */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FiClock className="text-sky-500" /> Pending Pickups
            </h3>
            <Link to="/driver/pickup-dropoff" className="text-sky-500 text-xs font-semibold hover:underline">
              Go to Pickup →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={'skeleton-' + i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : pendingPickups.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No pending pickups assigned to you</p>
          ) : (
            <div className="space-y-2">
              {pendingPickups.slice(0, 5).map(r => (
                <div key={r.reservationId} className="flex items-center justify-between p-3 bg-purple-50
                                                        border border-purple-100 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{r.carBrand} {r.carModel}</p>
                    <p className="text-gray-400 text-xs">{r.customerName} • {r.pickupDate}</p>
                  </div>
                  <span className="badge-warning">Pending</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Rentals */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FiKey className="text-sky-500" /> My Active Rentals
            </h3>
            <Link to="/driver/rentals" className="text-sky-500 text-xs font-semibold hover:underline">
              View All →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={'skeleton-' + i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : activeRentals.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No active rentals assigned</p>
          ) : (
            <div className="space-y-2">
              {activeRentals.slice(0, 5).map(r => (
                <div key={r.rentalId} className="flex items-center justify-between p-3 bg-orange-50
                                                  border border-orange-100 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{r.carBrand} {r.carModel}</p>
                    <p className="text-gray-400 text-xs">{r.customerName} • {r.carRegistrationNumber}</p>
                  </div>
                  <span className="badge-info">Active</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DriverLayout>
  )
}
