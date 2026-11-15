import { Router } from 'express';
import {
  approveFacilitySubmission,
  approveOwnerApplication,
  getAdminFacilityFile,
  getDashboardOverview,
  getFacilitySubmissionById,
  getFacilitySubmissions,
  getOwnerApplicationById,
  getOwnerApplicationDocument,
  getOwnerApplications,
  rejectFacilitySubmission,
  rejectOwnerApplication,
  requestFacilityChanges,
  startFacilityReview,
  updateFacilityRemarks,
  updateOwnerApplicationRemarks,
} from '../controllers/admin.controller.js';
import { requireAuth, requirePermission, requireRole } from '../middleware/auth.js';

const router = Router();

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
  '/owner-applications/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('OWNER_APPLICATION_VIEW'),
  getOwnerApplicationById,
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

export default router;
