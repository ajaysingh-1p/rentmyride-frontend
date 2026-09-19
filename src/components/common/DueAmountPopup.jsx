import { Link } from 'react-router-dom'
import { formatCurrency } from '../../utils/helpers'

// Shown once per dashboard visit when the customer has an unpaid balance — either an initial
// booking still awaiting payment, or a completed rental where extra km/damage charges pushed
// the final bill above what was pre-paid. Gives them a direct "Pay Now" path instead of leaving
// them to stumble onto the due amount buried in My Bookings.
export default function DueAmountPopup({ reservation, onClose }) {
  if (!reservation) return null
  const due = (reservation.estimatedAmount || 0) - (reservation.amountPaid || 0)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
        <div className="text-4xl mb-3">💳</div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">Payment Due</h2>
        <p className="text-sm text-gray-500 mb-4">
          {reservation.reservationStatus === 'COMPLETED'
            ? 'Your rental is completed. You still have a balance to clear:'
            : 'Your booking is awaiting payment to be confirmed:'}
        </p>
        <p className="text-2xl font-bold text-orange-500 mb-1">{formatCurrency(due)}</p>
        <p className="text-xs text-gray-400 mb-5">Booking #RES-{reservation.reservationId}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">
            Later
          </button>
          <Link to={'/customer/booking-payment/' + reservation.reservationId}
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm">
            Pay Now
          </Link>
        </div>
      </div>
    </div>
  )
}
