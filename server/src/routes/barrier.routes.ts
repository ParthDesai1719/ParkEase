import { Router } from 'express';
import {
  getSimulatorFacilities,
  getFacilityLayoutAndState,
  getFacilityBookings,
  scanQrAtReader,
  confirmVehiclePassage,
  sendBarrierCommand,
  setSafetyObstruction,
  forceAutoCloseBay,
  setAcceleratedTimer,
  getBarrierEvents,
  simulateOverstayScenario,
} from '../controllers/barrier.controller.js';

const router = Router();

// Standalone Simulator APIs & Hardware Controller Integration
// Allows direct access in local development / simulated mode
router.get('/facilities', getSimulatorFacilities);
router.get('/facilities/:parkingLotId/layout', getFacilityLayoutAndState);
router.get('/facilities/:parkingLotId/bookings', getFacilityBookings);
router.get('/facilities/:parkingLotId/events', getBarrierEvents);

router.post('/scan', scanQrAtReader);
router.post('/confirm-passage', confirmVehiclePassage);
router.post('/command', sendBarrierCommand);
router.post('/safety-obstruction', setSafetyObstruction);
router.post('/force-auto-close', forceAutoCloseBay);
router.post('/timer/accelerate', setAcceleratedTimer);
router.post('/simulate-overstay-scenario', simulateOverstayScenario);

export default router;
