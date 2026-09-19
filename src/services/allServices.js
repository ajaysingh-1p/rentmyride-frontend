import api from './api'

// ── Auth ──────────────────────────────────────────────────
// POST /api/customers/login        body: { username, password }
// POST /api/customers/register     body: RegisterRequest
// POST /api/customers/login/otp/send      body: { identifier }        -> sends OTP to registered email
// POST /api/customers/login/otp/verify    body: { identifier, otp }   -> returns AuthResponseDTO (token, etc)
// POST /api/customers/forgot-password/send-otp   body: { identifier }
// POST /api/customers/forgot-password/verify-otp body: { identifier, otp }
// POST /api/customers/forgot-password/reset      body: { identifier, otp, newPassword }
// POST /api/drivers/login          body: { email, password }
// POST /api/admin/login            body: { username, password }
export const authService = {
  unifiedLogin:     (data) => api.post('/auth/login', data), // POST /api/auth/login body: { username, password } -> auto-detects role
  customerRegister: (data) => api.post('/customers/register', data),

  // OTP Login — unified: works for both customer and driver accounts (tries customer first,
  // then driver, same as the password-based unifiedLogin above).
  sendLoginOtp:     (identifier)          => api.post('/auth/login/otp/send', { identifier }),
  verifyLoginOtp:   (identifier, otp)     => api.post('/auth/login/otp/verify', { identifier, otp }),

  // Forgot Password — unified, same customer-then-driver lookup.
  sendForgotPasswordOtp:   (identifier)               => api.post('/auth/forgot-password/send-otp', { identifier }),
  verifyForgotPasswordOtp: (identifier, otp)          => api.post('/auth/forgot-password/verify-otp', { identifier, otp }),
  resetPassword:           (identifier, otp, newPassword) =>
      api.post('/auth/forgot-password/reset', { identifier, otp, newPassword }),
}

// ── Admin (self-service profile / business settings) ────────
export const adminService = {
  getProfile:            ()     => api.get('/admin/profile'),
  updateProfile:          (data) => api.put('/admin/profile', data),
  changePassword:         (data) => api.patch('/admin/change-password', data),
  getBusinessSettings:    ()     => api.get('/admin/business-settings'),
  updateBusinessSettings: (data) => api.put('/admin/business-settings', data),
}

// ── Cars ──────────────────────────────────────────────────
// GET  /api/cars
// GET  /api/cars/:carId
// GET  /api/cars/available
// GET  /api/cars/search?keyword=
// GET  /api/cars/category/:category
// GET  /api/cars/available-between?pickupDate=&returnDate=
// POST /api/cars                   ADMIN only
// PUT  /api/cars/:carId            ADMIN only
// DELETE /api/cars/:carId          ADMIN only
// PATCH /api/cars/:carId/status    ADMIN
export const carService = {
  getAll:             ()                    => api.get('/cars'),
  getById:            (id)                  => api.get('/cars/' + id),
  getAvailable:       ()                    => api.get('/cars/available'),
  search:             (keyword)             => api.get('/cars/search?keyword=' + encodeURIComponent(keyword)),
  getByCategory:      (category)            => api.get('/cars/category/' + category),
  getAvailableBetween:(pickup, ret)         => api.get('/cars/available-between?pickupDate=' + pickup + '&returnDate=' + ret),
  add:                (data)                => api.post('/cars', data),
  update:             (id, data)            => api.put('/cars/' + id, data),
  delete:             (id)                  => api.delete('/cars/' + id),
  updateStatus:       (id, status)          => api.patch('/cars/' + id + '/status?status=' + status),
}

// ── Customers ─────────────────────────────────────────────
// GET  /api/customers              ADMIN only
// GET  /api/customers/:id          ADMIN/CUSTOMER
// PUT  /api/customers/:id          ADMIN/CUSTOMER
// GET  /api/customers/search?keyword=  ADMIN
// PATCH /api/customers/:id/status  ADMIN
// DELETE /api/customers/:id        ADMIN
export const customerService = {
  getAll:         ()              => api.get('/customers'),
  getById:        (id)            => api.get('/customers/' + id),
  update:         (id, data)      => api.put('/customers/' + id, data),
  search:         (keyword)       => api.get('/customers/search?keyword=' + encodeURIComponent(keyword)),
  updateStatus:   (id, status)    => api.patch('/customers/' + id + '/status?status=' + status),
  delete:         (id)            => api.delete('/customers/' + id),
  getReferral:    (id)            => api.get('/customers/' + id + '/referral'),
  changePassword: (id, data)      => api.patch('/customers/' + id + '/change-password', data),
}

// ── Drivers ───────────────────────────────────────────────
// GET  /api/drivers                  ADMIN
// GET  /api/drivers/:id
// POST /api/drivers                  ADMIN
// PUT  /api/drivers/:id
// DELETE /api/drivers/:id            ADMIN
// GET  /api/drivers/status/:status   ADMIN
// PATCH /api/drivers/:id/status      ADMIN
export const driverService = {
  getAll:           ()              => api.get('/drivers'),
  getById:          (id)            => api.get('/drivers/' + id),
  register:         (data)          => api.post('/drivers', data),
  update:           (id, data)      => api.put('/drivers/' + id, data),
  delete:           (id)            => api.delete('/drivers/' + id),
  getByStatus:      (status)        => api.get('/drivers/status/' + status),
  updateStatus:     (id, status)    => api.patch('/drivers/' + id + '/status?status=' + status),
  changePassword:   (id, data)      => api.patch('/drivers/' + id + '/change-password', data),
  getStats:         (id)            => api.get('/drivers/' + id + '/stats'),
}

// ── Reservations ──────────────────────────────────────────
// POST /api/reservations/customer/:customerId
// GET  /api/reservations                    ADMIN
// GET  /api/reservations/:id
// GET  /api/reservations/customer/:customerId
// PATCH /api/reservations/:id/status        ADMIN
// PATCH /api/reservations/:id/cancel        ADMIN/CUSTOMER
export const reservationService = {
  create:       (customerId, data) => api.post('/reservations/customer/' + customerId, data),
  estimate:     (data)             => api.post('/reservations/estimate', data),
  pay:          (reservationId, data) => api.post('/reservations/' + reservationId + '/pay', data),
  getAll:       ()                 => api.get('/reservations'),
  getById:      (id)               => api.get('/reservations/' + id),
  getByCustomer:(customerId)       => api.get('/reservations/customer/' + customerId),
  exportPdf:    (customerId, customerName) => api.get('/reservations/customer/' + customerId + '/export-pdf?customerName=' + encodeURIComponent(customerName || ''), { responseType: 'blob' }),
  getAvailability: (carId)         => api.get('/reservations/car/' + carId + '/availability'),
  reschedule:   (id, data)         => api.patch('/reservations/' + id + '/reschedule', data),
  assignDriver: (id, driverId)     => api.patch('/reservations/' + id + '/assign-driver', { driverId }),
  getPendingPickups: (driverId)    => api.get('/reservations/driver/' + driverId + '/pending-pickups'),
  getDueBalance: (customerId)      => api.get('/reservations/customer/' + customerId + '/due-balance'),
  updateStatus: (id, data)         => api.patch('/reservations/' + id + '/status', data),
  cancel:       (id)               => api.patch('/reservations/' + id + '/cancel'),
  // New feature: Driver Trip Accept/Reject
  getPendingTripRequests: ()       => api.get('/reservations/driver/trip-requests/pending'),
  acceptTripAssignment:   (id)     => api.patch('/reservations/' + id + '/trip-requests/accept'),
  rejectTripAssignment:   (id, reason) => api.patch('/reservations/' + id + '/trip-requests/reject', { reason }),
}

// ── Locations (Bihar) ────────────────────────────────────────
// GET /api/locations/bihar   -> [{ name, district, latitude, longitude }]
export const locationService = {
  getBiharLocations: () => api.get('/locations/bihar'),
}

// ── File Upload (DL/Aadhar photos) ──────────────────────────
export const fileService = {
  // type: 'car' -> public /uploads/cars/** (marketing photos, no login needed to view)
  //       'document' (default) -> protected /uploads/documents/** (Aadhar/DL/license — see
  //       AuthenticatedImage.jsx for how these get displayed, since a plain <img> can't).
  //       'handover' -> protected /uploads/handover/** (self-drive pickup/return evidence photos)
  upload: (file, type = 'document') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    // Don't hardcode 'multipart/form-data' — the browser needs to add its own boundary param.
    // Overriding the axios instance's default 'application/json' with undefined lets it do that.
    return api.post('/files/upload', formData, { headers: { 'Content-Type': undefined } })
  },
}

// ── Promo Codes ──────────────────────────────────────────────
export const promoCodeService = {
  validate: (code, bookingAmount) => api.post('/promo-codes/validate', { code, bookingAmount }),
  getAll:   ()                    => api.get('/promo-codes'),
  create:   (data)                => api.post('/promo-codes', data),
  update:   (id, data)            => api.put('/promo-codes/' + id, data),
  delete:   (id)                  => api.delete('/promo-codes/' + id),
}

// ── Self-Drive Config (admin-configurable, per car category) ─
export const selfDriveConfigService = {
  getAll:      ()                => api.get('/self-drive-config'),
  getByCategory: (carCategory)   => api.get('/self-drive-config/category/' + carCategory),
  create:      (data)            => api.post('/self-drive-config', data),
  update:      (id, data)        => api.put('/self-drive-config/' + id, data),
  delete:      (id)              => api.delete('/self-drive-config/' + id),
}

// ── Wishlist ─────────────────────────────────────────────────
export const wishlistService = {
  add:      (customerId, carId) => api.post('/wishlist/customer/' + customerId + '/car/' + carId),
  remove:   (customerId, carId) => api.delete('/wishlist/customer/' + customerId + '/car/' + carId),
  getAll:   (customerId)        => api.get('/wishlist/customer/' + customerId),
  status:   (customerId, carId) => api.get('/wishlist/customer/' + customerId + '/car/' + carId + '/status'),
}

// POST /api/feedback/customer/{customerId}         body: { rentalId, carCondition, staffBehavior, valueForMoney, bookingProcess, overallService, comments }
// GET  /api/feedback/customer/{customerId}          -> customer's own feedback
// GET  /api/feedback/rental/{rentalId}/exists        -> boolean
// GET  /api/feedback                                 ADMIN only -> all feedback
export const feedbackService = {
  submit:            (customerId, data) => api.post('/feedback/customer/' + customerId, data),
  getForCustomer:    (customerId)       => api.get('/feedback/customer/' + customerId),
  existsForRental:   (rentalId)         => api.get('/feedback/rental/' + rentalId + '/exists'),
  getAll:            ()                 => api.get('/feedback'),
  getAllRatings:     ()                 => api.get('/feedback/ratings'),
  getForCar:         (carId)            => api.get('/feedback/car/' + carId),
}

// ── In-app Notifications (bell icon) ────────────────────────
export const savedAddressService = {
  add:    (customerId, data) => api.post('/saved-addresses/customer/' + customerId, data),
  getAll: (customerId)       => api.get('/saved-addresses/customer/' + customerId),
  delete: (id, customerId)   => api.delete('/saved-addresses/' + id + '/customer/' + customerId),
}

export const supportService = {
  getContactInfo: ()     => api.get('/support/contact-info'),
  submitQuery:    (data) => api.post('/support/contact', data),
  getAllQueries:      () => api.get('/support/queries'),
  getUnresolvedQueries: () => api.get('/support/queries/unresolved'),
  resolveQuery:   (id)   => api.patch('/support/queries/' + id + '/resolve'),
}

// ── Engagement (loyalty, badges, streaks, leaderboard) ───────
export const engagementService = {
  getSummary:         (customerId)         => api.get('/engagement/customer/' + customerId + '/summary'),
  getLeaderboard:     ()                    => api.get('/engagement/referral-leaderboard'),
  recordBookingIntent: (customerId, carId)  => api.post('/engagement/booking-intent', { customerId, carId }),
}

export const notificationService = {
  getForCustomer:  (customerId) => api.get('/notifications/customer/' + customerId),
  getUnreadCount:  (customerId) => api.get('/notifications/customer/' + customerId + '/unread-count'),
  markAsRead:      (id)         => api.patch('/notifications/' + id + '/read'),
  markAllAsRead:   (customerId) => api.patch('/notifications/customer/' + customerId + '/read-all'),
  getForDriver:        (driverId) => api.get('/notifications/driver/' + driverId),
  getUnreadCountDriver: (driverId) => api.get('/notifications/driver/' + driverId + '/unread-count'),
  markAllAsReadDriver:  (driverId) => api.patch('/notifications/driver/' + driverId + '/read-all'),
  getForAdmin:         ()          => api.get('/notifications/admin'),
  getUnreadCountAdmin: ()          => api.get('/notifications/admin/unread-count'),
  markAllAsReadAdmin:  ()          => api.patch('/notifications/admin/read-all'),
}

// ── Rentals ───────────────────────────────────────────────
// POST /api/rentals/pickup         ADMIN/DRIVER
// PATCH /api/rentals/:id/return    ADMIN/DRIVER
// GET  /api/rentals                ADMIN
// GET  /api/rentals/:id
// GET  /api/rentals/active         ADMIN/DRIVER
// GET  /api/rentals/customer/:id
// GET  /api/rentals/driver/:id
// GET  /api/rentals/revenue/total  ADMIN
// GET  /api/rentals/revenue/monthly?month=&year=  ADMIN
export const rentalService = {
  pickup:         (data)          => api.post('/rentals/pickup', data),
  returnCar:      (id, data)      => api.patch('/rentals/' + id + '/return', data),
  extend:         (id, data)      => api.patch('/rentals/' + id + '/extend', data),
  getAll:         ()              => api.get('/rentals'),
  getById:        (id)            => api.get('/rentals/' + id),
  getActive:      ()              => api.get('/rentals/active'),
  getByCustomer:  (id)            => api.get('/rentals/customer/' + id),
  exportPdf:      (customerId, customerName) => api.get('/rentals/customer/' + customerId + '/export-pdf?customerName=' + encodeURIComponent(customerName || ''), { responseType: 'blob' }),
  getByDriver:    (id)            => api.get('/rentals/driver/' + id),
  updateLocation: (id, driverId, coords) => api.patch('/rentals/' + id + '/location?driverId=' + driverId, coords),
  submitRebookPoll: (id, customerId, wouldRebook) => api.patch('/rentals/' + id + '/rebook-poll?customerId=' + customerId, { wouldRebook }),
  getTotalRevenue:()              => api.get('/rentals/revenue/total'),
  getMonthlyRevenue:(m, y)        => api.get('/rentals/revenue/monthly?month=' + m + '&year=' + y),
  // Issue #21 — Admin review queue for damage charges a Driver reported above the auto-approval threshold.
  getPendingDamageApprovals: ()   => api.get('/rentals/damage-approvals/pending'),
  approveDamageCharge:       (id) => api.patch('/rentals/' + id + '/damage-approvals/approve'),
  rejectDamageCharge:        (id) => api.patch('/rentals/' + id + '/damage-approvals/reject'),
}

// ── Self-Drive Handover (OTP based) ───────────────────────
// A self-drive booking has no driver, so the handover happens between the customer and the
// staff at the hub. The customer generates a screen-only 6-digit code, reads it out at the
// counter, and the admin submits it along with the odometer/fuel/damage reading. Neither side
// can move the booking forward alone.
// POST /api/self-drive/reservations/:id/pickup-otp   CUSTOMER
// POST /api/self-drive/rentals/:id/return-otp        CUSTOMER
// GET  /api/self-drive/customer/:id/active-trip      CUSTOMER
// GET  /api/self-drive/handover/pending              ADMIN
// GET  /api/self-drive/handover/active               ADMIN
// POST /api/self-drive/handover/pickup               ADMIN
// POST /api/self-drive/handover/return               ADMIN
export const selfDriveHandoverService = {
  requestPickupOtp:    (reservationId) => api.post('/self-drive/reservations/' + reservationId + '/pickup-otp'),
  requestReturnOtp:    (rentalId)      => api.post('/self-drive/rentals/' + rentalId + '/return-otp'),
  getActiveTrip:       (customerId)    => api.get('/self-drive/customer/' + customerId + '/active-trip'),
  getPendingHandovers: ()              => api.get('/self-drive/handover/pending'),
  getActiveHandovers:  ()              => api.get('/self-drive/handover/active'),
  confirmPickup:       (data)          => api.post('/self-drive/handover/pickup', data),
  confirmReturn:       (data)          => api.post('/self-drive/handover/return', data),
}

// ── Payments ──────────────────────────────────────────────
// POST /api/payments/create-order  body: { rentalId, paymentMethod }
// POST /api/payments/verify        body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
// GET  /api/payments               ADMIN
// GET  /api/payments/:id
// GET  /api/payments/rental/:rentalId
// GET  /api/payments/customer/:customerId
export const paymentService = {
  // LEGACY — the old rental-based (non-reservation) payment flow. Nothing in the current UI
  // calls these anymore (see PaymentController.java for why) — kept only because the matching
  // backend endpoints are still admin-reachable for potential manual/walk-in payment bookkeeping.
  createOrder:    (data)          => api.post('/payments/create-order', data),
  verify:         (data)          => api.post('/payments/verify', data),
  getAll:         ()              => api.get('/payments'),
  getById:        (id)            => api.get('/payments/' + id),
  getByRental:    (rentalId)      => api.get('/payments/rental/' + rentalId),
  getByCustomer:  (customerId)    => api.get('/payments/customer/' + customerId),
  // Booking-confirmation payment (full or ₹1000+ deposit), scoped to a Reservation
  createReservationOrder: (data) => api.post('/payments/reservation/create-order', data),
  verifyReservationPayment: (data) => api.post('/payments/reservation/verify', data),
  // New feature: "create only after payment" — for a booking that doesn't exist in the
  // database yet (see BookingPaymentPage.jsx).
  createNewBookingOrder: (data) => api.post('/payments/new-booking/create-order', data),
  verifyNewBookingPayment: (data) => api.post('/payments/new-booking/verify', data),
}

// ── Invoices ──────────────────────────────────────────────
// POST /api/invoices/generate/:rentalId  ADMIN
// GET  /api/invoices                     ADMIN
// GET  /api/invoices/:id
// GET  /api/invoices/number/:number
// GET  /api/invoices/rental/:rentalId
// GET  /api/invoices/customer/:customerId
// GET  /api/invoices/:id/download
export const invoiceService = {
  generate:       (rentalId)      => api.post('/invoices/generate/' + rentalId),
  getAll:         ()              => api.get('/invoices'),
  getById:        (id)            => api.get('/invoices/' + id),
  getByNumber:    (number)        => api.get('/invoices/number/' + number),
  getByRental:    (rentalId)      => api.get('/invoices/rental/' + rentalId),
  getByCustomer:  (customerId)    => api.get('/invoices/customer/' + customerId),
  download:       (id)            => api.get('/invoices/' + id + '/download', { responseType: 'blob' }),
}


