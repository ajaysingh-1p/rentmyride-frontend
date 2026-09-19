import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiKey, FiClock, FiActivity, FiShield, FiRefreshCw } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { selfDriveHandoverService } from '../services/allServices'
import { formatCurrency, formatDate } from '../utils/helpers'

// Self-drive trip panel (customer side).
//
// A self-drive booking has no driver, so the customer themselves drives the trip forward —
// but they can't just flip their own booking to "started". They tap the button here, get a
// 6-digit code on screen, and read it out to the staff at the counter, who enters it on the
// admin handover form along with the odometer reading. Only then does the rental actually
// start (or close). The code is what proves the right person is physically at the counter.
//
// Drop this into MyBookings.jsx above the tabs:
//   <SelfDriveTripPanel reservations={reservations} onChanged={fetchData} />
export default function SelfDriveTripPanel({ reservations = [], onChanged }) {
  const { user } = useAuth()
  const [activeTrip, setActiveTrip] = useState(null)
  const [code, setCode] = useState(null)        // { otp, expiresInMinutes, stage, instruction }
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [busy, setBusy] = useState(false)

  const loadActiveTrip = useCallback(() => {
    if (!user?.userId) return
    selfDriveHandoverService.getActiveTrip(user.userId)
      .then(res => setActiveTrip(res.data.data || null))
      .catch(() => setActiveTrip(null))
  }, [user?.userId])

  useEffect(() => { loadActiveTrip() }, [loadActiveTrip])

  // Countdown so the customer can see the code is about to die rather than being told
  // "invalid OTP" at the counter with no explanation.
  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [secondsLeft])

  useEffect(() => {
    if (secondsLeft === 0 && code) setCode(null)
  }, [secondsLeft, code])

  // While a code is live, poll: the moment the staff submits the handover, this panel should
  // flip to the active-trip card on its own instead of the customer wondering if it worked.
  useEffect(() => {
    if (!code) return
    const poll = setInterval(() => {
      loadActiveTrip()
      if (onChanged) onChanged()
    }, 5000)
    return () => clearInterval(poll)
  }, [code, loadActiveTrip, onChanged])

  useEffect(() => {
    if (code?.stage === 'PICKUP' && activeTrip) {
      setCode(null)
      toast.success('Trip started — drive safe! 🚗')
    }
  }, [activeTrip, code?.stage])

  const showCode = (data) => {
    setCode(data)
    setSecondsLeft((data.expiresInMinutes || 5) * 60)
  }

  const requestPickupOtp = async (reservationId) => {
    setBusy(true)
    try {
      const res = await selfDriveHandoverService.requestPickupOtp(reservationId)
      showCode(res.data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not generate the pickup code.')
    } finally { setBusy(false) }
  }

  const requestReturnOtp = async (rentalId) => {
    setBusy(true)
    try {
      const res = await selfDriveHandoverService.requestReturnOtp(rentalId)
      showCode(res.data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not generate the return code.')
    } finally { setBusy(false) }
  }

  // Self-drive bookings that are confirmed, paid, pickup date has arrived, not yet started.
  const today = new Date().toISOString().slice(0, 10)
  const startable = reservations.filter(r =>
    r.tripMode === 'SELF_DRIVE' &&
    r.reservationStatus === 'CONFIRMED' &&
    r.pickupDate <= today &&
    (r.balanceDue == null || r.balanceDue <= 0.01)
  )

  const pendingPayment = reservations.filter(r =>
    r.tripMode === 'SELF_DRIVE' &&
    r.reservationStatus === 'CONFIRMED' &&
    r.pickupDate <= today &&
    r.balanceDue > 0.01
  )

  if (!activeTrip && startable.length === 0 && pendingPayment.length === 0 && !code) return null

  const mmss = String(Math.floor(secondsLeft / 60)).padStart(2, '0') + ':' +
               String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="mb-6 space-y-4">

      {/* ── The live code ── */}
      {code && (
        <div className="bg-white rounded-2xl border-2 border-orange-400 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FiKey className="text-orange-500" />
            <h3 className="font-bold text-gray-800">
              {code.stage === 'PICKUP' ? 'Pickup Code' : 'Return Code'}
            </h3>
            <span className="ml-auto text-xs font-semibold text-gray-500 flex items-center gap-1">
              <FiClock /> {mmss}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-4">{code.instruction}</p>
          <div className="flex gap-2 justify-center mb-3">
            {code.otp.split('').map((digit, i) => (
              <span key={'code-' + i}
                className="w-12 h-14 flex items-center justify-center rounded-xl bg-orange-50
                           border-2 border-orange-200 text-2xl font-bold text-orange-600">
                {digit}
              </span>
            ))}
          </div>
          <p className="text-xs text-center text-gray-400">
            Don't share this code with anyone except RentMyRide staff at the counter.
          </p>
        </div>
      )}

      {/* ── Car is out with the customer right now ── */}
      {activeTrip && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <span className="inline-block text-[11px] font-bold tracking-wide px-2 py-0.5 rounded
                               bg-green-100 text-green-700 mb-1">SELF-DRIVE · ON TRIP</span>
              <h3 className="font-bold text-gray-800 text-lg">
                {activeTrip.carBrand} {activeTrip.carModel}
              </h3>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {activeTrip.carRegistrationNumber}
              </p>
            </div>
            <button onClick={loadActiveTrip}
              className="text-gray-400 hover:text-orange-500 p-1" title="Refresh">
              <FiRefreshCw />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Stat icon={FiActivity} label="Included km"
                  value={Math.round(activeTrip.freeKmAllowance) + ' km'}
                  note={activeTrip.freeKmPerDay + ' km/day × ' + activeTrip.totalDays} />
            <Stat icon={FiActivity} label="Beyond that"
                  value={formatCurrency(activeTrip.overageRatePerKm) + '/km'} />
            <Stat icon={FiClock} label="Return by"
                  value={formatDate(activeTrip.scheduledReturnDatetime)}
                  note={formatCurrency(activeTrip.lateReturnPenaltyPerHour) + '/hr if late'} />
            <Stat icon={FiShield} label="Deposit held"
                  value={formatCurrency(activeTrip.depositHeld)} note="refundable" />
          </div>

          <div className="text-xs text-gray-500 mb-4">
            Odometer at pickup: <strong className="text-gray-700">{activeTrip.odometerAtPickup} km</strong>
            {' · '}Started {formatDate(activeTrip.actualPickupDatetime)}
          </div>

          <button onClick={() => requestReturnOtp(activeTrip.rentalId)} disabled={busy}
            className="btn-primary w-full py-3 disabled:opacity-60">
            {busy ? '⏳ Generating...' : 'Return Car — Get Code'}
          </button>
          <p className="text-[11px] text-gray-400 mt-2 text-center">
            Bring the car back to the pickup point, then show this code to the staff.
            Your deposit is settled on the spot.
          </p>
        </div>
      )}

      {/* ── Ready to start ── */}
      {!activeTrip && startable.map(r => (
        <div key={r.reservationId} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <span className="inline-block text-[11px] font-bold tracking-wide px-2 py-0.5 rounded
                           bg-orange-100 text-orange-700 mb-2">SELF-DRIVE · READY</span>
          <h3 className="font-bold text-gray-800 text-lg mb-1">{r.carBrand} {r.carModel}</h3>
          <p className="text-sm text-gray-500 mb-4">
            Pickup {formatDate(r.pickupDate)} · {r.pickupLocation}
          </p>
          <button onClick={() => requestPickupOtp(r.reservationId)} disabled={busy}
            className="btn-primary w-full py-3 disabled:opacity-60">
            {busy ? '⏳ Generating...' : 'Start Trip — Get Pickup Code'}
          </button>
          <p className="text-[11px] text-gray-400 mt-2 text-center">
            Carry your original driving licence. Staff will note the odometer reading before handing over the keys.
          </p>
        </div>
      ))}

      {/* ── Paid only partially — self-drive needs the deposit collected up front ── */}
      {!activeTrip && pendingPayment.map(r => (
        <div key={'due-' + r.reservationId}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-sm text-amber-800">
            <strong>{r.carBrand} {r.carModel}</strong> is ready for self-drive pickup, but
            {' '}{formatCurrency(r.balanceDue)} is still due. Self-drive bookings need the fare and the
            refundable security deposit paid in full before the keys are handed over.
          </p>
        </div>
      ))}
    </div>
  )
}

function Stat({ icon: Icon, label, value, note }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-[11px] text-gray-500 flex items-center gap-1 mb-0.5">
        <Icon className="text-xs" /> {label}
      </p>
      <p className="font-bold text-gray-800 text-sm">{value}</p>
      {note && <p className="text-[10px] text-gray-400 mt-0.5">{note}</p>}
    </div>
  )
}
