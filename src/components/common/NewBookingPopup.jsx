import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/helpers'

// Shown to the admin the moment a genuinely NEW booking notification is seen, the same way
// DueAmountPopup nags a customer about an unpaid balance — a bell icon with a badge is easy to
// miss during a busy session, so a fresh booking gets a modal, not just a quiet count bump.
// Unlike DueAmountPopup's once-per-session flag, this pops for EVERY new booking notification —
// AdminLayout tracks which notification IDs have already been shown (sessionStorage) so a page
// refresh doesn't re-show old ones, but a second new booking arriving later still gets its own.
export default function NewBookingPopup({ notification, onClose }) {
  if (!notification) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
        <div className="text-4xl mb-3">📅</div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">New Booking Received</h2>
        <p className="text-sm text-gray-600 mb-1">{notification.message}</p>
        <p className="text-xs text-gray-400 mb-5">{formatDate(notification.createdAt)}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">
            Later
          </button>
          <Link to="/admin/reservations"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm">
            View Booking
          </Link>
        </div>
      </div>
    </div>
  )
}
