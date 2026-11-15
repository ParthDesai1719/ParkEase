import { Router } from 'express';
import {
  createOfficialParkingLot,
  getEligibleSubmissions,
  getOfficialParkingLotById,
  getOfficialParkingLotHierarchy,
  getOfficialParkingLots,
} from '../controllers/parkingLot.controller.js';
import {
  discardDraftLayoutHandler,
  getFloorLayoutHandler,
  initDraftLayoutHandler,
  publishDraftLayoutHandler,
  removeLayoutElementHandler,
  saveLayoutElementsHandler,
  validateDraftLayoutHandler,
  replicateLaneNetworkHandler,
  updateCanvasBoundaryHandler,
  activateFacilityHandler,
} from '../controllers/parkingLayout.controller.js';
import { requireAuth, requirePermission, requireRole } from '../middleware/auth.js';

const router = Router();

// 1. Retrieve approved facility submissions eligible for official Parking Lot creation
router.get(
  '/eligible-submissions',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  getEligibleSubmissions,
);

// 2. Convert an approved facility submission into an official Parking Lot with Floors, Zones, and Slots
router.post(
  '/from-submission/:submissionId',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  createOfficialParkingLot,
);

// 3. List official parking lots (paginated, with search & status filters)
router.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  getOfficialParkingLots,
);

// 4. Retrieve single official parking lot details
router.get(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  getOfficialParkingLotById,
);

// 5. Retrieve complete official structural hierarchy (Lot -> Floors -> Zones -> Slots)
router.get(
  '/:id/hierarchy',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  getOfficialParkingLotHierarchy,
);

// 6. 2D Layout Designer Endpoints (Administrator Controlled)
router.get(
  '/:id/floors/:floorId/layout',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  getFloorLayoutHandler,
);

router.post(
  '/:id/floors/:floorId/layout/init-draft',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  initDraftLayoutHandler,
);

router.put(
  '/:id/floors/:floorId/layout/elements',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  saveLayoutElementsHandler,
);

router.delete(
  '/:id/floors/:floorId/layout/elements/:elementId',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  removeLayoutElementHandler,
);

router.post(
  '/:id/floors/:floorId/layout/validate',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  validateDraftLayoutHandler,
);

router.post(
  '/:id/floors/:floorId/layout/publish',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  publishDraftLayoutHandler,
);

router.post(
  '/:id/floors/:floorId/layout/replicate-lanes',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  replicateLaneNetworkHandler,
);

router.patch(
  '/:id/layout/canvas-boundary',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  updateCanvasBoundaryHandler,
);

router.post(
  '/:id/activate',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  activateFacilityHandler,
);

router.delete(
  '/:id/floors/:floorId/layout/draft',
  requireAuth,
  requireRole('ADMIN'),
  requirePermission('PARKING_MANAGE'),
  discardDraftLayoutHandler,
);

export default router;

