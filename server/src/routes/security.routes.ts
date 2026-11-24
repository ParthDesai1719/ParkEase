import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireActiveSecurityAssignment } from '../middleware/securityAuth.js';
import { incidentImagesUpload } from '../middleware/upload.js';
import {
  getAssignedFacilities,
  getDashboardStats,
  verifyQrPass,
  recordVehicleEntry,
  completeVehicleExit,
  collectOverstayCash,
  searchManualBookings,
  getManualBookingDetails,
  recordManualEntry,
  completeManualExit,
  recordManualRejection,
  getWalkInAvailableSlots,
  calculateWalkInTariff,
  createWalkInBooking,
  confirmCashExtensionPayment,
  recordUnpaidCashExtension,
  settleExitCash,
  getWalkInExtensionQuote,
  processWalkInExtension,
  getIncidents,
  getIncidentDetail,
  createIncident,
  updateIncidentStatus,
  addIncidentResponse,
  uploadIncidentImages,
  getIncidentImageFile,
  getMovementLogs,
  getMovementLogDetail,
  exportMovementLogsCsv,
} from '../controllers/security.controller.js';
import { securityEmailerController } from '../controllers/securityEmailer.controller.js';
import { securityLiveViewerController } from '../controllers/securityLiveViewer.controller.js';

const router = Router();

// Retrieve all active facility assignments for logged-in security staff
router.get('/facilities', requireAuth, requireRole('SECURITY', 'ADMIN'), getAssignedFacilities);

// Retrieve live dashboard statistics for selected active facility
router.get(
  '/dashboard/stats',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  getDashboardStats,
);

// Scan and verify QR pass
router.post(
  '/qr/verify',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  verifyQrPass,
);

// Authorize physical vehicle gate entry
router.post(
  '/entry/verify',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  recordVehicleEntry,
);

// Authorize physical vehicle gate exit
router.post(
  '/exit/verify',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  completeVehicleExit,
);

// Collect cash for overstay charges (Walk-in or Online Fallback)
router.post(
  '/overstay/collect-cash',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  collectOverstayCash,
);

// Unified Exit Cash Settlement (Extension Cash + Live Overstay Fees)
router.post(
  '/exit-cash/settle',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  settleExitCash,
);

router.post(
  '/bookings/:bookingId/settle-cash',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  settleExitCash,
);

// Collect / confirm deferred cash payment for customer booking extension at exit
router.post(
  '/bookings/:bookingId/extension-cash/confirm',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  confirmCashExtensionPayment,
);

router.post(
  '/bookings/:bookingId/extension-cash/record-unpaid',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  recordUnpaidCashExtension,
);

// Manual Vehicle Lookup & Verification Fallback Routes
router.get(
  '/manual-lookup',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  searchManualBookings,
);

router.get(
  '/manual-lookup/:bookingId',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  getManualBookingDetails,
);

router.post(
  '/manual-lookup/entry',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  recordManualEntry,
);

router.post(
  '/manual-lookup/exit',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  completeManualExit,
);

router.post(
  '/manual-lookup/reject',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  recordManualRejection,
);

// Walk-in Booking Management Routes (Phase 4)
router.get(
  '/walk-in/available-slots',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  getWalkInAvailableSlots,
);

router.post(
  '/walk-in/calculate-tariff',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  calculateWalkInTariff,
);

router.post(
  '/walk-in/create',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  createWalkInBooking,
);

// Walk-in Booking Extension Routes
router.get(
  '/walk-in/bookings/:bookingId/extension-quote',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  getWalkInExtensionQuote,
);

router.post(
  '/walk-in/bookings/:bookingId/extend',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  processWalkInExtension,
);

// Incident Reports Routes (Phase 6)
router.get(
  '/incidents',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  getIncidents,
);

router.post(
  '/incidents',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  createIncident,
);

router.post(
  '/incidents/upload-images',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  incidentImagesUpload.array('images', 5),
  uploadIncidentImages,
);

router.get(
  '/incidents/images/:filename',
  requireAuth,
  getIncidentImageFile,
);

router.get(
  '/incidents/:id',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  getIncidentDetail,
);

router.patch(
  '/incidents/:id/status',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  updateIncidentStatus,
);

router.post(
  '/incidents/:id/responses',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  addIncidentResponse,
);

// Vehicle Movement Logs Routes (Phase 5)
router.get(
  '/movement-logs/export/csv',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  exportMovementLogsCsv,
);

router.get(
  '/movement-logs',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  getMovementLogs,
);

router.get(
  '/movement-logs/:id',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  requireActiveSecurityAssignment,
  getMovementLogDetail,
);

// ============================================================================
// SECURITY EMAILER (DIRECT COMMUNICATION TO ASSIGNED PARKING OWNER)
// ============================================================================
router.get(
  '/emailer/recipient-owner',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  (req, res, next) => {
    securityEmailerController.getAssignedOwners(req, res).catch(next);
  },
);

router.post(
  '/emailer/send',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  (req, res, next) => {
    securityEmailerController.sendEmailToOwner(req, res).catch(next);
  },
);

router.get(
  '/emailer/history',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  (req, res, next) => {
    securityEmailerController.getHistory(req, res).catch(next);
  },
);

// ============================================================================
// SECURITY 2D LIVE PARKING LAYOUT VIEWER
// ============================================================================
router.get(
  '/live-viewer/facilities',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  (req, res, next) => {
    securityLiveViewerController.getAssignedFacilities(req, res).catch(next);
  },
);

router.get(
  '/live-viewer/layout',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  (req, res, next) => {
    securityLiveViewerController.getLiveFloorLayout(req, res).catch(next);
  },
);

router.get(
  '/live-viewer/slot-details',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  (req, res, next) => {
    securityLiveViewerController.getSlotDetails(req, res).catch(next);
  },
);

router.patch(
  '/live-viewer/slots/:slotId/status',
  requireAuth,
  requireRole('SECURITY', 'ADMIN'),
  (req, res, next) => {
    securityLiveViewerController.updateSlotStatus(req, res).catch(next);
  },
);

export default router;

