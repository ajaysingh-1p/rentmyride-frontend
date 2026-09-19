import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { AdminRoute, CustomerRoute, DriverRoute } from './routes/ProtectedRoute'
import ErrorBoundary from './components/common/ErrorBoundary'

// Public
import Home from './pages/public/Home'

// Auth
import UnifiedLogin from './pages/auth/UnifiedLogin'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'

// Customer
import CustomerDashboard from './pages/customer/CustomerDashboard'
import BrowseCars from './pages/customer/BrowseCars'
import CarDetail from './pages/customer/CarDetail'
import BookingPage from './pages/customer/BookingPage'
import BookingPaymentPage from './pages/customer/BookingPaymentPage'
import MyBookings from './pages/customer/MyBookings'
import MyWishlist from './pages/customer/MyWishlist'
import MyReferrals from './pages/customer/MyReferrals'
import CustomerSupport from './pages/customer/CustomerSupport'
import CustomerProfile from './pages/customer/CustomerProfile'
import FeedbackPage from './pages/customer/FeedbackPage'
import InvoicePage from './pages/customer/InvoicePage'

// Admin
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import ManageCars from './pages/admin/ManageCars'
import ManageCustomers from './pages/admin/ManageCustomers'
import ManageDrivers from './pages/admin/ManageDrivers'
import ManageReservations from './pages/admin/ManageReservations'
import ManageRentals from './pages/admin/ManageRentals'
import ManagePayments from './pages/admin/ManagePayments'
import ManageInvoices from './pages/admin/ManageInvoices'
import AdminFeedback from './pages/admin/AdminFeedback'
import ManagePromoCodes from './pages/admin/ManagePromoCodes'
import ManageSelfDrive from './pages/admin/ManageSelfDrive'
import SelfDriveHandover from './pages/admin/SelfDriveHandover'
import AdminSettings from './pages/admin/AdminSettings'
import ManageSupport from './pages/admin/ManageSupport'

// Driver
import DriverDashboard from './pages/driver/DriverDashboard'
import DriverRentals from './pages/driver/DriverRentals'
import DriverPickupDropoff from './pages/driver/DriverPickupDropoff'
import DriverProfile from './pages/driver/DriverProfile'

// Misc
import NotFound from './pages/NotFound'
import Unauthorized from './pages/Unauthorized'

export default function App() {
  return (
    <ErrorBoundary>
    <LanguageProvider>
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      <Router>
        <Routes>
          {/* ── Public / Auth ── */}
          {/* New feature: public landing page — cars are browsable with no login at all now.
              Booking still requires an account (see CustomerRoute below), so this is the only
              route that changed from "redirect to /login" to an actual page. */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<UnifiedLogin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin/login" element={<Navigate to="/login" replace />} />
          <Route path="/driver/login" element={<Navigate to="/login" replace />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ── Customer (protected) ── */}
          <Route element={<CustomerRoute />}>
            <Route path="/customer/dashboard" element={<CustomerDashboard />} />
            <Route path="/customer/cars" element={<BrowseCars />} />
            <Route path="/customer/cars/:carId" element={<CarDetail />} />
            <Route path="/customer/booking/:carId" element={<BookingPage />} />
            <Route path="/customer/booking-payment/:reservationId" element={<BookingPaymentPage />} />
            <Route path="/customer/bookings" element={<MyBookings />} />
            <Route path="/customer/wishlist" element={<MyWishlist />} />
            <Route path="/customer/referrals" element={<MyReferrals />} />
            <Route path="/customer/support" element={<CustomerSupport />} />
            <Route path="/customer/profile" element={<CustomerProfile />} />
            <Route path="/customer/feedback/:rentalId" element={<FeedbackPage />} />
            <Route path="/customer/invoice/:invoiceId" element={<InvoicePage />} />
          </Route>

          {/* ── Admin (protected) ── */}
          <Route element={<AdminRoute />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/cars" element={<ManageCars />} />
            <Route path="/admin/customers" element={<ManageCustomers />} />
            <Route path="/admin/drivers" element={<ManageDrivers />} />
            <Route path="/admin/reservations" element={<ManageReservations />} />
            <Route path="/admin/rentals" element={<ManageRentals />} />
            <Route path="/admin/payments" element={<ManagePayments />} />
            <Route path="/admin/invoices" element={<ManageInvoices />} />
            <Route path="/admin/feedback" element={<AdminFeedback />} />
            <Route path="/admin/promo-codes" element={<ManagePromoCodes />} />
            <Route path="/admin/self-drive" element={<ManageSelfDrive />} />
            <Route path="/admin/self-drive-handover" element={<SelfDriveHandover />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/support" element={<ManageSupport />} />
          </Route>

          {/* ── Driver (protected) ── */}
          <Route element={<DriverRoute />}>
            <Route path="/driver/dashboard" element={<DriverDashboard />} />
            <Route path="/driver/rentals" element={<DriverRentals />} />
            <Route path="/driver/pickup-dropoff" element={<DriverPickupDropoff />} />
            <Route path="/driver/profile" element={<DriverProfile />} />
          </Route>

          {/* ── Fallback ── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
    </LanguageProvider>
    </ErrorBoundary>
  )
}
