import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { reservationService, paymentService } from '../../services/allServices'
import CustomerLayout from '../../components/layout/CustomerLayout'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { FiCreditCard, FiCheck, FiShield, FiInfo } from 'react-icons/fi'

const MIN_DEPOSIT = 1000

export default function BookingPaymentPage() {
  const { reservationId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  // Bug fix ("create only after payment"): reservationId === 'new' means this is a brand-new
  // booking that hasn't been saved to the database at all yet — carId/dates/etc travel here via
  // router state (bookingDraft) from BookingPage.jsx instead of an existing reservation record.
  const isNewBooking = reservationId === 'new'
  const bookingDraft = location.state?.bookingDraft
  const carSnapshot = location.state?.carSnapshot

  const [reservation, setReservation] = useState(null)
  const [estimate, setEstimate] = useState(null) // used only for isNewBooking
  const [loading, setLoading]     = useState(true)
  const [processing, setProcessing] = useState(false)
  const [payType, setPayType]     = useState('FULL') // 'FULL' | 'DEPOSIT'
  const [depositAmount, setDepositAmount] = useState(MIN_DEPOSIT)

  useEffect(() => {
    if (isNewBooking) {
      if (!bookingDraft) {
        toast.error('Booking details were lost — please start again.')
        navigate('/customer/browse-cars')
        return
      }
      reservationService.estimate(bookingDraft)
        .then(res => setEstimate(res.data.data))
        .catch(() => toast.error('Could not calculate the price. Please go back and try again.'))
        .finally(() => setLoading(false))
    } else {
      reservationService.getById(reservationId)
        .then(res => setReservation(res.data.data))
        .catch(() => toast.error('Reservation not found.'))
        .finally(() => setLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId])

  // payableAmount already includes promo + loyalty + the self-drive deposit, exactly as the
  // Razorpay order is computed server-side. estimatedAmount is the pre-discount fare, which is
  // why this screen used to show one figure and the checkout sheet another.
  const balanceDue = isNewBooking
    ? (estimate?.payableAmount ?? estimate?.estimatedAmount ?? 0)
    : (reservation?.balanceDue ?? reservation?.estimatedAmount ?? 0)

  const handlePay = async () => {
    if (payType === 'DEPOSIT' && depositAmount < MIN_DEPOSIT) {
      toast.error(`Minimum deposit is ${formatCurrency(MIN_DEPOSIT)}.`)
      return
    }
    setProcessing(true)
    try {
      // Step 1: Create a Razorpay order for the amount being paid now
      const orderRes = isNewBooking
        ? await paymentService.createNewBookingOrder({
            booking: bookingDraft,
            paymentType: payType,
            amount: payType === 'DEPOSIT' ? Number(depositAmount) : null,
          })
        : await paymentService.createReservationOrder({
            reservationId: Number(reservationId),
            paymentType: payType,
            amount: payType === 'DEPOSIT' ? Number(depositAmount) : null,
          })
      const orderData = orderRes.data.data

      // Bug fix: when the wallet balance covers the entire cost, the backend confirms the
      // booking directly and skips Razorpay entirely (a ₹0 order gets rejected by Razorpay's own
      // minimum-amount rule — that's exactly the "Order amount less than minimum amount allowed"
      // error, and it's also why a wallet balance that fully covered a booking couldn't actually
      // be spent). Nothing to check out here — the booking is already confirmed.
      if (orderData.walletOnly) {
        toast.success('Paid fully from wallet — booking confirmed 🎉')
        if (isNewBooking && bookingDraft?.carId) {
          try { sessionStorage.removeItem('ddt_booking_draft_' + bookingDraft.carId) } catch { /* ignore */ }
        }
        navigate('/customer/bookings')
        setProcessing(false)
        return
      }

      // Step 2: Open Razorpay's checkout — customer picks UPI/Card/NetBanking/Wallet here
      const options = {
        key:          orderData.keyId,
        amount:       Math.round(orderData.amount * 100),
        currency:     orderData.currency || 'INR',
        name:         'RentMyRide',
        description:  (isNewBooking ? 'New booking' : 'Booking #RES-' + reservationId) + (payType === 'DEPOSIT' ? ' (Deposit)' : ' (Full Payment)'),
        order_id:     orderData.orderId,
        prefill: {
          name:    orderData.customerName,
          email:   orderData.customerEmail,
          contact: orderData.customerContact,
        },
        theme: { color: '#FF6B00' },
        handler: async (response) => {
          // Step 3: Verify the payment signature — the reservation is only ever CREATED here,
          // after Razorpay confirms the payment actually succeeded (isNewBooking case), or its
          // balance is updated (existing-reservation case).
          try {
            const verifyRes = isNewBooking
              ? await paymentService.verifyNewBookingPayment({
                  booking: bookingDraft,
                  paymentType: payType,
                  amount: orderData.amount,
                  razorpayOrderId:   response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                })
              : await paymentService.verifyReservationPayment({
                  reservationId: Number(reservationId),
                  paymentType: payType,
                  amount: orderData.amount,
                  razorpayOrderId:   response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                })
            if (verifyRes.data.success) {
              toast.success(payType === 'FULL' ? 'Payment successful! Booking confirmed 🎉' : 'Deposit paid! Booking confirmed 🎉')
              // Bug fix: clear the saved draft (see BookingPage.jsx) now that the booking is
              // actually confirmed — otherwise coming back to book this same car again later
              // would resurrect these old dates/promo code instead of starting fresh.
              if (isNewBooking && bookingDraft?.carId) {
                try { sessionStorage.removeItem('ddt_booking_draft_' + bookingDraft.carId) } catch { /* ignore */ }
              }
              navigate('/customer/bookings')
            } else {
              toast.error(verifyRes.data.message || 'Payment verification failed.')
            }
          } catch (err) {
            toast.error(err.response?.data?.message || 'Payment verification error.')
          } finally {
            setProcessing(false)
          }
        },
        modal: {
          ondismiss: () => { toast.error('Payment cancelled.'); setProcessing(false) }
        }
      }

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options)
        rzp.open()
      } else {
        toast.error('Payment gateway not loaded. Check your internet connection.')
        setProcessing(false)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment initiation failed.')
      setProcessing(false)
    }
  }

  if (loading) return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    </CustomerLayout>
  )

  if (!isNewBooking && !reservation) return (
    <CustomerLayout>
      <div className="text-center py-20">
        <p className="text-5xl mb-4">❌</p>
        <p className="text-xl font-bold text-gray-700">Reservation not found</p>
      </div>
    </CustomerLayout>
  )
  if (isNewBooking && !estimate) return (
    <CustomerLayout>
      <div className="text-center py-20">
        <p className="text-5xl mb-4">❌</p>
        <p className="text-xl font-bold text-gray-700">Could not load booking details</p>
      </div>
    </CustomerLayout>
  )

  // Normalizes field access across both flows (a saved Reservation vs the in-memory bookingDraft/estimate)
  const view = isNewBooking
    ? {
        carBrand: carSnapshot?.brand, carModel: carSnapshot?.model, carRegistrationNumber: carSnapshot?.registrationNumber,
        tripType: bookingDraft.tripType, pickupDate: bookingDraft.pickupDate,
        pickupLocation: bookingDraft.pickupLocation, dropLocation: bookingDraft.dropLocation,
        totalDays: estimate.totalDays, distanceKm: estimate.distanceKm, baseFare: estimate.baseFare,
        nightCharges: estimate.nightCharges, nights: estimate.nights,
        estimatedAmount: estimate.payableAmount ?? estimate.estimatedAmount,
        selfDriveDeposit: estimate.selfDriveDeposit,
        loyaltyDiscountPct: estimate.loyaltyDiscountPct, loyaltyDiscountAmount: estimate.loyaltyDiscountAmount,
        amountPaid: 0,
      }
    : reservation

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="page-title">Confirm Your Booking</h2>
          <p className="text-gray-500 text-sm mt-1">
            {isNewBooking ? 'Complete payment to create your booking' : 'Booking #RES-' + reservation.reservationId}
          </p>
        </div>

        <div className="space-y-5">

          {/* Booking Summary */}
          <div className="card">
            <h3 className="section-title">🚗 Booking Details</h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="font-bold text-gray-800">{view.carBrand} {view.carModel}</p>
              <p className="text-gray-400 text-xs mt-0.5">{view.carRegistrationNumber}</p>
              <div className="grid grid-cols-2 gap-3 text-xs mt-3">
                <div className="bg-white rounded-lg p-2.5">
                  <p className="text-gray-400">Trip Type</p>
                  <p className="font-semibold text-gray-700 mt-0.5">
                    {view.tripType === 'OUTSTATION' ? '🛣️ Outstation' : '🏙️ Local'}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2.5">
                  <p className="text-gray-400">Pickup</p>
                  <p className="font-semibold text-gray-700 mt-0.5">{formatDate(view.pickupDate)}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5">
                  <p className="text-gray-400">Route</p>
                  <p className="font-semibold text-gray-700 mt-0.5">{view.pickupLocation} → {view.dropLocation}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5">
                  <p className="text-gray-400">Duration</p>
                  <p className="font-semibold text-gray-700 mt-0.5">
                    {view.totalDays > 0 ? view.totalDays + ' day(s)' : 'Same-day'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bill Summary */}
          <div className="card">
            <h3 className="section-title">🧾 Bill Summary</h3>
            <div className="space-y-2 text-sm">
              {view.tripType === 'OUTSTATION' ? (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Round-trip distance</span>
                    <span className="font-medium">{view.distanceKm} km</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Base fare</span>
                    <span className="font-medium">{formatCurrency(view.baseFare)}</span>
                  </div>
                  {view.nightCharges > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Night charges ({view.nights} night{view.nights > 1 ? 's' : ''})</span>
                      <span className="font-medium">{formatCurrency(view.nightCharges)}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between text-gray-600">
                  <span>Local package ({Math.max(view.totalDays, 1)} day)</span>
                  <span className="font-medium">{formatCurrency(view.baseFare)}</span>
                </div>
              )}
              {view.loyaltyDiscountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Loyalty Discount ({view.loyaltyDiscountPct}%)</span>
                  <span className="font-medium">-{formatCurrency(view.loyaltyDiscountAmount)}</span>
                </div>
              )}
              {view.selfDriveDeposit > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>Security Deposit (refundable)</span>
                  <span className="font-medium">{formatCurrency(view.selfDriveDeposit)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-800 border-t border-gray-200 pt-2">
                <span>Total Amount</span>
                <span className="text-orange-500 text-lg">{formatCurrency(view.estimatedAmount)}</span>
              </div>
              {view.amountPaid > 0 && (
                <div className="flex justify-between text-green-600 text-xs">
                  <span>Already paid</span>
                  <span>{formatCurrency(view.amountPaid)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-800">
                <span>Balance Due</span>
                <span>{formatCurrency(balanceDue)}</span>
              </div>
            </div>
          </div>

          {/* Payment Option: Full vs Deposit */}
          <div className="card">
            <h3 className="section-title flex items-center gap-2">
              <FiCreditCard className="text-orange-500" /> How would you like to pay?
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button type="button" onClick={() => setPayType('FULL')}
                className={'p-4 rounded-xl border-2 text-left transition-all ' +
                  (payType === 'FULL' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300')}>
                <p className="font-semibold text-sm text-gray-800">Pay in Full</p>
                <p className="text-gray-500 text-xs mt-1">{formatCurrency(balanceDue)}</p>
                {payType === 'FULL' && <FiCheck className="text-orange-500 mt-1" size={14} />}
              </button>
              <button type="button" onClick={() => setPayType('DEPOSIT')}
                className={'p-4 rounded-xl border-2 text-left transition-all ' +
                  (payType === 'DEPOSIT' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300')}>
                <p className="font-semibold text-sm text-gray-800">Pay Deposit</p>
                <p className="text-gray-500 text-xs mt-1">Min. {formatCurrency(MIN_DEPOSIT)}</p>
                {payType === 'DEPOSIT' && <FiCheck className="text-orange-500 mt-1" size={14} />}
              </button>
            </div>

            {payType === 'DEPOSIT' && (
              <div className="mb-4">
                <label className="form-label">Deposit Amount (₹)</label>
                <input type="number" min={MIN_DEPOSIT} max={balanceDue} value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  className="form-input" />
                <p className="text-gray-400 text-xs mt-1">
                  Remaining {formatCurrency(Math.max(0, balanceDue - depositAmount))} will be due at pickup.
                </p>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
              <FiCreditCard className="text-gray-400 flex-shrink-0" size={16} />
              <p className="text-gray-500 text-xs">
                You'll choose UPI, Card, Net Banking, or Wallet on the next screen.
              </p>
            </div>
          </div>

          {/* Cancellation policy note */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
            <FiInfo className="text-blue-500 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-blue-700 text-xs leading-relaxed">
              Free cancellation up to 12 hours before pickup. Cancelling within 12 hours of pickup
              deducts a minimum ₹500 fee from your refund.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
            <FiShield className="text-green-500 flex-shrink-0" size={20} />
            <p className="text-green-700 text-xs">Your payment is secure and encrypted.</p>
          </div>

          <button onClick={handlePay} disabled={processing}
            className="btn-primary w-full py-4 text-lg disabled:opacity-60 disabled:cursor-not-allowed">
            {processing ? '⏳ Processing...' :
              `Pay ${formatCurrency(payType === 'FULL' ? balanceDue : depositAmount)} & Confirm Booking`}
          </button>

        </div>
      </div>
    </CustomerLayout>
  )
}
