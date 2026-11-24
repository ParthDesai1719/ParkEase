import { Router } from 'express';
import {
  searchCustomerParking,
  getCustomerParkingDetails,
  getFacilityReviews,
  getFavouriteStatus,
  toggleFavourite,
  streamFacilityPhoto,
  getBookingContext,
  validateBookingSlot,
  getCustomerVehicles,
  addCustomerVehicle,
  initiateBookingPayment,
  verifyBookingPayment,
  failBookingPayment,
  emailBookingReceipt,
  getCustomerDashboard,
  getCustomerBookings,
  getCustomerBookingDetails,
  getCustomerFavourites,
  removeFavourite,
  getCustomerReviews,
  getEligibleBookingsForReview,
  submitCustomerReview,
  updateCustomerReview,
  deleteCustomerReview,
  cancelCustomerBooking,
  checkInCustomerBooking,
  checkOutCustomerBooking,
  initiateOverstayPayment,
  verifyOverstayPayment,
  getCustomerExtensionQuote,
  initiateCustomerExtension,
  verifyOnlineCustomerExtension,
  cancelOnlineCustomerExtension,
  submitCustomerHelpInquiry,
  getCustomerHelpInquiries,
} from '../controllers/customerParking.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Public photo streaming for facility thumbnails and map previews
// Does not require JWT Bearer header so standard HTML <img> tags load without issues
router.get('/photos/:filename', streamFacilityPhoto);

// Customer Dashboard, My Bookings & Favourites (Phase 3.4 — Protected by Customer RBAC)
router.get('/dashboard', requireAuth, requireRole('CUSTOMER'), getCustomerDashboard);
router.get('/favourites', requireAuth, requireRole('CUSTOMER'), getCustomerFavourites);
router.get('/bookings', requireAuth, requireRole('CUSTOMER'), getCustomerBookings);
router.get('/bookings/:bookingId', requireAuth, requireRole('CUSTOMER'), getCustomerBookingDetails);
router.post(
  '/bookings/:bookingId/email-receipt',
  requireAuth,
  requireRole('CUSTOMER'),
  emailBookingReceipt,
);
router.post(
  '/bookings/:bookingId/cancel',
  requireAuth,
  requireRole('CUSTOMER'),
  cancelCustomerBooking,
);
// Gate Check-in & Check-out (Protected: Privileged operations restricted to Security Staff & Administrator)
router.post(
  '/bookings/:bookingId/check-in',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  checkInCustomerBooking,
);
router.post(
  '/bookings/:bookingId/check-out',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  checkOutCustomerBooking,
);

// Customer Reviews & Ratings (PAGE 11)
router.get('/reviews', requireAuth, requireRole('CUSTOMER'), getCustomerReviews);
router.get(
  '/reviews/eligible-bookings',
  requireAuth,
  requireRole('CUSTOMER'),
  getEligibleBookingsForReview,
);
router.post('/reviews', requireAuth, requireRole('CUSTOMER'), submitCustomerReview);
router.post(
  '/bookings/:bookingId/review',
  requireAuth,
  requireRole('CUSTOMER'),
  submitCustomerReview,
);
router.put('/reviews/:reviewId', requireAuth, requireRole('CUSTOMER'), updateCustomerReview);
router.delete('/reviews/:reviewId', requireAuth, requireRole('CUSTOMER'), deleteCustomerReview);

// Customer Parking Search & Discovery
router.get('/search', requireAuth, searchCustomerParking);

// Customer Vehicles Management for Booking
router.get('/vehicles', requireAuth, requireRole('CUSTOMER'), getCustomerVehicles);
router.post('/vehicles', requireAuth, requireRole('CUSTOMER'), addCustomerVehicle);

// Single Facility Reviews & Favourites
router.get('/:id/reviews', requireAuth, getFacilityReviews);
router.get('/:id/favourite', requireAuth, requireRole('CUSTOMER'), getFavouriteStatus);
router.post('/:id/favourite', requireAuth, requireRole('CUSTOMER'), toggleFavourite);
router.delete('/:id/favourite', requireAuth, requireRole('CUSTOMER'), removeFavourite);

// Customer Slot Selection & Booking Routes (Phase 3.3)
router.get('/:id/booking-context', requireAuth, requireRole('CUSTOMER'), getBookingContext);
router.post('/:id/validate-slot', requireAuth, requireRole('CUSTOMER'), validateBookingSlot);
router.post(
  '/:id/bookings/initiate-payment',
  requireAuth,
  requireRole('CUSTOMER'),
  initiateBookingPayment,
);
router.post(
  '/:id/bookings/verify-payment',
  requireAuth,
  requireRole('CUSTOMER'),
  verifyBookingPayment,
);
router.post(
  '/:id/bookings/payment-failed',
  requireAuth,
  requireRole('CUSTOMER'),
  failBookingPayment,
);
router.post(
  '/:id/bookings/:bookingId/email-receipt',
  requireAuth,
  requireRole('CUSTOMER'),
  emailBookingReceipt,
);

// Overstay Online Payments for Customer
router.post(
  '/bookings/:bookingId/overstay/initiate-payment',
  requireAuth,
  requireRole('CUSTOMER'),
  initiateOverstayPayment,
);
router.post(
  '/bookings/:bookingId/overstay/verify-payment',
  requireAuth,
  requireRole('CUSTOMER'),
  verifyOverstayPayment,
);

// Booking Extension (Customer Phase 2)
router.get(
  '/bookings/:bookingId/extension-quote',
  requireAuth,
  requireRole('CUSTOMER'),
  getCustomerExtensionQuote,
);
router.post(
  '/bookings/:bookingId/extension/initiate',
  requireAuth,
  requireRole('CUSTOMER'),
  initiateCustomerExtension,
);
router.post(
  '/bookings/:bookingId/extension/verify-online',
  requireAuth,
  requireRole('CUSTOMER'),
  verifyOnlineCustomerExtension,
);
router.post(
  '/bookings/:bookingId/extension/cancel-online',
  requireAuth,
  requireRole('CUSTOMER'),
  cancelOnlineCustomerExtension,
);

// Customer 24/7 Helpline Support Inquiries
router.post('/helpline/inquiries', requireAuth, requireRole('CUSTOMER'), submitCustomerHelpInquiry);
router.get('/helpline/inquiries', requireAuth, requireRole('CUSTOMER'), getCustomerHelpInquiries);

// Single Facility Public/Customer Details
router.get('/:id', requireAuth, getCustomerParkingDetails);

export default router;
