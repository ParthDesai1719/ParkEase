import { Router } from 'express';
import {
  activateOwner,
  approveFacilitySubmission,
  approveOwnerApplication,
  exportOwnerApplicationsCsv,
  getAdminFacilityFile,
  getDashboardOverview,
  getFacilitySubmissionById,
  getFacilitySubmissions,
  getOwnerApplicationById,
  getOwnerApplicationDocument,
  getOwnerApplicationPayment,
  getOwnerApplications,
  getOwnerFacilitiesSummary,
  rejectFacilitySubmission,
  rejectOwnerApplication,
  requestFacilityChanges,
  startFacilityReview,
  suspendOwner,
  updateFacilityRemarks,
  updateOwnerApplicationRemarks,
} from '../controllers/admin.controller.js';
import {
  getSettings,
  updateSettings,
  uploadPlatformLogo,
  streamPlatformLogo,
} from '../controllers/adminSettings.controller.js';
import {
  getCustomers,
  getCustomerDetails,
  getCustomerBookings,
  updateCustomerProfile,
  suspendCustomer,
  activateCustomer,
  deleteCustomer,
} from '../controllers/adminUsers.controller.js';
import {
  getStaffOverview,
  getStaffList,
  getOwnerOptions,
  getParkingLotOptions,
  getStaffById,
  createStaff,
  updateStaff,
  suspendStaff,
  activateStaff,
  transferStaff,
  deleteStaff,
} from '../controllers/adminStaff.controller.js';
import {
  getBookingOverview,
  getBookings,
  getBookingById,
  cancelBooking,
  getBookingCancellationDetails,
  getLiveVehiclesOverview,
  getLiveVehicles,
  getLiveVehicleDetails,
} from '../controllers/adminOperations.controller.js';
import {
  getFinanceOverview,
  getPayments,
  getPaymentById,
  exportPaymentsCsv,
  getFinanceFilterOptions,
} from '../controllers/adminFinance.controller.js';
import {
  getEmailCenterOverview,
  searchRecipients,
  sendAdminEmail,
  getEmailHistory,
  getEmailById as getEmailLogById,
  previewAdminEmail,
} from '../controllers/adminEmailCenter.controller.js';
import {
  getReviewOverview,
  getReviews,
  getReviewById,
  approveReview,
  hideReview,
  deleteReview,
  getReviewFilterOptions,
} from '../controllers/adminReviews.controller.js';
import {
  getDashboardOverview as getInsightsDashboardOverview,
  getAnalytics as getInsightsAnalytics,
  generateReport,
  exportReportCsv,
  getInsightsFilterOptions,
} from '../controllers/adminInsights.controller.js';
import { requireAuth, requirePermission, requireRole } from '../middleware/auth.js';
import { logoUpload } from '../middleware/upload.js';

const router = Router();

// =========================================================================
// Platform Settings (Admin Phase 1)
// =========================================================================
// Public logo streaming
router.get('/settings/logo/:filename', streamPlatformLogo);

router.get(
  '/settings',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('SETTINGS_MANAGE'),
  getSettings,
);

router.put(
  '/settings',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('SETTINGS_MANAGE'),
  updateSettings,
);

router.post(
  '/settings/logo',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('SETTINGS_MANAGE'),
  logoUpload.single('logo'),
  uploadPlatformLogo,
);

// =========================================================================
// User Management (Admin Phase 2 - Customers Only)
// =========================================================================
router.get(
  '/users',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('USER_MANAGE'),
  getCustomers,
);

router.get(
  '/users/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('USER_MANAGE'),
  getCustomerDetails,
);

router.get(
  '/users/:id/bookings',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('USER_MANAGE'),
  getCustomerBookings,
);

router.patch(
  '/users/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('USER_MANAGE'),
  updateCustomerProfile,
);

router.post(
  '/users/:id/suspend',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('USER_MANAGE'),
  suspendCustomer,
);

router.post(
  '/users/:id/activate',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('USER_MANAGE'),
  activateCustomer,
);

router.delete(
  '/users/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('USER_MANAGE'),
  deleteCustomer,
);

// =========================================================================
// Security Staff Management (Admin Phase 4)
// =========================================================================
router.get(
  '/staff/overview',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('STAFF_MANAGE'),
  getStaffOverview,
);

router.get(
  '/staff/owners',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('STAFF_MANAGE'),
  getOwnerOptions,
);

router.get(
  '/staff/parking-lots',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('STAFF_MANAGE'),
  getParkingLotOptions,
);

router.get(
  '/staff',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('STAFF_MANAGE'),
  getStaffList,
);

router.post(
  '/staff',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('STAFF_MANAGE'),
  createStaff,
);

router.get(
  '/staff/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('STAFF_MANAGE'),
  getStaffById,
);

router.patch(
  '/staff/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('STAFF_MANAGE'),
  updateStaff,
);

router.post(
  '/staff/:id/suspend',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('STAFF_MANAGE'),
  suspendStaff,
);

router.post(
  '/staff/:id/activate',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('STAFF_MANAGE'),
  activateStaff,
);

router.post(
  '/staff/:id/transfer',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('STAFF_MANAGE'),
  transferStaff,
);

router.delete(
  '/staff/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('STAFF_MANAGE'),
  deleteStaff,
);

// Executive Dashboard Overview Metrics
router.get(
  '/overview',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('DASHBOARD_VIEW'),
  getDashboardOverview,
);

// Parking Owner Applications Review Management
router.get(
  '/owner-applications',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_VIEW'),
  getOwnerApplications,
);

router.get(
  '/owner-applications/export/csv',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_VIEW'),
  exportOwnerApplicationsCsv,
);

router.get(
  '/owner-applications/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_VIEW'),
  getOwnerApplicationById,
);

router.get(
  '/owner-applications/:id/payment',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_VIEW'),
  getOwnerApplicationPayment,
);

router.get(
  '/owner-applications/:id/facilities-summary',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_VIEW'),
  getOwnerFacilitiesSummary,
);

router.get(
  '/owners/:id/facilities-summary',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_VIEW'),
  getOwnerFacilitiesSummary,
);

router.post(
  '/owner-applications/:id/suspend',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_MANAGE'),
  suspendOwner,
);

router.post(
  '/owners/:id/suspend',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_MANAGE'),
  suspendOwner,
);

router.post(
  '/owner-applications/:id/activate',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_MANAGE'),
  activateOwner,
);

router.post(
  '/owners/:id/activate',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_MANAGE'),
  activateOwner,
);

router.put(
  '/owner-applications/:id/remarks',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_MANAGE'),
  updateOwnerApplicationRemarks,
);

router.get(
  '/owner-applications/:id/documents/:docType',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_VIEW'),
  getOwnerApplicationDocument,
);

router.post(
  '/owner-applications/:id/approve',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_MANAGE'),
  approveOwnerApplication,
);

router.post(
  '/owner-applications/:id/reject',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_MANAGE'),
  rejectOwnerApplication,
);

// =========================================================================
// Parking Facility Submissions Review Management
// =========================================================================

router.get(
  '/facilities',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  getFacilitySubmissions,
);

router.get(
  '/facilities/files/:filename',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  getAdminFacilityFile,
);

router.get(
  '/facilities/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  getFacilitySubmissionById,
);

router.post(
  '/facilities/:id/start-review',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  startFacilityReview,
);

router.post(
  '/facilities/:id/request-changes',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  requestFacilityChanges,
);

router.post(
  '/facilities/:id/approve',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  approveFacilitySubmission,
);

router.post(
  '/facilities/:id/reject',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  rejectFacilitySubmission,
);

router.put(
  '/facilities/:id/remarks',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  updateFacilityRemarks,
);

// =========================================================================
// Booking Management (Admin Phase 2 / PAGE 6)
// =========================================================================
router.get(
  '/bookings/overview',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('BOOKING_VIEW'),
  getBookingOverview,
);

router.get(
  '/bookings',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('BOOKING_VIEW'),
  getBookings,
);

router.get(
  '/bookings/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('BOOKING_VIEW'),
  getBookingById,
);

router.get(
  '/bookings/:id/cancellation',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('BOOKING_VIEW'),
  getBookingCancellationDetails,
);

router.post(
  '/bookings/:id/cancel',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('BOOKING_CANCEL'),
  cancelBooking,
);

// =========================================================================
// Live Vehicle Locator (Admin Phase 2 / Sections 43-55)
// =========================================================================
router.get(
  '/live-vehicles/overview',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('BOOKING_VIEW'),
  getLiveVehiclesOverview,
);

router.get(
  '/live-vehicles',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('BOOKING_VIEW'),
  getLiveVehicles,
);

router.get(
  '/live-vehicles/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('BOOKING_VIEW'),
  getLiveVehicleDetails,
);

// =========================================================================
// Finance & Payments Management (Admin Phase 3 / PAGE 7 — Payments)
// =========================================================================
router.get(
  '/finance/overview',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PAYMENT_VIEW'),
  getFinanceOverview,
);
router.get(
  '/payments/overview',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PAYMENT_VIEW'),
  getFinanceOverview,
);

router.get(
  '/finance/payments',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PAYMENT_VIEW'),
  getPayments,
);
router.get(
  '/payments',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PAYMENT_VIEW'),
  getPayments,
);

router.get(
  '/finance/export/csv',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PAYMENT_VIEW'),
  exportPaymentsCsv,
);
router.get(
  '/payments/export/csv',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PAYMENT_VIEW'),
  exportPaymentsCsv,
);

router.get(
  '/finance/filter-options',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PAYMENT_VIEW'),
  getFinanceFilterOptions,
);
router.get(
  '/payments/filter-options',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PAYMENT_VIEW'),
  getFinanceFilterOptions,
);

router.get(
  '/finance/payments/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PAYMENT_VIEW'),
  getPaymentById,
);
router.get(
  '/payments/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PAYMENT_VIEW'),
  getPaymentById,
);

// =========================================================================
// EMAIL CENTER / COMMUNICATION MANAGEMENT (Phase 4)
// =========================================================================
router.get(
  '/email-center/overview',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('EMAIL_HISTORY_VIEW', 'EMAIL_SEND'),
  getEmailCenterOverview,
);

router.get(
  '/email-center/recipients',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('EMAIL_SEND', 'EMAIL_HISTORY_VIEW'),
  searchRecipients,
);

router.post(
  '/email-center/preview',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('EMAIL_SEND'),
  previewAdminEmail,
);

router.post(
  '/email-center/send',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('EMAIL_SEND'),
  sendAdminEmail,
);

router.get(
  '/email-center/history',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('EMAIL_HISTORY_VIEW'),
  getEmailHistory,
);

router.get(
  '/email-center/history/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('EMAIL_HISTORY_VIEW'),
  getEmailLogById,
);

// =========================================================================
// REVIEWS & MODERATION (Phase 5)
// =========================================================================
router.get(
  '/reviews/overview',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('REVIEW_MANAGE'),
  getReviewOverview,
);

router.get(
  '/reviews/filter-options',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('REVIEW_MANAGE'),
  getReviewFilterOptions,
);

router.get(
  '/reviews',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('REVIEW_MANAGE'),
  getReviews,
);

router.get(
  '/reviews/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('REVIEW_MANAGE'),
  getReviewById,
);

router.patch(
  '/reviews/:id/approve',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('REVIEW_MANAGE'),
  approveReview,
);

router.patch(
  '/reviews/:id/hide',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('REVIEW_MANAGE'),
  hideReview,
);

router.delete(
  '/reviews/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('REVIEW_MANAGE'),
  deleteReview,
);

// =========================================================================
// Insights & Dashboard (Admin Phase 7: Overview, Analytics & Reports)
// =========================================================================
router.get(
  '/insights/dashboard',
  requireAuth,
  requireRole('ADMIN'),
  getInsightsDashboardOverview,
);

router.get(
  '/insights/analytics',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('ANALYTICS_VIEW'),
  getInsightsAnalytics,
);

router.get(
  '/insights/reports',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('REPORT_VIEW'),
  generateReport,
);

router.get(
  '/insights/reports/export/csv',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('REPORT_VIEW'),
  exportReportCsv,
);

router.get(
  '/insights/filter-options',
  requireAuth,
  requireRole('ADMIN'),
  getInsightsFilterOptions,
);

export default router;
