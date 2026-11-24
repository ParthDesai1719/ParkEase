import { Router } from 'express';
import { getPublicOwnerRegistrationStatus } from '../controllers/admin.controller.js';
import {
  getOwnerRegistrationConfig,
  uploadOwnerDocument,
  createDraftRegistration,
  requestOwnerEmailOtp,
  verifyOwnerEmailOtp,
  requestOwnerMobileOtp,
  verifyOwnerMobileOtp,
  createOwnerPaymentOrder,
  verifyOwnerPayment,
  getOwnerRegistrationDocuments,
  getOwnerRegistrationDocumentFile,
  getOwnerDashboardStatsHandler,
  updateOwnerParkingLotHandler,
  getOwnerSlotsHandler,
  getOwnerSlotByIdHandler,
  updateOwnerSlotStatusHandler,
  getOwnerBookingsHandler,
  getOwnerBookingByIdHandler,
  cancelOwnerBookingHandler,
  extendOwnerBookingHandler,
  getOwnerStaffHandler,
  getOwnerStaffByIdHandler,
  inviteOwnerStaffHandler,
  assignOwnerStaffHandler,
  updateOwnerStaffStatusHandler,
  updateOwnerStaffHandler,
  resendOwnerStaffInvitationHandler,
} from '../controllers/owner.controller.js';
import {
  getOwnerPublishedLayoutHandler,
  ownerConfirmLayoutHandler,
  ownerRequestLayoutChangesHandler,
  activateFacilityHandler,
} from '../controllers/parkingLayout.controller.js';
import {
  getOwnerParkingLots,
  getOwnerParkingLotById,
  getOwnerParkingLotHierarchy,
} from '../controllers/parkingLot.controller.js';
import {
  getOwnerRevenueOverviewHandler,
  getOwnerRevenueTransactionsHandler,
} from '../controllers/ownerRevenue.controller.js';
import {
  getOwnerVehiclesOverviewHandler,
  getOwnerVehiclesListHandler,
  getOwnerLiveVehicleLocatorHandler,
} from '../controllers/ownerVehicles.controller.js';
import {
  getOwnerReviewsHandler,
  submitOwnerReviewReplyHandler,
} from '../controllers/ownerReviews.controller.js';
import { getOwnerDashboardAnalyticsHandler } from '../controllers/ownerAnalytics.controller.js';
import {
  getOwnerBusinessSettingsHandler,
  updateOwnerBusinessSettingsHandler,
} from '../controllers/ownerSettings.controller.js';
import {
  getOwnerIncidentsHandler,
  getOwnerIncidentDetailHandler,
  addOwnerIncidentResponseHandler,
  updateOwnerIncidentStatusHandler,
} from '../controllers/ownerIncidents.controller.js';
import { ownerEmailCenterController } from '../controllers/ownerEmailCenter.controller.js';
import { ownerDocumentUpload } from '../middleware/upload.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// 1. Platform Registration Configuration (Fee snapshot, currency, etc.)
router.get('/config', getOwnerRegistrationConfig);

// 2. Secure File Upload for Owner Verification Documents
router.post('/upload', ownerDocumentUpload.single('file'), uploadOwnerDocument);

// 3. Initiate Owner Registration (Draft Application Creation)
router.post('/register', createDraftRegistration);

// 4. Dual OTP Verification Flow (Email and Mobile OTPs)
router.post('/register/request-email-otp', requestOwnerEmailOtp);
router.post('/register/verify-email-otp', verifyOwnerEmailOtp);
router.post('/register/request-mobile-otp', requestOwnerMobileOtp);
router.post('/register/verify-mobile-otp', verifyOwnerMobileOtp);

// 5. Razorpay Payment Gateway (Locked until dual OTP verified)
router.post('/register/create-order', createOwnerPaymentOrder);
router.post('/register/verify-payment', verifyOwnerPayment);

// 6. Public / Applicant Registration Status Lookup (Page 5B)
router.get('/registration-status', getPublicOwnerRegistrationStatus);

// 7. Authenticated Owner Registration & Business Documents (Page 14 & Dashboard)
router.get('/registration-documents', requireAuth, getOwnerRegistrationDocuments);
router.get('/registration-documents/:docType', requireAuth, getOwnerRegistrationDocumentFile);

// 8. Authenticated Owner Official Parking Lots & Hierarchy
router.get(
  '/parking-lots',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerParkingLots,
);
router.get(
  '/parking-lots/:id',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerParkingLotById,
);
router.get(
  '/parking-lots/:id/hierarchy',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerParkingLotHierarchy,
);

// 9. Authenticated Owner Read-Only Floor Layout View (Published Only)
router.get(
  '/parking-lots/:id/floors/:floorId/layout',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerPublishedLayoutHandler,
);

// 10. Owner Layout Review Actions (Confirm / Request Changes)
router.post(
  '/parking-lots/:id/layout/confirm',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  ownerConfirmLayoutHandler,
);
router.post(
  '/parking-lots/:id/layout/request-changes',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  ownerRequestLayoutChangesHandler,
);

// 11. Facility Go-Live Activation (Handover to Owner)
router.post(
  '/parking-lots/:id/activate',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  activateFacilityHandler,
);

// 12. Authenticated Owner Live Dashboard Statistics
router.get(
  '/dashboard/stats',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerDashboardStatsHandler,
);

// 13. Update Permitted Business & Operational Information for an Owner's Parking Lot
router.patch(
  '/parking-lots/:id',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  updateOwnerParkingLotHandler,
);

// 14. Authenticated Owner Slot Management & Operational Status
router.get(
  '/slots',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerSlotsHandler,
);

router.get(
  '/slots/:id',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerSlotByIdHandler,
);

router.patch(
  '/slots/:id/status',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  updateOwnerSlotStatusHandler,
);

// 15. Authenticated Owner Booking Management
router.get(
  '/bookings',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerBookingsHandler,
);

router.get(
  '/bookings/:id',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerBookingByIdHandler,
);

router.patch(
  '/bookings/:id/cancel',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  cancelOwnerBookingHandler,
);

router.post(
  '/bookings/:id/extend',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  extendOwnerBookingHandler,
);

// 16. Authenticated Owner Staff Management
router.get(
  '/staff',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerStaffHandler,
);

router.get(
  '/staff/:id',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerStaffByIdHandler,
);

router.post(
  '/staff/invite',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  inviteOwnerStaffHandler,
);

router.post(
  '/staff/:id/assign',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  assignOwnerStaffHandler,
);

router.patch(
  '/staff/:id/status',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  updateOwnerStaffStatusHandler,
);

router.put(
  '/staff/:id',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  updateOwnerStaffHandler,
);

router.post(
  '/staff/:id/resend-invitation',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  resendOwnerStaffInvitationHandler,
);

// ============================================================================
// OWNER-01: Revenue & Financial Analytics
// ============================================================================
router.get(
  '/revenue/overview',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerRevenueOverviewHandler,
);

router.get(
  '/revenue/transactions',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerRevenueTransactionsHandler,
);

// ============================================================================
// OWNER-02: Vehicle Management & Live Vehicle Locator
// ============================================================================
router.get(
  '/vehicles/overview',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerVehiclesOverviewHandler,
);

router.get(
  '/vehicles/list',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerVehiclesListHandler,
);

router.get(
  '/vehicles/live-locator',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerLiveVehicleLocatorHandler,
);

// ============================================================================
// OWNER-03: Reviews & Owner Replies
// ============================================================================
router.get(
  '/reviews',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerReviewsHandler,
);

router.post(
  '/reviews/:reviewId/reply',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  submitOwnerReviewReplyHandler,
);

// ============================================================================
// OWNER-04: Dashboard Charts & Business Analytics
// ============================================================================
router.get(
  '/analytics/dashboard',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerDashboardAnalyticsHandler,
);

// ============================================================================
// OWNER-05: Business Settings
// ============================================================================
router.get(
  '/settings',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerBusinessSettingsHandler,
);

router.put(
  '/settings/:parkingLotId',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  updateOwnerBusinessSettingsHandler,
);

// ============================================================================
// OWNER INCIDENTS & SECURITY COLLABORATION
// ============================================================================
router.get(
  '/incidents',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerIncidentsHandler,
);

router.get(
  '/incidents/:id',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  getOwnerIncidentDetailHandler,
);

router.post(
  '/incidents/:id/responses',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  addOwnerIncidentResponseHandler,
);

router.patch(
  '/incidents/:id/status',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  updateOwnerIncidentStatusHandler,
);

// ============================================================================
// OWNER EMAIL CENTER (CUSTOMERS & ASSIGNED SECURITY STAFF)
// ============================================================================
router.get(
  '/email-center/recipients',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  (req, res, next) => {
    ownerEmailCenterController.getRecipients(req, res).catch(next);
  },
);

router.post(
  '/email-center/send',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  (req, res, next) => {
    ownerEmailCenterController.sendEmail(req, res).catch(next);
  },
);

router.get(
  '/email-center/history',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  (req, res, next) => {
    ownerEmailCenterController.getHistory(req, res).catch(next);
  },
);

router.get(
  '/email-center/overview',
  requireAuth,
  requireRole('OWNER', 'PARKING_OWNER'),
  (req, res, next) => {
    ownerEmailCenterController.getOverview(req, res).catch(next);
  },
);

export default router;
