import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ParkingLotModel } from '../models/ParkingLot.js';
import { ParkingFloorModel } from '../models/ParkingFloor.js';
import { ParkingSlotModel } from '../models/ParkingSlot.js';
import { ParkingLayoutModel } from '../models/ParkingLayout.js';
import { BookingModel } from '../models/Booking.js';
import { BarrierReaderModel } from '../models/BarrierReader.js';
import { BarrierEventModel } from '../models/BarrierEvent.js';
import { barrierService } from '../services/barrier.service.js';
import { customerBookingService } from '../services/customerBooking.service.js';
import { AppError } from '../utils/AppError.js';

export async function getSimulatorFacilities(_req: Request, res: Response): Promise<void> {
  const lots = await (ParkingLotModel as any).find({
    $or: [
      { parkingStatus: { $ne: 'Inactive' } },
      { parkingStatus: { $exists: false } },
      { status: 'Active' },
      { isPublished: true },
      { isActive: true },
    ],
  })
    .select('_id parkingName address city location totalCapacity totalSlots availableSlots')
    .sort({ parkingName: 1 })
    .lean()
    .exec();

  res.status(200).json({
    success: true,
    data: { facilities: lots },
  });
}

export async function getFacilityLayoutAndState(req: Request, res: Response): Promise<void> {
  const parkingLotId = req.params['parkingLotId'] as string;
  if (!parkingLotId || !mongoose.isValidObjectId(parkingLotId)) {
    throw new AppError('Invalid parkingLotId.', 400, 'INVALID_LOT_ID');
  }

  const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);
  const lot = await (ParkingLotModel as any).findById(lotObjectId).lean().exec();
  if (!lot) {
    throw new AppError('Parking facility not found.', 404, 'FACILITY_NOT_FOUND');
  }

  // Reconcile booking statuses (No-Show & Overstay) and ensure readers exist
  try {
    await customerBookingService.reconcileBookingStatuses();
  } catch {
    // Non-blocking
  }
  await barrierService.ensureFacilityReaders(parkingLotId);

  // Load floors
  const floors = await (ParkingFloorModel as any).find({ parkingLotId: lotObjectId })
    .sort({ floorNumber: 1 })
    .lean()
    .exec();

  // Load published layouts for all floors
  let layouts = await (ParkingLayoutModel as any).find({
    parkingLotId: lotObjectId,
    $or: [{ status: 'Published' }, { isPublished: true }],
  })
    .lean()
    .exec();

  if (!layouts || layouts.length === 0) {
    layouts = await (ParkingLayoutModel as any).find({ parkingLotId: lotObjectId })
      .lean()
      .exec();
  }

  // Load official slots with live statuses
  const slots = await (ParkingSlotModel as any).find({ parkingLotId: lotObjectId })
    .populate('currentBookingId', 'bookingReference bookingStatus customerId vehicleId scheduledExitTime')
    .sort({ slotNumber: 1 })
    .lean()
    .exec();

  // If no visual layout document exists in DB, synthesize one for each floor from its slots & gates
  if ((!layouts || layouts.length === 0) && slots.length > 0) {
    const floorList = floors.length > 0 ? floors : [{ _id: new mongoose.Types.ObjectId(), floorName: 'Ground Floor' }];
    layouts = floorList.map((floor: any) => {
      const floorSlots = slots.filter((s: any) => String(s.floorId) === String(floor._id));
      const slotsToUse = floorSlots.length > 0 ? floorSlots : (floors.length === 1 ? slots : []);

      const syntheticElements: any[] = [
        {
          elementId: `SIM-ENTRANCE-GATE-${floor._id}`,
          elementType: 'Entrance',
          x: 60,
          y: 200,
          width: 120,
          height: 60,
          rotation: 0,
          zIndex: 5,
          label: `${floor.floorName || 'Floor'} Entrance Gate`,
        },
        {
          elementId: `SIM-EXIT-GATE-${floor._id}`,
          elementType: 'Exit',
          x: 60,
          y: 320,
          width: 120,
          height: 60,
          rotation: 0,
          zIndex: 5,
          label: `${floor.floorName || 'Floor'} Exit Gate`,
        },
        {
          elementId: `SIM-MAIN-LANE-${floor._id}`,
          elementType: 'DrivingLane',
          x: 220,
          y: 80,
          width: 140,
          height: Math.max(500, Math.ceil(Math.max(slotsToUse.length, 1) / 2) * 110 + 100),
          rotation: 0,
          zIndex: 2,
          laneDirection: 'Two-Way',
          label: 'Central Driving Lane',
        },
      ];

      slotsToUse.forEach((s: any, idx: number) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = col === 0 ? 400 : 540;
        const y = 100 + row * 110;

        syntheticElements.push({
          elementId: `slot-el-${s._id}`,
          elementType: 'ParkingSlot',
          slotId: s._id.toString(),
          slotNumber: s.slotNumber,
          x,
          y,
          width: 100,
          height: 90,
          rotation: 0,
          zIndex: 10,
          label: `Bay ${s.slotNumber}`,
        });
      });

      return {
        _id: new mongoose.Types.ObjectId(),
        parkingLotId: lotObjectId,
        floorId: floor._id,
        status: 'Published',
        canvasConfig: {
          width: 1400,
          height: 900,
          gridSize: 20,
          snapToGrid: false,
          backgroundColor: '#090d16',
        },
        elements: syntheticElements,
      };
    });
  }

  // Load readers and live barrier states
  const readers = await (BarrierReaderModel as any).find({ parkingLotId: lotObjectId })
    .lean()
    .exec();

  res.status(200).json({
    success: true,
    data: {
      facility: lot,
      floors,
      layouts,
      slots,
      readers,
      acceleratedTimerMultiplier: barrierService.getAcceleratedTimerMultiplier(),
    },
  });
}

export async function getFacilityBookings(req: Request, res: Response): Promise<void> {
  const parkingLotId = req.params['parkingLotId'] as string;
  if (!parkingLotId || !mongoose.isValidObjectId(parkingLotId)) {
    throw new AppError('Invalid parkingLotId.', 400, 'INVALID_LOT_ID');
  }

  const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);

  try {
    await customerBookingService.reconcileBookingStatuses();
  } catch {
    // Non-blocking
  }

  // Return ONLY active, upcoming (Confirmed), or overstay bookings that have NOT passed the exit gate
  const bookings = await (BookingModel as any).find({
    parkingLotId: lotObjectId,
    bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
    actualExitTime: null,
  })
    .populate('customerId', 'fullName email mobileNumber')
    .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel licensePlate')
    .populate('currentSlotId', 'slotNumber slotType')
    .populate('originalSlotId', 'slotNumber')
    .populate('floorId', 'floorName')
    .sort({ scheduledEntryTime: 1 })
    .lean()
    .exec();

  res.status(200).json({
    success: true,
    data: { bookings: bookings || [] },
  });
}

export async function scanQrAtReader(req: Request, res: Response): Promise<void> {
  const { parkingLotId, readerId, qrPayload, source = 'SIMULATOR' } = req.body;
  if (!parkingLotId || !readerId || !qrPayload) {
    throw new AppError('parkingLotId, readerId, and qrPayload are required.', 400, 'MISSING_FIELDS');
  }

  const result = await barrierService.scanQrAndAuthorize({
    parkingLotId,
    readerId,
    qrPayload,
    source,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function confirmVehiclePassage(req: Request, res: Response): Promise<void> {
  const { parkingLotId, readerId, bookingId, direction, source = 'SIMULATOR' } = req.body;
  if (!parkingLotId || !readerId || !bookingId || !direction) {
    throw new AppError('parkingLotId, readerId, bookingId, and direction are required.', 400, 'MISSING_FIELDS');
  }

  const result = await barrierService.confirmVehiclePassage({
    parkingLotId,
    readerId,
    bookingId,
    direction,
    source,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function sendBarrierCommand(req: Request, res: Response): Promise<void> {
  const { readerId, command, source = 'SIMULATOR' } = req.body;
  if (!readerId || !command || (command !== 'OPEN' && command !== 'CLOSE')) {
    throw new AppError('readerId and valid command (OPEN|CLOSE) are required.', 400, 'INVALID_COMMAND');
  }

  const updatedReader = await barrierService.sendBarrierCommand(readerId, command, source);

  res.status(200).json({
    success: true,
    data: { reader: updatedReader },
  });
}

export async function setSafetyObstruction(req: Request, res: Response): Promise<void> {
  const { readerId, isObstructed } = req.body;
  if (!readerId || typeof isObstructed !== 'boolean') {
    throw new AppError('readerId and isObstructed (boolean) are required.', 400, 'INVALID_FIELDS');
  }

  await barrierService.setReaderObstruction(readerId, isObstructed);

  res.status(200).json({
    success: true,
    data: { readerId, isObstructed },
  });
}

export async function forceAutoCloseBay(req: Request, res: Response): Promise<void> {
  const { readerId, parkingLotId } = req.body;
  if (!readerId) {
    throw new AppError('readerId is required.', 400, 'READER_REQUIRED');
  }

  const closed = await barrierService.forceAutoCloseBay(readerId, parkingLotId);

  res.status(200).json({
    success: true,
    data: { readerId, closed },
  });
}

export async function setAcceleratedTimer(req: Request, res: Response): Promise<void> {
  const { multiplier } = req.body;
  const num = Number(multiplier);
  if (!num || num < 1) {
    throw new AppError('multiplier must be a positive number.', 400, 'INVALID_MULTIPLIER');
  }

  barrierService.setAcceleratedTimerMultiplier(num);

  res.status(200).json({
    success: true,
    data: { multiplier: barrierService.getAcceleratedTimerMultiplier() },
  });
}

export async function getBarrierEvents(req: Request, res: Response): Promise<void> {
  const parkingLotId = req.params['parkingLotId'] as string;
  if (!parkingLotId || !mongoose.isValidObjectId(parkingLotId)) {
    throw new AppError('Invalid parkingLotId.', 400, 'INVALID_LOT_ID');
  }
  const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);

  const events = await (BarrierEventModel as any).find({ parkingLotId: lotObjectId })
    .sort({ timestamp: -1 })
    .limit(100)
    .lean()
    .exec();

  res.status(200).json({
    success: true,
    data: { events },
  });
}

export async function simulateOverstayScenario(req: Request, res: Response): Promise<void> {
  const { parkingLotId, mode } = req.body; // mode: 'WITH_REPLACEMENT' | 'WITHOUT_REPLACEMENT'
  if (!parkingLotId) {
    throw new AppError('parkingLotId is required.', 400, 'MISSING_LOT_ID');
  }
  const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);

  // Find two slots or one slot
  const slots = await (ParkingSlotModel as any).find({ parkingLotId: lotObjectId }).limit(5).exec();
  if (slots.length === 0) {
    throw new AppError('Facility has no slots.', 400, 'NO_SLOTS');
  }

  const slotA = slots[0];
  // 1. Mark Slot A as Occupied by an Overstay booking
  slotA.slotStatus = 'Occupied';
  await slotA.save();

  // If WITHOUT_REPLACEMENT, mark other slots as Maintenance/Occupied to simulate 100% capacity
  if (mode === 'WITHOUT_REPLACEMENT') {
    for (let i = 1; i < slots.length; i++) {
      slots[i].slotStatus = 'Under Maintenance';
      await slots[i].save();
    }
  } else {
    // Ensure slot 1 is Available for replacement
    if (slots.length > 1) {
      slots[1].slotStatus = 'Available';
      slots[1].currentBookingId = null;
      await slots[1].save();
    }
  }

  res.status(200).json({
    success: true,
    data: {
      message: `Simulated overstay scenario (${mode}) prepared. Slot ${slotA.slotNumber} is Occupied by an overstay vehicle.`,
      occupiedSlotNumber: slotA.slotNumber,
      mode,
    },
  });
}
