import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { carService, reservationService, locationService, customerService, engagementService, supportService, selfDriveConfigService } from '../../services/allServices'
import CustomerLayout from '../../components/layout/CustomerLayout'
import { formatCurrency, calculateDays, toLocalDateStr } from '../../utils/helpers'
import { FiCalendar, FiMapPin, FiInfo, FiCheck, FiPlus, FiX } from 'react-icons/fi'

export default function BookingPage() {
  const { carId }  = useParams()
  const { user }   = useAuth()
  const { t }      = useLanguage()
  const navigate   = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultTripType = searchParams.get('tripType') === 'OUTSTATION' ? 'OUTSTATION' : 'LOCAL'
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: { tripType: defaultTripType, tripMode: 'WITH_DRIVER', pickupTime: '' },
  })

  const [car, setCar]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [selfDriveConfig, setSelfDriveConfig] = useState(null) // null while loading/unavailable — hides the option
  const [locations, setLocations] = useState([])          // all Bihar pickup/drop points
  const [homeBase, setHomeBase] = useState('Patna')        // fetched from business settings; this is just the initial-render fallback
  const [viaStops, setViaStops] = useState([])              // extra stops for outstation trips — {id, value}[]; issue #40 fix, see addViaStop
  const [estimate, setEstimate] = useState(null)
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromoCode, setAppliedPromoCode] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [useWallet, setUseWallet] = useState(false)
  const [estimating, setEstimating] = useState(false)

  const tripType        = watch('tripType')
  const tripMode        = watch('tripMode')
  const pickupDate      = watch('pickupDate')
  const returnDate      = watch('returnDate')
  const dropLocation    = watch('dropLocation')
  const days             = calculateDays(pickupDate, returnDate)
  const isOutstation     = tripType === 'OUTSTATION'
  const nonPatnaLocations = locations.filter(l => l.name !== homeBase)

  // payableAmount is the server's own figure — promo, loyalty tier and the self-drive deposit
  // all folded in. Reading finalAmount here is what made this page disagree with Razorpay.
  const grandTotal = estimate?.payableAmount ?? estimate?.finalAmount ?? estimate?.estimatedAmount ?? 0
  const walletApplied = useWallet ? Math.min(walletBalance, grandTotal) : 0
  const payableTotal = Math.max(0, grandTotal - walletApplied)

  const today = toLocalDateStr(new Date())

  useEffect(() => {
    carService.getById(carId)
      .then(res => {
        setCar(res.data.data)
        // Self-drive option only shows up if the admin has configured (and enabled) it for
        // this car's category — a 404/disabled response just means "not offered", not an error.
        if (res.data.data?.carCategory) {
          selfDriveConfigService.getByCategory(res.data.data.carCategory)
            .then(cfgRes => setSelfDriveConfig(cfgRes.data.data?.enabled ? cfgRes.data.data : null))
            .catch(() => setSelfDriveConfig(null))
        }
      })
      .catch(() => toast.error('Car not found.'))
      .finally(() => setLoading(false))

    locationService.getBiharLocations()
      .then(res => setLocations(res.data.data || []))
      .catch(() => toast.error('Could not load pickup/drop locations.'))

    supportService.getContactInfo()
      .then(res => { if (res.data.data?.homeBaseLocation) setHomeBase(res.data.data.homeBaseLocation) })
      .catch(() => {})

    customerService.getById(user.userId)
      .then(res => setWalletBalance(res.data.data?.walletBalance || 0))
      .catch(() => {})

    // Bug fix: this form used to hold everything in plain useState/react-hook-form state with
    // nothing persisted — clicking "Continue" navigated to the payment page via router state
    // only, and pressing Back (browser back or the in-app arrow) remounted this page from
    // scratch with every field blank. The customer had to redo dates, locations, promo code,
    // via-stops, everything, even though they'd already filled it all in once. Restoring here
    // from a per-car sessionStorage draft (saved in onSubmit below, right before navigating
    // forward) means coming back to this exact page — however they got here — picks up right
    // where they left off instead of starting over.
    try {
      const raw = sessionStorage.getItem('ddt_booking_draft_' + carId)
      if (raw) {
        const draft = JSON.parse(raw)
        reset({
          tripType: draft.tripType || defaultTripType,
          tripMode: draft.tripMode || 'WITH_DRIVER',
          pickupDate: draft.pickupDate || '',
          pickupTime: draft.pickupTime || '',
          returnDate: draft.returnDate || '',
          dropLocation: draft.dropLocation || '',
          specialRequests: draft.specialRequests || '',
        })
        if (Array.isArray(draft.viaStops)) setViaStops(draft.viaStops)
        if (draft.promoCode) setPromoCode(draft.promoCode)
        if (draft.appliedPromoCode) setAppliedPromoCode(draft.appliedPromoCode)
        if (draft.useWallet) setUseWallet(true)
      }
    } catch { /* corrupt/old draft — just ignore it and start fresh */ }
  }, [carId])

  // Ask the backend for a live price whenever trip type, dates, or locations change
  useEffect(() => {
    if (!carId || !pickupDate || !returnDate) { setEstimate(null); return }
    if (isOutstation && !dropLocation) { setEstimate(null); return }

    setEstimating(true)
    const timer = setTimeout(() => {
      reservationService.estimate({
        carId: Number(carId),
        pickupDate,
        returnDate,
        tripType,
        pickupLocation: homeBase,
        dropLocation: dropLocation || null,
        viaLocations: viaStops.map(s => s.value).filter(Boolean),
        promoCode: appliedPromoCode || null,
        tripMode: tripMode || 'WITH_DRIVER',
      })
        .then(res => setEstimate(res.data.data))
        .catch(() => setEstimate(null))
        .finally(() => setEstimating(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [carId, tripType, tripMode, pickupDate, returnDate, dropLocation, viaStops, appliedPromoCode, homeBase])

  // Signals "customer is seriously considering this car" — powers the abandoned-booking
  // reminder job if they never actually complete the reservation.
  useEffect(() => {
    if (!carId || !pickupDate || !returnDate || !user?.userId) return
    const timer = setTimeout(() => {
      engagementService.recordBookingIntent(user.userId, Number(carId)).catch(() => {})
    }, 5000)
    return () => clearTimeout(timer)
  }, [carId, pickupDate, returnDate, user?.userId])

  // Issue #40 fix: viaStops used to be a plain string[], with React list keys taken from the
  // array position below. Removing/reordering a stop in the middle then shifted every
  // later stop's index, so React reconciled the wrong <select>'s state onto each row (visible as
  // a stale/glitched selection right after removing a stop). Each stop now carries its own
  // stable id, generated once when it's added and never recalculated from position — so React
  // can always match the right DOM node to the right stop, however the list is edited.
  const nextViaStopId = useRef(0)
  const addViaStop = () => setViaStops(prev => [...prev, { id: nextViaStopId.current++, value: '' }])
  const updateViaStop = (id, val) => setViaStops(prev => prev.map(s => s.id === id ? { ...s, value: val } : s))
  const removeViaStop = (id) => setViaStops(prev => prev.filter(s => s.id !== id))

  // Bug fix ("create only after payment"): this used to call reservationService.create() right
  // here — meaning the reservation was saved to the database the moment the customer clicked
  // "Continue", well before any payment happened. Now the booking form data is just carried
  // forward (via router state) to the payment page — nothing is written to the database until
  // the payment actually succeeds (see BookingPaymentPage.jsx + backend
  // PaymentServiceImpl.verifyNewBookingPayment / ReservationServiceImpl.createReservationWithPayment).
  const onSubmit = async (data) => {
    if (days < 0) { toast.error('Return date cannot be before pickup date.'); return }
    if (isOutstation && data.dropLocation === homeBase) {
      toast.error('Drop location cannot be the same as pickup (Patna) for an outstation trip.')
      return
    }
    const bookingDraft = {
      carId:          Number(carId),
      pickupDate:     data.pickupDate,
      pickupTime:     data.pickupTime,
      returnDate:     data.returnDate,
      tripType,
      pickupLocation: homeBase,
      dropLocation:   isOutstation ? data.dropLocation : homeBase,
      viaLocations:   isOutstation ? viaStops.map(s => s.value).filter(Boolean) : null,
      promoCode:      appliedPromoCode || null,
      useWalletCredits: useWallet,
      specialRequests: data.specialRequests || null,
      tripMode:       tripMode || 'WITH_DRIVER',
    }
    // Bug fix: save everything needed to restore this exact form (see the restore effect above)
    // before leaving the page — this is what makes the Back button non-destructive.
    try {
      sessionStorage.setItem('ddt_booking_draft_' + carId, JSON.stringify({
        tripType, tripMode, pickupDate: data.pickupDate, pickupTime: data.pickupTime, returnDate: data.returnDate,
        dropLocation: data.dropLocation, specialRequests: data.specialRequests,
        viaStops, promoCode, appliedPromoCode, useWallet,
      }))
    } catch { /* sessionStorage unavailable (private browsing etc.) — not worth failing the booking over */ }
    navigate('/customer/booking-payment/new', { state: { bookingDraft, carSnapshot: car } })
  }

  if (loading) return (
    <CustomerLayout>
      <div className="animate-pulse space-y-4 max-w-4xl mx-auto">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    </CustomerLayout>
  )

  if (!car) return (
    <CustomerLayout>
      <div className="text-center py-20">
        <p className="text-5xl mb-4">❌</p>
        <p className="text-xl font-bold text-gray-700">Car not found</p>
      </div>
    </CustomerLayout>
  )

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h2 className="page-title">Complete Your Booking</h2>
          <p className="text-gray-500 text-sm mt-1">Fill in the details to reserve your car</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left: Booking Form ── */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* Trip Type */}
              <div className="card">
                <h3 className="section-title">🧭 Trip Type</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className={'p-4 rounded-xl border-2 cursor-pointer transition-all ' +
                    (tripType === 'LOCAL' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300')}>
                    <input type="radio" value="LOCAL" {...register('tripType')} className="hidden" />
                    <p className="font-semibold text-sm text-gray-800">🏙️ {t('local')}</p>
                    <p className="text-gray-500 text-xs mt-1">Flat package rate — {formatCurrency(car.rentPerDay)}/day</p>
                  </label>
                  <label className={'p-4 rounded-xl border-2 cursor-pointer transition-all ' +
                    (tripType === 'OUTSTATION' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300')}>
                    <input type="radio" value="OUTSTATION" {...register('tripType')} className="hidden" />
                    <p className="font-semibold text-sm text-gray-800">🛣️ {t('outstation')}</p>
                    <p className="text-gray-500 text-xs mt-1">Priced by round-trip distance + night charges</p>
                  </label>
                </div>
              </div>

              {/* Trip Mode — Self-Drive (only shown if admin has configured/enabled it for this car's category) */}
              {selfDriveConfig && (
                <div className="card">
                  <h3 className="section-title">🚘 Who's Driving?</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={'p-4 rounded-xl border-2 cursor-pointer transition-all ' +
                      (tripMode === 'WITH_DRIVER' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300')}>
                      <input type="radio" value="WITH_DRIVER" {...register('tripMode')} className="hidden" />
                      <p className="font-semibold text-sm text-gray-800">🧑‍✈️ With Driver</p>
                      <p className="text-gray-500 text-xs mt-1">We provide a driver for your trip</p>
                    </label>
                    <label className={'p-4 rounded-xl border-2 cursor-pointer transition-all ' +
                      (tripMode === 'SELF_DRIVE' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300')}>
                      <input type="radio" value="SELF_DRIVE" {...register('tripMode')} className="hidden" />
                      <p className="font-semibold text-sm text-gray-800">🚗 Self-Drive</p>
                      <p className="text-gray-500 text-xs mt-1">You drive — refundable deposit applies</p>
                    </label>
                  </div>
                  {tripMode === 'SELF_DRIVE' && (
                    <div className="mt-3 p-3 bg-orange-50 rounded-xl text-xs text-gray-600 space-y-1">
                      <p>• Refundable security deposit: <span className="font-semibold text-gray-800">{formatCurrency(selfDriveConfig.securityDeposit)}</span> (collected separately, refunded after a clean return)</p>
                      <p>• Free km included: <span className="font-semibold text-gray-800">{selfDriveConfig.freeKmPerDay} km/day</span></p>
                      <p>• A valid driving license will be verified before pickup.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Dates & Time */}
              <div className="card">
                <h3 className="section-title flex items-center gap-2">
                  <FiCalendar className="text-orange-500" /> Pickup & Return
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Pickup Date *</label>
                    <input type="date" {...register('pickupDate', { required: 'Pickup date required' })}
                      className="form-input" min={today} />
                    {errors.pickupDate && <p className="form-error">{errors.pickupDate.message}</p>}
                  </div>
                  <div>
                    <label className="form-label">Pickup Time *</label>
                    <input type="time" {...register('pickupTime', {
                        required: 'Pickup time required',
                        // Bug fix: previously any time (including one already in the past today)
                        // was accepted — a customer could pick "today" + a time from 3 hours ago.
                        validate: (value) => {
                          if (pickupDate !== today) return true // only matters for a same-day pickup
                          const now = new Date()
                          const minTime = new Date(now.getTime() + 30 * 60 * 1000) // 30-min buffer to process the booking
                          const [h, m] = (value || '').split(':').map(Number)
                          const selected = new Date()
                          selected.setHours(h || 0, m || 0, 0, 0)
                          return selected >= minTime || 'Pickup time must be at least 30 minutes from now'
                        },
                      })}
                      className="form-input" />
                    {errors.pickupTime && <p className="form-error">{errors.pickupTime.message}</p>}
                  </div>
                  <div>
                    <label className="form-label">Return Date *</label>
                    <input type="date" {...register('returnDate', { required: 'Return date required' })}
                      className="form-input" min={pickupDate || today} />
                    {errors.returnDate && <p className="form-error">{errors.returnDate.message}</p>}
                  </div>
                </div>

                {pickupDate && returnDate && days >= 0 && (
                  <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2">
                    <FiInfo className="text-orange-500 flex-shrink-0" size={16} />
                    <p className="text-orange-700 text-sm">
                      {days === 0
                        ? <><strong>Same-day return</strong> — no night charges</>
                        : <><strong>{days} night{days > 1 ? 's' : ''}</strong> away{isOutstation ? ' — night charges apply' : ''}</>}
                    </p>
                  </div>
                )}
              </div>

              {/* Locations (outstation only) */}
              {isOutstation && (
                <div className="card">
                  <h3 className="section-title flex items-center gap-2">
                    <FiMapPin className="text-orange-500" /> Route (Bihar-wide)
                  </h3>
                  <p className="text-xs text-gray-500 -mt-2 mb-3">
                    Price is calculated on the full round trip: Patna → stops → drop → back to Patna.
                  </p>
                  <div className="space-y-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2">
                      <FiMapPin className="text-gray-500 flex-shrink-0" size={16} />
                      <p className="text-gray-700 text-sm">
                        <strong>Pickup: Patna</strong> — our home base (fixed)
                      </p>
                    </div>

                    {/* Via stops */}
                    {viaStops.map((stop, idx) => (
                      <div key={stop.id} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="form-label">Stop {idx + 1}</label>
                          <select value={stop.value} onChange={e => updateViaStop(stop.id, e.target.value)} className="form-select">
                            <option value="">Select a stop</option>
                            {nonPatnaLocations.map(l => (
                              <option key={l.name} value={l.name}>{l.name} ({l.district})</option>
                            ))}
                          </select>
                        </div>
                        <button type="button" onClick={() => removeViaStop(stop.id)}
                          className="p-3 text-red-400 hover:bg-red-50 rounded-lg"><FiX size={16} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={addViaStop}
                      className="flex items-center gap-1.5 text-xs text-orange-500 border border-orange-200 hover:bg-orange-50 px-3 py-2 rounded-lg">
                      <FiPlus size={12} /> Add another stop
                    </button>

                    <div>
                      <label className="form-label">Drop Location *</label>
                      <select {...register('dropLocation', { required: isOutstation && 'Drop location required' })}
                        className="form-select">
                        <option value="">Select drop location</option>
                        {nonPatnaLocations.map(l => (
                          <option key={l.name} value={l.name}>{l.name} ({l.district})</option>
                        ))}
                      </select>
                      {errors.dropLocation && <p className="form-error">{errors.dropLocation.message}</p>}
                    </div>

                    {estimate?.distanceKm != null && (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2">
                        <FiMapPin className="text-orange-500 flex-shrink-0" size={16} />
                        <p className="text-orange-700 text-sm">
                          Round-trip distance: <strong>{estimate.distanceKm} km</strong>
                          {' '}(₹{car.ratePerKm}/km)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Promo Code */}
              <div className="card">
                <h3 className="section-title">🎟️ Promo Code (Optional)</h3>
                <div className="flex gap-2">
                  <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter promo code" className="form-input flex-1" />
                  <button type="button"
                    onClick={() => setAppliedPromoCode(promoCode.trim())}
                    disabled={!promoCode.trim()}
                    className="btn-secondary px-5 disabled:opacity-50">
                    Apply
                  </button>
                </div>
                {appliedPromoCode && estimate?.promoCode === appliedPromoCode && (
                  <p className="text-green-600 text-xs mt-2 flex items-center gap-1">
                    ✅ "{appliedPromoCode}" applied — you saved {formatCurrency(estimate.discountAmount)}!
                  </p>
                )}
                {appliedPromoCode && estimate && estimate.promoCode !== appliedPromoCode && (
                  <p className="text-red-500 text-xs mt-2">❌ Invalid or expired promo code.</p>
                )}
              </div>

              {/* Wallet Credits */}
              {walletBalance > 0 && (
                <div className="card">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={useWallet} onChange={e => setUseWallet(e.target.checked)}
                      className="w-5 h-5 accent-orange-500" />
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">🎁 Use Wallet Balance</p>
                      <p className="text-gray-500 text-xs">
                        You have {formatCurrency(walletBalance)} available — apply it to this booking.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Special Requests */}
              <div className="card">
                <h3 className="section-title">📝 Special Requests (Optional)</h3>
                <textarea {...register('specialRequests')} rows={3}
                  className="form-input resize-none"
                  placeholder="Any special requirements? e.g. child seat, GPS, early pickup..." />
              </div>

              {/* Terms */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <FiInfo className="text-blue-500 flex-shrink-0 mt-0.5" size={16} />
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>• You'll be taken to payment next — pay in full or a minimum ₹1000 deposit to confirm.</p>
                    <p>• You will need to present your Driving License & Aadhar at pickup.</p>
                    <p>• Free cancellation up to 12 hours before pickup time; after that a min. ₹500 fee applies.</p>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={days < 0}
                className="btn-primary w-full py-3.5 text-base disabled:opacity-60 disabled:cursor-not-allowed">
                🚗 {t('continueToPayment')}
              </button>
            </form>
          </div>

          {/* ── Right: Summary Card ── */}
          <div>
            <div className="card sticky top-24 space-y-4">
              <h3 className="font-bold text-gray-800">Booking Summary</h3>

              {/* Car */}
              <div className="bg-gray-50 rounded-xl p-3 flex gap-3 items-center">
                <div className="w-14 h-14 bg-gray-200 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  🚗
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{car.brand} {car.model}</p>
                  <p className="text-gray-400 text-xs">{car.year} • {car.carCategory?.replace('_',' ')}</p>
                  <p className="text-gray-400 text-xs">{car.fuelType} • {car.transmissionType}</p>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 text-sm">
                {isOutstation ? (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Round-trip distance</span>
                      <span className="font-medium">{estimate?.distanceKm != null ? estimate.distanceKm + ' km' : '—'}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Base fare</span>
                      <span className="font-medium">{estimate ? formatCurrency(estimate.baseFare) : '—'}</span>
                    </div>
                    {estimate?.nights > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Night charges ({estimate.nights} night{estimate.nights > 1 ? 's' : ''})</span>
                        <span className="font-medium">{formatCurrency(estimate.nightCharges)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between text-gray-600">
                    <span>Local package ({Math.max(days, 1)} day{Math.max(days,1) > 1 ? 's' : ''})</span>
                    <span className="font-medium">{formatCurrency(car.rentPerDay)}/day</span>
                  </div>
                )}
                {estimate?.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Promo Discount ({estimate.promoCode})</span>
                    <span className="font-medium">-{formatCurrency(estimate.discountAmount)}</span>
                  </div>
                )}
                {estimate?.loyaltyDiscountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Loyalty Discount ({estimate.loyaltyDiscountPct}%)</span>
                    <span className="font-medium">-{formatCurrency(estimate.loyaltyDiscountAmount)}</span>
                  </div>
                )}
                {walletApplied > 0 && (
                  <div className="flex justify-between text-purple-600">
                    <span>Wallet Credit Applied</span>
                    <span className="font-medium">-{formatCurrency(walletApplied)}</span>
                  </div>
                )}
                {tripMode === 'SELF_DRIVE' && estimate?.selfDriveDeposit > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Refundable Deposit (self-drive)</span>
                    <span className="font-medium">{formatCurrency(estimate.selfDriveDeposit)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-800 border-t border-gray-200 pt-2">
                  <span>{walletApplied > 0 ? 'Payable Amount' : t('estimatedTotal')}</span>
                  <span className="text-orange-500 text-lg">
                    {estimating ? 'Calculating…' : (estimate ? formatCurrency(payableTotal) : '—')}
                  </span>
                </div>
                <p className="text-gray-400 text-xs text-center">
                  {isOutstation
                    ? '*Round trip: pickup → stops → drop → back to pickup'
                    : '*Flat local package for staying within your home city'}
                </p>
              </div>

              {/* Checklist */}
              <div className="space-y-2 border-t border-gray-100 pt-3">
                {['Valid Driving License', 'Aadhar Card', 'Min ₹1000 deposit to confirm', 'Fuel Policy: Full to Full'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs text-gray-600">
                    <FiCheck className="text-green-500 flex-shrink-0" size={12} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </CustomerLayout>
  )
}
