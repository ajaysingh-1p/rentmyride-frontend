import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { reservationService, rentalService, invoiceService } from '../../services/allServices'
import { useLanguage } from '../../context/LanguageContext'
import CustomerLayout from '../../components/layout/CustomerLayout'
import SelfDriveTripPanel from '../../components/SelfDriveTripPanel'
import { formatCurrency, formatDate, getBadgeClass, getStatusInfo, toLocalDateStr } from '../../utils/helpers'
import { RESERVATION_STATUS, RENTAL_STATUS } from '../../utils/constants'
import { FiCalendar, FiTruck, FiFileText, FiX, FiDownload, FiStar } from 'react-icons/fi'

const TABS = [
  { key: 'reservations', label: 'Reservations', icon: FiCalendar },
  { key: 'rentals',      label: 'Rentals',      icon: FiTruck    },
]

export default function MyBookings() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const { t }      = useLanguage()
  const [tab, setTab]               = useState('reservations')
  const [reservations, setReservations] = useState([])
  const [rentals, setRentals]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [cancelling, setCancelling]     = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null) // reservation object pending cancellation confirmation
  const [rescheduleTarget, setRescheduleTarget] = useState(null)
  const [newPickupDate, setNewPickupDate] = useState('')
  const [newPickupTime, setNewPickupTime] = useState('')
  const [newReturnDate, setNewReturnDate] = useState('')
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleResult, setRescheduleResult] = useState(null) // backend breakdown, shown after confirming
  const [extendTarget, setExtendTarget] = useState(null)
  const [extendReturnDate, setExtendReturnDate] = useState('')
  const [extendCurrentReturnDate, setExtendCurrentReturnDate] = useState('')
  const [extending, setExtending] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [trackingRentalId, setTrackingRentalId] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [user.userId])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [resRes, renRes] = await Promise.all([
        reservationService.getByCustomer(user.userId),
        rentalService.getByCustomer(user.userId),
      ])
      setReservations(resRes.data.data || [])
      setRentals(renRes.data.data || [])
    } catch {
      toast.error('Failed to load bookings.')
    } finally {
      setLoading(false)
    }
  }

  const handleExtend = async () => {
    if (!extendReturnDate) { toast.error('Pick a new return date.'); return }
    setExtending(true)
    try {
      const res = await rentalService.extend(extendTarget.rentalId, { newReturnDate: extendReturnDate })
      const result = res.data.data
      toast.success(result.message || 'Rental extended!')
      setExtendTarget(null)
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Extend failed.')
    } finally {
      setExtending(false)
    }
  }

  const handleReschedule = async () => {
    if (!newPickupDate || !newReturnDate) { toast.error('Pick both dates.'); return }
    if (newReturnDate < newPickupDate) { toast.error('Return date cannot be before pickup date.'); return }
    setRescheduling(true)
    try {
      const res = await reservationService.reschedule(rescheduleTarget.reservationId, {
        newPickupDate, newPickupTime, newReturnDate,
      })
      const result = res.data.data
      // The dates/fee note shown BEFORE confirming was only ever a rough estimate — the actual
      // new fare depends on this car's live rate for the new dates, which only the server knows.
      // Showing that real breakdown here (rather than just a generic toast) is what tells the
      // customer whether they now owe more, got a refund, or nothing changed.
      setRescheduleTarget(null)
      setRescheduleResult(result)
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reschedule failed.')
    } finally {
      setRescheduling(false)
    }
  }

  const handleCancel = async (reservationId) => {
    setCancelling(reservationId)
    try {
      const res = await reservationService.cancel(reservationId)
      const result = res.data.data
      if (result?.freeCancellation) {
        toast.success('Cancelled free of charge — full refund of ' + formatCurrency(result.refundAmount) + '.')
      } else if (result) {
        toast.success('Cancelled. ' + formatCurrency(result.cancellationFee) + ' fee deducted — refund: ' + formatCurrency(result.refundAmount) + '.')
      } else {
        toast.success('Reservation cancelled.')
      }
      setCancelTarget(null)
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancellation failed.')
    } finally {
      setCancelling(null)
    }
  }

  // Hours remaining until pickup — used to show whether cancellation is free or fee applies
  const hoursUntilPickup = (reservation) => {
    if (!reservation?.pickupDate) return null
    const pickupDateTime = new Date(reservation.pickupDate + 'T' + (reservation.pickupTime || '09:00'))
    return (pickupDateTime.getTime() - Date.now()) / (1000 * 60 * 60)
  }

  const handleDownloadInvoice = async (rentalId) => {
    try {
      // Invoices are now auto-generated the moment a rental completes (see backend), so this
      // should always exist — no more customer-side "generate" fallback, which used to call an
      // ADMIN-only endpoint and fail with "access denied" for every customer.
      const invRes = await invoiceService.getByRental(rentalId)
      const invoiceId = invRes?.data?.data?.invoiceId
      if (invoiceId) navigate('/customer/invoice/' + invoiceId)
      else toast.error('Invoice not available yet — please try again in a moment.')
    } catch {
      toast.error('Invoice not available yet — please try again in a moment.')
    }
  }

  const canCancel = (status) => ['PENDING', 'CONFIRMED'].includes(status)
  const canFeedback = (status) => status === 'COMPLETED'

  // ── Date-range filter (applies to whichever tab is active) ──
  const inRange = (dateStr) => {
    if (!dateStr) return true
    const d = dateStr.slice(0, 10) // handles both 'YYYY-MM-DD' and full datetimes
    if (dateFrom && d < dateFrom) return false
    if (dateTo && d > dateTo) return false
    return true
  }
  const filteredReservations = reservations.filter(r => inRange(r.pickupDate))
  const filteredRentals = rentals.filter(r => inRange(r.actualPickupDatetime))
  const clearFilters = () => { setDateFrom(''); setDateTo('') }

  // ── PDF Export (current tab, respecting the active date filter) ──
  const exportPdf = async () => {
    const rows = tab === 'reservations' ? filteredReservations : filteredRentals
    if (rows.length === 0) { toast.error('Nothing to export for this range.'); return }
    try {
      const service = tab === 'reservations' ? reservationService : rentalService
      const res = await service.exportPdf(user.userId, user.name)
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'rentmyride-' + tab + '-' + toLocalDateStr(new Date()) + '.pdf'
      link.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded!')
    } catch {
      toast.error('Could not generate PDF. Try again.')
    }
  }

  return (
    <CustomerLayout>
      <div className="page-title mb-6">{t('myBookings')}</div>

      {/* Self-drive: start/return the trip yourself via an OTP handover at the hub. Renders
          nothing at all unless there's a self-drive booking that's actually actionable. */}
      <SelfDriveTripPanel reservations={reservations} onChanged={fetchAll} />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ' +
              (tab === key ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            <Icon size={15} /> {label}
            <span className={'text-xs px-1.5 py-0.5 rounded-full ' +
              (tab === key ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500')}>
              {key === 'reservations' ? reservations.length : rentals.length}
            </span>
          </button>
        ))}
      </div>

      {/* Tab explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-xs text-blue-700">
        {tab === 'reservations'
          ? <><strong>Reservations</strong> = your online bookings (dates, route, payment). Pay/cancel from here.</>
          : <><strong>Rentals</strong> = the actual car handover record, created by our staff once you physically pick up the car. Once a rental is marked <strong>Completed</strong> (car returned), a <strong>Feedback</strong> button appears here.</>}
      </div>

      {/* Date Filter + Export */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="form-label text-[11px]">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="form-input py-1.5 text-sm" />
        </div>
        <div>
          <label className="form-label text-[11px]">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="form-input py-1.5 text-sm" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={clearFilters} className="text-gray-400 hover:text-gray-600 text-xs underline pb-2">
            Clear
          </button>
        )}
        <button onClick={exportPdf}
          className="btn-outline text-xs py-2 px-4 flex items-center gap-1.5 ml-auto">
          <FiDownload size={13} /> Export PDF
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={'skeleton-' + i} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : (

        /* ── Reservations Tab ── */
        tab === 'reservations' ? (
          filteredReservations.length === 0 ? (
            <div className="text-center py-20 card">
              <p className="text-5xl mb-4">📋</p>
              <p className="text-xl font-bold text-gray-700 mb-2">
                {reservations.length === 0 ? 'No reservations yet' : 'No reservations in this date range'}
              </p>
              <p className="text-gray-400 text-sm mb-5">
                {reservations.length === 0 ? 'Start by browsing available cars' : 'Try clearing the date filter'}
              </p>
              {reservations.length === 0 ? (
                <button onClick={() => navigate('/customer/cars')} className="btn-primary">
                  Browse Cars
                </button>
              ) : (
                <button onClick={clearFilters} className="btn-outline">Clear Filter</button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {[...filteredReservations]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map(r => {
                  const status = getStatusInfo(RESERVATION_STATUS, r.reservationStatus)
                  return (
                    <div key={r.reservationId}
                      className="card hover:shadow-lg transition-shadow duration-200">
                      <div className="flex flex-wrap items-start justify-between gap-4">

                        {/* Left Info */}
                        <div className="flex gap-4 items-start">
                          <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center
                                          justify-center text-2xl flex-shrink-0">🚗</div>
                          <div>
                            <h3 className="font-bold text-gray-800 text-base">
                              {r.carBrand} {r.carModel}
                            </h3>
                            <p className="text-gray-400 text-xs mt-0.5">{r.carRegistrationNumber}</p>
                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                              <span>📅 {formatDate(r.pickupDate)} → {formatDate(r.returnDate)}</span>
                              <span>🗓️ {r.totalDays} day{r.totalDays > 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-500">
                              <span>📍 {r.pickupLocation}</span>
                              {r.viaLocations && <span>→ {r.viaLocations}</span>}
                              <span>→ {r.dropLocation}</span>
                            </div>
                            {r.assignedDriverName && (
                              <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5 text-xs text-blue-700">
                                🚕 <strong>{r.assignedDriverName}</strong> — {r.assignedDriverMobile}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Info */}
                        <div className="flex flex-col items-end gap-3">
                          <span className={getBadgeClass(status.color)}>{status.label}</span>
                          <p className="font-bold text-orange-500 text-lg">
                            {formatCurrency(r.estimatedAmount)}
                          </p>
                          {r.balanceDue > 0 ? (
                            <p className="text-red-500 text-xs">Balance due: {formatCurrency(r.balanceDue)}</p>
                          ) : (
                            <p className="text-green-500 text-xs">Fully paid</p>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 flex-wrap justify-end">
                            {r.balanceDue > 0 && r.reservationStatus !== 'CANCELLED' && (
                              <button
                                onClick={() => navigate('/customer/booking-payment/' + r.reservationId)}
                                className="flex items-center gap-1.5 text-xs text-blue-500
                                           border border-blue-200 hover:bg-blue-50 px-3 py-1.5
                                           rounded-lg transition-all">
                                💳 Pay Now
                              </button>
                            )}
                            {canCancel(r.reservationStatus) && (
                              rentals.some(rent => rent.reservationId === r.reservationId) ? (
                                // Bug fix: this booking's trip has already started (a Rental
                                // record exists) — Reschedule used to still be offered here, and
                                // using it changed THIS Reservation's dates/amount while the
                                // already-created Rental record was left completely untouched,
                                // so the two ended up showing different dates and different
                                // amounts for what is really the same booking. Once a Rental
                                // exists, "Extend Rental" (on the Rentals tab) is the correct
                                // action — it updates both records together.
                                <span className="text-xs text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg">
                                  Trip started — use Extend Rental instead
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setRescheduleTarget(r)
                                    setNewPickupDate(r.pickupDate)
                                    setNewPickupTime(r.pickupTime || '09:00')
                                    setNewReturnDate(r.returnDate)
                                  }}
                                  className="flex items-center gap-1.5 text-xs text-purple-500
                                             border border-purple-200 hover:bg-purple-50 px-3 py-1.5
                                             rounded-lg transition-all">
                                  📅 Reschedule
                                </button>
                              )
                            )}
                            {canCancel(r.reservationStatus) && (
                              <button
                                onClick={() => setCancelTarget(r)}
                                disabled={cancelling === r.reservationId}
                                className="flex items-center gap-1.5 text-xs text-red-500
                                           border border-red-200 hover:bg-red-50 px-3 py-1.5
                                           rounded-lg transition-all disabled:opacity-50">
                                <FiX size={12} />
                                {cancelling === r.reservationId ? 'Cancelling...' : 'Cancel'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Reservation ID */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                          Booking ID: <span className="font-mono font-semibold text-gray-600">
                            #RES-{r.reservationId}
                          </span>
                          {r.tripType && (
                            <span className="ml-2">{r.tripType === 'OUTSTATION' ? '🛣️ Outstation' : '🏙️ Local'}</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          Booked on: {formatDate(r.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
            </div>
          )

        ) : (
          /* ── Rentals Tab ── */
          filteredRentals.length === 0 ? (
            <div className="text-center py-20 card">
              <p className="text-5xl mb-4">🚗</p>
              <p className="text-xl font-bold text-gray-700 mb-2">
                {rentals.length === 0 ? 'No rental history yet' : 'No rentals in this date range'}
              </p>
              <p className="text-gray-400 text-sm">
                {rentals.length === 0
                  ? 'A rental appears here once staff hand over the car for a confirmed reservation.'
                  : 'Try clearing the date filter.'}
              </p>
              {rentals.length > 0 && (
                <button onClick={clearFilters} className="btn-outline mt-4">Clear Filter</button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {[...filteredRentals]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map(r => {
                  const status = getStatusInfo(RENTAL_STATUS, r.rentalStatus)
                  return (
                    <div key={r.rentalId} className="card hover:shadow-lg transition-shadow duration-200">
                      <div className="flex flex-wrap items-start justify-between gap-4">

                        {/* Left */}
                        <div className="flex gap-4 items-start">
                          <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center
                                          justify-center text-2xl flex-shrink-0">🚙</div>
                          <div>
                            <h3 className="font-bold text-gray-800 text-base">
                              {r.carBrand} {r.carModel}
                            </h3>
                            <p className="text-gray-400 text-xs mt-0.5">{r.carRegistrationNumber}</p>
                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                              {r.actualPickupDatetime && (
                                <span>🚀 {formatDate(r.actualPickupDatetime)}</span>
                              )}
                              {r.actualReturnDatetime && (
                                <span>🏁 {formatDate(r.actualReturnDatetime)}</span>
                              )}
                              {r.totalKmDriven && (
                                <span>📍 {r.totalKmDriven} km driven</span>
                              )}
                            </div>
                            {r.driverName && (
                              <p className="text-xs text-gray-400 mt-1">
                                🚕 Driver: {r.driverName}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right */}
                        <div className="flex flex-col items-end gap-3">
                          <span className={getBadgeClass(status.color)}>{status.label}</span>
                          <p className="font-bold text-orange-500 text-lg">
                            {formatCurrency(r.totalAmount)}
                          </p>

                          {/* Actions */}
                          <div className="flex gap-2 flex-wrap justify-end">
                            {canFeedback(r.rentalStatus) && (
                              <button
                                onClick={() => navigate('/customer/feedback/' + r.rentalId)}
                                className="flex items-center gap-1.5 text-xs text-white font-semibold
                                           bg-orange-500 hover:bg-orange-600 px-3.5 py-1.5
                                           rounded-lg transition-all shadow-sm">
                                <FiStar size={12} /> Give Feedback
                              </button>
                            )}
                            {r.rentalStatus === 'ACTIVE' && (
                              <button
                                onClick={() => setTrackingRentalId(trackingRentalId === r.rentalId ? null : r.rentalId)}
                                className="flex items-center gap-1.5 text-xs text-red-500
                                           border border-red-200 hover:bg-red-50 px-3 py-1.5
                                           rounded-lg transition-all">
                                🔴 {trackingRentalId === r.rentalId ? 'Hide Tracking' : 'Track Live'}
                              </button>
                            )}
                            {r.rentalStatus === 'ACTIVE' && (
                              <button
                                // Bug fix: this used to route to the OLD rental-based payment
                                // page (/customer/payment/:rentalId), a completely separate flow
                                // from the reservation-based one everywhere else in the app — it
                                // added its own 18% GST ON TOP of the amount instead of the price
                                // already being GST-inclusive, and its Payment records could get
                                // stuck PENDING if the browser-side callback never fired (no
                                // reconciliation with the reservation's actual amountPaid). Now
                                // routes to the SAME booking-payment flow used everywhere else,
                                // which pays down the reservation's real remaining balance.
                                onClick={() => navigate('/customer/booking-payment/' + r.reservationId)}
                                className="flex items-center gap-1.5 text-xs text-blue-500
                                           border border-blue-200 hover:bg-blue-50 px-3 py-1.5
                                           rounded-lg transition-all">
                                💳 Pay Now
                              </button>
                            )}
                            {r.rentalStatus === 'ACTIVE' && (
                              <button
                                onClick={async () => {
                                  setExtendTarget(r)
                                  setExtendReturnDate('')
                                  try {
                                    const res = await reservationService.getById(r.reservationId)
                                    setExtendCurrentReturnDate(res.data.data?.returnDate || '')
                                  } catch { setExtendCurrentReturnDate('') }
                                }}
                                className="flex items-center gap-1.5 text-xs text-purple-500
                                           border border-purple-200 hover:bg-purple-50 px-3 py-1.5
                                           rounded-lg transition-all">
                                ⏳ Extend Rental
                              </button>
                            )}
                            {r.rentalStatus === 'COMPLETED' && (
                              <button
                                onClick={() => handleDownloadInvoice(r.rentalId)}
                                className="flex items-center gap-1.5 text-xs text-green-500
                                           border border-green-200 hover:bg-green-50 px-3 py-1.5
                                           rounded-lg transition-all">
                                <FiDownload size={12} /> Invoice
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {trackingRentalId === r.rentalId && <LiveTrackingPanel rentalId={r.rentalId} />}

                      {r.rentalStatus === 'COMPLETED' && r.wouldRebook == null && (
                        <RebookPoll rentalId={r.rentalId} customerId={user.userId} />
                      )}

                      {/* Rental ID */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                          Rental ID: <span className="font-mono font-semibold text-gray-600">
                            #REN-{r.rentalId}
                          </span>
                        </p>
                        <div className="flex gap-4 text-xs text-gray-400">
                          {r.damageCharges > 0 && (
                            <span className="text-red-400">
                              Damage: {formatCurrency(r.damageCharges)}
                            </span>
                          )}
                          {r.discountAmount > 0 && (
                            <span className="text-green-500">
                              Discount: {formatCurrency(r.discountAmount)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )
        )
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setRescheduleTarget(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center text-2xl mb-4">
              📅
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Reschedule this booking?</h3>
            <p className="text-gray-500 text-sm mb-4">
              {rescheduleTarget.carBrand} {rescheduleTarget.carModel} — Booking #RES-{rescheduleTarget.reservationId}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="form-label">New Pickup Date</label>
                <input type="date" value={newPickupDate} min={toLocalDateStr(new Date())}
                  onChange={e => setNewPickupDate(e.target.value)} className="form-input text-sm" />
              </div>
              <div>
                <label className="form-label">New Pickup Time</label>
                <input type="time" value={newPickupTime}
                  onChange={e => setNewPickupTime(e.target.value)} className="form-input text-sm" />
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label">New Return Date</label>
              <input type="date" value={newReturnDate} min={newPickupDate}
                onChange={e => setNewReturnDate(e.target.value)} className="form-input text-sm" />
            </div>

            {(() => {
              const hrs = hoursUntilPickup(rescheduleTarget)
              const isFree = hrs === null || hrs >= 12
              return (
                <div className={'rounded-xl p-3 mb-5 text-xs ' +
                  (isFree ? 'bg-green-50 border border-green-200 text-green-700'
                          : 'bg-orange-50 border border-orange-200 text-orange-700')}>
                  {isFree
                    ? '✅ Free reschedule — 12+ hours before your original pickup.'
                    : '⏰ Within 12 hours of original pickup — a ₹300 reschedule fee will apply.'}
                  {' '}Price will be recalculated for the new dates.
                </div>
              )
            })()}

            <div className="flex gap-3">
              <button onClick={() => setRescheduleTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleReschedule} disabled={rescheduling}
                className="flex-1 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold text-sm disabled:opacity-60">
                {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Result — the server-computed breakdown, since the actual new fare can only
          be known after the car's live rate is applied to the new dates. */}
      {rescheduleResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setRescheduleResult(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center text-2xl mb-4">
              ✅
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Booking Rescheduled</h3>
            <p className="text-gray-500 text-sm mb-4">{rescheduleResult.message}</p>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-5">
              <div className="flex justify-between text-gray-500">
                <span>Previous amount</span>
                <span>{formatCurrency(rescheduleResult.oldAmount)}</span>
              </div>
              {rescheduleResult.rescheduleFee > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Reschedule fee</span>
                  <span>{formatCurrency(rescheduleResult.rescheduleFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-800 border-t border-gray-200 pt-2">
                <span>New amount</span>
                <span>{formatCurrency(rescheduleResult.newAmount)}</span>
              </div>
              {rescheduleResult.refundedToWallet > 0 && (
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Credited to wallet</span>
                  <span>{formatCurrency(rescheduleResult.refundedToWallet)}</span>
                </div>
              )}
              {rescheduleResult.balanceDue > 0 && (
                <div className="flex justify-between text-red-600 font-semibold">
                  <span>Balance due</span>
                  <span>{formatCurrency(rescheduleResult.balanceDue)}</span>
                </div>
              )}
            </div>

            {rescheduleResult.balanceDue > 0 ? (
              <div className="flex gap-3">
                <button onClick={() => setRescheduleResult(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">
                  Pay Later
                </button>
                <button onClick={() => {
                    const reservationId = rescheduleResult.reservation.reservationId
                    setRescheduleResult(null)
                    navigate('/customer/booking-payment/' + reservationId)
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm">
                  Pay Balance Now
                </button>
              </div>
            ) : (
              <button onClick={() => setRescheduleResult(null)}
                className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold text-sm">
                Done
              </button>
            )}
          </div>
        </div>
      )}

      {/* Extend Rental Modal */}
      {extendTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setExtendTarget(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center text-2xl mb-4">
              ⏳
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Extend This Rental</h3>
            <p className="text-gray-500 text-sm mb-4">
              {extendTarget.carBrand} {extendTarget.carModel}
              {extendCurrentReturnDate && <> — current return: <strong>{formatDate(extendCurrentReturnDate)}</strong></>}
            </p>

            <div className="mb-4">
              <label className="form-label">New Return Date</label>
              <input type="date" value={extendReturnDate}
                min={extendCurrentReturnDate || toLocalDateStr(new Date())}
                onChange={e => setExtendReturnDate(e.target.value)} className="form-input" />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-xs text-blue-700">
              Extra charge is calculated per extra day/night at your original booking's rate,
              and gets added to your balance due — no need to make a new booking.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setExtendTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleExtend} disabled={extending}
                className="flex-1 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold text-sm disabled:opacity-60">
                {extending ? 'Extending...' : 'Confirm Extend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setCancelTarget(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center text-2xl mb-4">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Cancel this booking?</h3>
            <p className="text-gray-500 text-sm mb-4">
              {cancelTarget.carBrand} {cancelTarget.carModel} — Booking #RES-{cancelTarget.reservationId}
            </p>

            {(() => {
              const hrs = hoursUntilPickup(cancelTarget)
              const isFree = hrs === null || hrs >= 12
              return (
                <div className={'rounded-xl p-4 mb-5 text-sm ' +
                  (isFree ? 'bg-green-50 border border-green-200 text-green-700'
                          : 'bg-red-50 border border-red-200 text-red-700')}>
                  {isFree ? (
                    <p>✅ You're cancelling <strong>12+ hours before pickup</strong> — this is a <strong>free cancellation</strong>, full refund of any amount paid.</p>
                  ) : (
                    <p>⏰ Pickup is <strong>less than 12 hours away</strong> — a <strong>₹500 cancellation fee</strong> will be deducted from your refund.</p>
                  )}
                </div>
              )
            })()}

            <div className="flex gap-3">
              <button onClick={() => setCancelTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50">
                Keep Booking
              </button>
              <button onClick={() => handleCancel(cancelTarget.reservationId)}
                disabled={cancelling === cancelTarget.reservationId}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm disabled:opacity-60">
                {cancelling === cancelTarget.reservationId ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  )
}

// ── Post-Trip Quick Poll — "Would you book again?" ─────────
function RebookPoll({ rentalId, customerId }) {
  const [answered, setAnswered] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (value) => {
    setSubmitting(true)
    try {
      await rentalService.submitRebookPoll(rentalId, customerId, value)
      setAnswered(true)
    } catch {
      toast.error('Could not save your answer.')
    } finally {
      setSubmitting(false)
    }
  }

  if (answered) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-green-600 flex items-center gap-1.5">
        ✅ Thanks for the feedback!
      </div>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-xs text-gray-500">Would you book this car again?</p>
      <div className="flex gap-2">
        <button onClick={() => submit(true)} disabled={submitting}
          className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 disabled:opacity-50">
          👍 Yes
        </button>
        <button onClick={() => submit(false)} disabled={submitting}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
          👎 No
        </button>
      </div>
    </div>
  )
}
// Polls the rental every 15s while expanded, showing the driver's last known GPS fix
// (from LiveLocationBroadcaster on the driver's side) and a simple time-elapsed / time-left readout.
function LiveTrackingPanel({ rentalId }) {
  const [rental, setRental] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchRental = () => {
      rentalService.getById(rentalId)
        .then(res => { if (!cancelled) setRental(res.data.data) })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false) })
    }
    fetchRental()
    const interval = setInterval(fetchRental, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [rentalId])

  const minutesAgo = (dateStr) => {
    if (!dateStr) return null
    return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 60000))
  }

  const elapsedSincePickup = (dateStr) => {
    if (!dateStr) return null
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
    const h = Math.floor(mins / 60), m = mins % 60
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm'
  }

  const daysUntil = (dateStr) => {
    if (!dateStr) return null
    const target = new Date(dateStr + 'T23:59:59')
    const diffDays = Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return { label: 'Overdue by ' + Math.abs(diffDays) + ' day(s)', overdue: true }
    if (diffDays === 0) return { label: 'Due today', overdue: false }
    return { label: diffDays + ' day(s) left', overdue: false }
  }

  if (loading) {
    return <div className="mt-3 h-24 bg-gray-50 rounded-xl animate-pulse" />
  }
  if (!rental) return null

  const locAgo = minutesAgo(rental.locationUpdatedAt)
  const hasLocation = rental.currentLat != null && rental.currentLng != null
  const returnInfo = daysUntil(rental.expectedReturnDate)

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-gray-400 text-[11px]">Trip Duration</p>
          <p className="font-semibold text-gray-800 text-sm">{elapsedSincePickup(rental.actualPickupDatetime) || '—'}</p>
        </div>
        <div className={'rounded-xl p-3 ' + (returnInfo?.overdue ? 'bg-red-50' : 'bg-gray-50')}>
          <p className="text-gray-400 text-[11px]">Expected Return</p>
          <p className={'font-semibold text-sm ' + (returnInfo?.overdue ? 'text-red-600' : 'text-gray-800')}>
            {returnInfo?.label || '—'}
          </p>
        </div>
      </div>

      {hasLocation ? (
        <div>
          <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: 220 }}>
            <iframe
              title="Driver location"
              width="100%" height="100%" style={{ border: 0 }}
              src={'https://www.google.com/maps?q=' + rental.currentLat + ',' + rental.currentLng + '&z=15&output=embed'}
            />
          </div>
          <p className="text-gray-400 text-[11px] mt-1.5 flex items-center justify-between">
            <span>📍 Driver's last known location</span>
            <span>{locAgo === 0 ? 'Just now' : locAgo + ' min ago'}</span>
          </p>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p className="text-yellow-700 text-xs">
            📡 Waiting for the driver's location — this updates once their phone shares GPS while driving.
          </p>
        </div>
      )}
    </div>
  )
}
