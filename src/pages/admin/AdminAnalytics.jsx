import { useEffect, useState } from 'react'
import { carService, reservationService, rentalService, paymentService } from '../../services/allServices'
import AdminLayout from '../../components/layout/AdminLayout'
import { formatCurrency } from '../../utils/helpers'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { FiTrendingUp, FiTruck, FiPieChart, FiMap } from 'react-icons/fi'

const COLORS = ['#FF6B00', '#0EA5E9', '#22C55E', '#A855F7', '#F59E0B', '#EF4444', '#6366F1']

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true)
  const [revenueTrend, setRevenueTrend] = useState([])
  const [popularCars, setPopularCars] = useState([])
  const [statusSplit, setStatusSplit] = useState([])
  const [tripTypeSplit, setTripTypeSplit] = useState([])
  const [summary, setSummary] = useState(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [carsRes, resRes, rentsRes, paymentsRes] = await Promise.all([
        carService.getAll(),
        reservationService.getAll(),
        rentalService.getAll(),
        paymentService.getAll(),
      ])
      const cars = carsRes.data.data || []
      const reservations = resRes.data.data || []
      const rentals = rentsRes.data.data || []
      const payments = paymentsRes.data.data || []

      // ── Revenue trend (last 12 months) ──
      const months = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
        const total = payments
          .filter(p => p.paymentStatus === 'SUCCESS' && p.paymentDatetime)
          .filter(p => {
            const pd = new Date(p.paymentDatetime)
            return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear()
          })
          .reduce((s, p) => s + (p.totalAmount || 0), 0)
        months.push({ month: label, revenue: Math.round(total) })
      }
      setRevenueTrend(months)

      // ── Popular cars (by completed rental count) ──
      const carCounts = {}
      rentals.forEach(r => {
        const key = r.carBrand + ' ' + r.carModel
        carCounts[key] = (carCounts[key] || 0) + 1
      })
      const popular = Object.entries(carCounts)
        .map(([name, trips]) => ({ name, trips }))
        .sort((a, b) => b.trips - a.trips)
        .slice(0, 6)
      setPopularCars(popular)

      // ── Booking status split ──
      const statusCounts = {}
      reservations.forEach(r => {
        statusCounts[r.reservationStatus] = (statusCounts[r.reservationStatus] || 0) + 1
      })
      setStatusSplit(Object.entries(statusCounts).map(([name, value]) => ({ name, value })))

      // ── Trip type split ──
      const tripCounts = {}
      reservations.forEach(r => {
        tripCounts[r.tripType] = (tripCounts[r.tripType] || 0) + 1
      })
      setTripTypeSplit(Object.entries(tripCounts).map(([name, value]) => ({ name, value })))

      // ── Summary numbers ──
      const totalRevenue = payments.filter(p => p.paymentStatus === 'SUCCESS').reduce((s, p) => s + (p.totalAmount || 0), 0)
      const completedTrips = rentals.filter(r => r.rentalStatus === 'COMPLETED').length
      const avgTripValue = completedTrips > 0 ? totalRevenue / completedTrips : 0
      const utilizationPct = cars.length > 0
        ? Math.round((cars.filter(c => c.availabilityStatus === 'BOOKED').length / cars.length) * 100)
        : 0

      setSummary({ totalRevenue, completedTrips, avgTripValue, utilizationPct, totalCars: cars.length })
    } catch (err) {
      console.error('Analytics error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-gray-100 rounded-xl w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={'skeleton-' + i} className="h-24 bg-gray-100 rounded-2xl" />)}
          </div>
          <div className="h-80 bg-gray-100 rounded-2xl" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="page-title mb-2">Analytics</div>
      <p className="text-gray-500 text-sm mb-6">Revenue trends, fleet performance, and booking patterns.</p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: formatCurrency(summary?.totalRevenue), icon: '💰' },
          { label: 'Completed Trips', value: summary?.completedTrips, icon: '🚗' },
          { label: 'Avg. Trip Value', value: formatCurrency(summary?.avgTripValue), icon: '📊' },
          { label: 'Fleet Utilization', value: (summary?.utilizationPct || 0) + '%', icon: '📈' },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="font-bold text-gray-800 text-lg">{s.value}</p>
            <p className="text-gray-400 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue Trend */}
      <div className="card mb-6">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
          <FiTrendingUp className="text-orange-500" /> Revenue Trend (Last 12 Months)
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={revenueTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={v => formatCurrency(v)} />
            <Line type="monotone" dataKey="revenue" stroke="#FF6B00" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Popular Cars */}
        <div className="card">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
            <FiTruck className="text-orange-500" /> Most Popular Cars
          </h3>
          {popularCars.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">No completed trips yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={popularCars} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="trips" fill="#0EA5E9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Booking Status Split */}
        <div className="card">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
            <FiPieChart className="text-orange-500" /> Booking Status Split
          </h3>
          {statusSplit.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">No bookings yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {statusSplit.map((entry, i) => <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Trip Type Split */}
      <div className="card mt-6">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
          <FiMap className="text-orange-500" /> Local vs Outstation Trips
        </h3>
        {tripTypeSplit.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-10">No bookings yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={tripTypeSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {tripTypeSplit.map((entry, i) => <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </AdminLayout>
  )
}
