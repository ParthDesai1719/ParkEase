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
  getIncidents,
  getIncidentDetail,
  createIncident,
  updateIncidentStatus,
  uploadIncidentImages,
  getIncidentImageFile,
  getMovementLogs,
  getMovementLogDetail,
  exportMovementLogsCsv,
} from '../controllers/security.controller.js';

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

export default router;

