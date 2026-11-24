import mongoose from 'mongoose';
import '../models/index.js';
import {
  BookingModel,
} from '../models/Booking.js';
import {
  ParkingSlotModel,
} from '../models/ParkingSlot.js';
import {
  ParkingLotModel,
} from '../models/ParkingLot.js';
import {
  VehicleMovementLogModel,
} from '../models/VehicleMovementLog.js';
import { BookingTimelineModel } from '../models/BookingTimeline.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { PaymentModel } from '../models/Payment.js';
import { NotificationModel } from '../models/Notification.js';
import {
  BarrierReaderModel,
  type BarrierReader,
} from '../models/BarrierReader.js';
import {
  BarrierEventModel,
} from '../models/BarrierEvent.js';
import {
  emitSlotStatusUpdate,
  emitBookingStatusUpdate,
  emitLiveVehicleUpdate,
  getIO,
} from '../socket.js';
import { AppError } from '../utils/AppError.js';
import { customerBookingService } from './customerBooking.service.js';
import { emailService } from './email.service.js';

export interface IBarrierController {
  openBarrier(reader: BarrierReader): Promise<{ success: boolean; acknowledgedAt: Date; error?: string }>;
  closeBarrier(reader: BarrierReader): Promise<{ success: boolean; acknowledgedAt: Date; error?: string }>;
  getBarrierState(readerId: string): Promise<string>;
}

export class SimulatedBarrierController implements IBarrierController {
  public async openBarrier(_reader: BarrierReader): Promise<{ success: boolean; acknowledgedAt: Date; error?: string }> {
    return {
      success: true,
      acknowledgedAt: new Date(),
    };
  }

  public async closeBarrier(reader: BarrierReader): Promise<{ success: boolean; acknowledgedAt: Date; error?: string }> {
    if (reader.isObstructed) {
      return {
        success: false,
        acknowledgedAt: new Date(),
        error: 'OBSTRUCTION_DETECTED: Safety sensor reports object in barrier path.',
      };
    }
    return {
      success: true,
      acknowledgedAt: new Date(),
    };
  }

  public async getBarrierState(readerId: string): Promise<string> {
    const r = await (BarrierReaderModel as any).findOne({ readerId }).lean().exec();
    return r?.barrierState || 'CLOSED';
  }
}

export interface BarrierScanInput {
  parkingLotId: string;
  readerId: string;
  qrPayload: string;
  source?: 'SIMULATOR' | 'PHYSICAL_CONTROLLER';
}

export interface BarrierPassageInput {
  parkingLotId: string;
  readerId: string;
  bookingId: string;
  direction: 'IN' | 'OUT';
  source?: 'SIMULATOR' | 'PHYSICAL_CONTROLLER';
}

export interface BarrierScanResult {
  authorized: boolean;
  action: 'ENTRY' | 'BAY_ENTRY' | 'BAY_DEPARTURE' | 'EXIT' | 'NONE';
  readerId: string;
  readerType: 'ENTRY' | 'SLOT' | 'EXIT';
  barrierState: string;
  message: string;
  errorCode?: string;
  booking?: {
    _id: string;
    bookingReference: string;
    bookingStatus: string;
    customerId: string;
    vehicleNumber?: string;
    currentSlotId?: string;
    currentSlotNumber?: string;
    originalSlotNumber?: string;
    isReassigned?: boolean;
    reassignmentReason?: string;
  };
  assignedSlot?: {
    slotId: string;
    slotNumber: string;
    slotType?: string;
    floorName?: string;
    zoneCode?: string;
  };
  overstayInfo?: {
    isOverstay: boolean;
    unpaidOverstayCharge: number;
  };
}

export class BarrierService {
  private controller: IBarrierController;
  private autoCloseCheckInterval: NodeJS.Timeout | null = null;
  private acceleratedTimerMultiplier: number = 1;

  constructor(controller?: IBarrierController) {
    this.controller = controller || new SimulatedBarrierController();
    this.startAutoCloseEngine();
  }

  /**
   * Starts background server-authoritative loop for 5-minute auto-closure of bay barriers.
   * Runs every 3 seconds to check overdue deadlines.
   */
  private startAutoCloseEngine(): void {
    if (this.autoCloseCheckInterval) return;
    let tickCount = 0;
    this.autoCloseCheckInterval = setInterval(async () => {
      try {
        if (mongoose.connection.readyState === 1) {
          await this.processOverdueAutoClosures();
          tickCount++;
          if (tickCount % 5 === 0) {
            await customerBookingService.reconcileBookingStatuses();
          }
        }
      } catch (err) {
        console.error('[BarrierService] Auto-close check error:', err);
      }
    }, 1000);
  }

  public setAcceleratedTimerMultiplier(multiplier: number): void {
    this.acceleratedTimerMultiplier = Math.max(1, multiplier);
  }

  public getAcceleratedTimerMultiplier(): number {
    return this.acceleratedTimerMultiplier;
  }

  public parseQrPayload(raw: string): {
    bookingReference?: string;
    slotQrIdentifier?: string;
    token?: string;
    rawPayload: string;
  } {
    const trimmed = (raw || '').trim();
    if (trimmed.startsWith('PE-PASS|')) {
      const parts = trimmed.split('|');
      const res: {
        bookingReference?: string;
        slotQrIdentifier?: string;
        token?: string;
        rawPayload: string;
      } = { rawPayload: trimmed };
      if (parts[1]) res.bookingReference = parts[1];
      if (parts[2]) res.slotQrIdentifier = parts[2];
      if (parts[3]) res.token = parts[3];
      return res;
    }
    return {
      bookingReference: trimmed,
      rawPayload: trimmed,
    };
  }

  public async ensureFacilityReaders(parkingLotId: string): Promise<BarrierReader[]> {
    if (!mongoose.isValidObjectId(parkingLotId)) {
      throw new AppError('Invalid parkingLotId.', 400, 'INVALID_LOT_ID');
    }
    const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);

    // 1. Entry Gate
    await (BarrierReaderModel as any).findOneAndUpdate(
      { parkingLotId: lotObjectId, readerType: 'ENTRY' },
      {
        $setOnInsert: {
          readerId: 'ENTRY-GATE-01',
          readerType: 'ENTRY',
          parkingLotId: lotObjectId,
          barrierState: 'CLOSED',
          isActive: true,
          lastEvent: 'INITIALIZED',
          lastEventAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    // 2. Exit Gate
    await (BarrierReaderModel as any).findOneAndUpdate(
      { parkingLotId: lotObjectId, readerType: 'EXIT' },
      {
        $setOnInsert: {
          readerId: 'EXIT-GATE-01',
          readerType: 'EXIT',
          parkingLotId: lotObjectId,
          barrierState: 'CLOSED',
          isActive: true,
          lastEvent: 'INITIALIZED',
          lastEventAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    // 3. Bay Readers for all official ParkingSlots
    const slots = await (ParkingSlotModel as any)
      .find({ parkingLotId: lotObjectId })
      .lean()
      .exec();

    for (const slot of slots) {
      const readerId = `SLOT-${slot.slotNumber}-READER`;
      await (BarrierReaderModel as any).findOneAndUpdate(
        { parkingLotId: lotObjectId, slotId: slot._id },
        {
          $setOnInsert: {
            readerId,
            readerType: 'SLOT',
            parkingLotId: lotObjectId,
            floorId: slot.floorId,
            slotId: slot._id,
            slotNumber: slot.slotNumber,
            barrierState: 'CLOSED',
            isActive: true,
            lastEvent: 'INITIALIZED',
            lastEventAt: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
    }

    return (BarrierReaderModel as any).find({ parkingLotId: lotObjectId }).lean().exec();
  }

  public async scanQrAndAuthorize(input: BarrierScanInput): Promise<BarrierScanResult> {
    const { parkingLotId, readerId, qrPayload, source = 'SIMULATOR' } = input;
    if (!qrPayload || !readerId || !parkingLotId) {
      throw new AppError('parkingLotId, readerId, and qrPayload are required.', 400, 'MISSING_FIELDS');
    }

    const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);

    // 1. Load reader configuration
    let reader = await (BarrierReaderModel as any).findOne({ readerId, parkingLotId: lotObjectId }).exec();
    if (!reader) {
      await this.ensureFacilityReaders(parkingLotId);
      reader = await (BarrierReaderModel as any).findOne({ readerId, parkingLotId: lotObjectId }).exec();
      if (!reader) {
        throw new AppError(`Reader "${readerId}" not registered for this facility.`, 404, 'READER_NOT_FOUND');
      }
    }

    // 2. Decode QR and find matching booking
    const parsed = this.parseQrPayload(qrPayload);
    const booking = await (BookingModel as any)
      .findOne({
        $or: [
          { qrCode: parsed.rawPayload },
          ...(parsed.bookingReference ? [{ bookingReference: parsed.bookingReference }] : []),
        ],
      })
      .populate('customerId')
      .populate('vehicleId')
      .populate('currentSlotId')
      .populate('originalSlotId')
      .populate('floorId')
      .populate('zoneId')
      .exec();

    if (!booking) {
      await this.recordBarrierEvent({
        readerId,
        readerType: reader.readerType,
        parkingLotId: lotObjectId,
        eventType: 'QR_VALIDATION_REQUESTED',
        eventOutcome: 'DENIED',
        source,
        details: { reason: 'No matching booking found for scanned QR code.' },
      });
      return {
        authorized: false,
        action: 'NONE',
        readerId,
        readerType: reader.readerType,
        barrierState: reader.barrierState,
        message: 'Invalid QR code. No active or confirmed booking pass found.',
        errorCode: 'INVALID_QR_CODE',
      };
    }

    // Verify facility scope
    if (booking.parkingLotId.toString() !== lotObjectId.toString()) {
      await this.recordBarrierEvent({
        readerId,
        readerType: reader.readerType,
        parkingLotId: lotObjectId,
        bookingId: booking._id,
        eventType: 'QR_VALIDATION_REQUESTED',
        eventOutcome: 'DENIED',
        source,
        details: { reason: 'QR booking registered for different parking lot.' },
      });
      return {
        authorized: false,
        action: 'NONE',
        readerId,
        readerType: reader.readerType,
        barrierState: reader.barrierState,
        message: 'Wrong Parking Facility. This pass belongs to another location.',
        errorCode: 'WRONG_PARKING_LOT',
      };
    }

    if (reader.readerType === 'ENTRY') {
      return this.processMainEntryScan(booking, reader, source);
    }

    if (reader.readerType === 'SLOT') {
      return this.processBayScan(booking, reader, source);
    }

    if (reader.readerType === 'EXIT') {
      return this.processMainExitScan(booking, reader, source);
    }

    return {
      authorized: false,
      action: 'NONE',
      readerId,
      readerType: reader.readerType,
      barrierState: reader.barrierState,
      message: 'Unknown reader type.',
      errorCode: 'UNKNOWN_READER_TYPE',
    };
  }

  private async processMainEntryScan(
    booking: any,
    reader: any,
    source: 'SIMULATOR' | 'PHYSICAL_CONTROLLER',
  ): Promise<BarrierScanResult> {
    const lotObjectId = booking.parkingLotId;

    if (booking.bookingStatus === 'Completed' || booking.bookingStatus === 'Cancelled') {
      await this.recordBarrierEvent({
        readerId: reader.readerId,
        readerType: 'ENTRY',
        parkingLotId: lotObjectId,
        bookingId: booking._id,
        eventType: 'BAY_ENTRY_DENIED',
        eventOutcome: 'DENIED',
        source,
        details: { reason: `Booking is already ${booking.bookingStatus}.` },
      });
      return {
        authorized: false,
        action: 'ENTRY',
        readerId: reader.readerId,
        readerType: 'ENTRY',
        barrierState: reader.barrierState,
        message: `Entry Denied: Booking is ${booking.bookingStatus}.`,
        errorCode: 'INELIGIBLE_BOOKING_STATUS',
      };
    }

    if (booking.bookingStatus === 'Active') {
      const fiveMinutesMs = (5 * 60 * 1000) / this.acceleratedTimerMultiplier;
      reader.barrierState = 'OPEN';
      reader.barrierOpenedAt = new Date();
      reader.autoCloseTimerActive = true;
      reader.autoCloseDeadline = new Date(Date.now() + fiveMinutesMs);
      reader.lastEvent = 'BARRIER_OPENED';
      reader.lastEventAt = new Date();
      reader.activeBookingId = booking._id;
      await reader.save();
      this.broadcastBarrierUpdate(lotObjectId.toString(), reader.readerId, 'OPEN');

      return {
        authorized: true,
        action: 'ENTRY',
        readerId: reader.readerId,
        readerType: 'ENTRY',
        barrierState: 'OPEN',
        message: 'Vehicle entry already authorized. Proceed to your assigned bay.',
        booking: this.formatBookingSummary(booking),
        assignedSlot: this.formatSlotSummary(booking.currentSlotId),
      };
    }

    // 1. OVERSTAY CONFLICT CHECK ON CURRENT ASSIGNED SLOT
    const currentSlot = await (ParkingSlotModel as any).findById(booking.currentSlotId?._id || booking.currentSlotId).exec();

    let slotHasOverstayConflict = false;
    if (currentSlot && currentSlot.slotStatus === 'Occupied') {
      slotHasOverstayConflict = true;
    }

    if (slotHasOverstayConflict) {
      const reassignmentResult = await this.resolveOverstaySlotConflict(booking, lotObjectId, source);
      if (!reassignmentResult.success) {
        return {
          authorized: false,
          action: 'ENTRY',
          readerId: reader.readerId,
          readerType: 'ENTRY',
          barrierState: 'CLOSED',
          message: reassignmentResult.message,
          errorCode: 'OVERSTAY_CONFLICT_CANCELLED_REFUNDED',
          booking: this.formatBookingSummary(reassignmentResult.booking || booking),
        };
      }
      booking = reassignmentResult.booking;
    }

    // 2. AUTHORIZE ENTRY
    const openRes = await this.controller.openBarrier(reader);
    if (!openRes.success) {
      return {
        authorized: false,
        action: 'ENTRY',
        readerId: reader.readerId,
        readerType: 'ENTRY',
        barrierState: 'ERROR',
        message: openRes.error || 'Barrier controller failed to open entry barrier.',
        errorCode: 'CONTROLLER_ERROR',
      };
    }

    const fiveMinutesMs = (5 * 60 * 1000) / this.acceleratedTimerMultiplier;
    reader.barrierState = 'OPEN';
    reader.barrierOpenedAt = new Date();
    reader.autoCloseTimerActive = true;
    reader.autoCloseDeadline = new Date(Date.now() + fiveMinutesMs);
    reader.lastEvent = 'BARRIER_OPENED';
    reader.lastEventAt = new Date();
    reader.activeBookingId = booking._id;
    await reader.save();

    booking.bookingStatus = 'Active';
    booking.actualEntryTime = new Date();
    await booking.save();

    await (VehicleMovementLogModel as any).findOneAndUpdate(
      { bookingId: booking._id },
      {
        $set: {
          bookingId: booking._id,
          customerId: booking.customerId?._id || booking.customerId,
          vehicleId: booking.vehicleId?._id || booking.vehicleId,
          parkingLotId: lotObjectId,
          floorId: booking.floorId?._id || booking.floorId,
          zoneId: booking.zoneId?._id || booking.zoneId,
          slotId: booking.currentSlotId?._id || booking.currentSlotId,
          entryMethod: 'QR Code',
          entryTime: new Date(),
          gracePeriodEndsAt: booking.gracePeriodEndsAt || new Date(Date.now() + 15 * 60 * 1000),
          movementStatus: 'Vehicle Inside',
          remarks: `Main entry verified via ${source}. Assigned bay: ${booking.currentSlotId?.slotNumber || ''}.`,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    await BookingTimelineModel.create({
      bookingId: booking._id,
      eventCode: 'VEHICLE_ENTERED',
      eventType: 'Vehicle Entered',
      eventTitle: 'Main Facility Entry Authorized',
      eventDescription: `Vehicle entered main barrier via ${source}. Proceeding to Bay ${booking.currentSlotId?.slotNumber || ''}.`,
      eventSource: 'System',
      eventTime: new Date(),
    });

    await AuditLogModel.create({
      actionCode: 'ENTRY_GATE_AUTHORIZED',
      module: 'Security',
      actionTitle: 'Main Facility Entry Authorized',
      description: `Vehicle entry barrier opened for booking ${booking.bookingReference} via ${source}.`,
      bookingId: booking._id,
      parkingLotId: lotObjectId,
      targetCollection: 'Booking',
      targetDocumentId: booking._id,
    });

    await this.recordBarrierEvent({
      readerId: reader.readerId,
      readerType: 'ENTRY',
      parkingLotId: lotObjectId,
      slotId: booking.currentSlotId?._id || booking.currentSlotId,
      bookingId: booking._id,
      eventType: 'BARRIER_OPEN_COMMAND',
      eventOutcome: 'GRANTED',
      source,
      details: { bookingReference: booking.bookingReference },
    });

    // Explicitly maintain Slot as 'Reserved' (Do NOT mark Occupied until customer arrives at the bay and scans!)
    const slotId = booking.currentSlotId?._id || booking.currentSlotId;
    await (ParkingSlotModel as any)
      .findByIdAndUpdate(slotId, {
        slotStatus: 'Reserved',
        currentBookingId: booking._id,
      })
      .exec();

    emitSlotStatusUpdate({
      parkingLotId: lotObjectId.toString(),
      floorId: booking.floorId?._id?.toString() || booking.floorId?.toString() || '',
      zoneId: booking.zoneId?._id?.toString() || booking.zoneId?.toString() || '',
      slotId: slotId.toString(),
      slotNumber: booking.currentSlotId?.slotNumber || '',
      slotStatus: 'Reserved',
      timestamp: new Date().toISOString(),
    });

    this.broadcastBarrierUpdate(lotObjectId.toString(), reader.readerId, 'OPEN');

    emitBookingStatusUpdate({
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      parkingLotId: lotObjectId.toString(),
      customerId: (booking.customerId?._id || booking.customerId)?.toString() || '',
      bookingStatus: 'Active',
      timestamp: new Date().toISOString(),
    });
    emitLiveVehicleUpdate({
      event: 'VEHICLE_ENTERED',
      bookingId: booking._id.toString(),
      parkingLotId: lotObjectId.toString(),
      vehicleNumber: booking.vehicleId?.licensePlate || booking.vehicleId?.vehicleNumber || 'Vehicle',
      timestamp: new Date().toISOString(),
    });

    return {
      authorized: true,
      action: 'ENTRY',
      readerId: reader.readerId,
      readerType: 'ENTRY',
      barrierState: 'OPEN',
      message:
        booking.slotReassignmentStatus === 'REASSIGNED'
          ? `Slot Reassigned: Original bay was occupied by an overstay vehicle. Entry authorized to new Bay ${booking.currentSlotId?.slotNumber}.`
          : `Main Entry Authorized. Please follow map directions to Bay ${booking.currentSlotId?.slotNumber}.`,
      booking: this.formatBookingSummary(booking),
      assignedSlot: this.formatSlotSummary(booking.currentSlotId),
    };
  }

  private async processBayScan(
    booking: any,
    reader: any,
    source: 'SIMULATOR' | 'PHYSICAL_CONTROLLER',
  ): Promise<BarrierScanResult> {
    const lotObjectId = booking.parkingLotId;
    const currentSlotIdStr = (booking.currentSlotId?._id || booking.currentSlotId).toString();
    const readerSlotIdStr = reader.slotId?.toString();

    // WRONG-SLOT PROTECTION
    if (!readerSlotIdStr || readerSlotIdStr !== currentSlotIdStr) {
      const correctSlotNum = booking.currentSlotId?.slotNumber || 'your designated bay';
      await this.recordBarrierEvent({
        readerId: reader.readerId,
        readerType: 'SLOT',
        parkingLotId: lotObjectId,
        slotId: reader.slotId,
        bookingId: booking._id,
        eventType: 'BAY_ENTRY_DENIED',
        eventOutcome: 'DENIED',
        source,
        details: {
          scannedReaderSlot: reader.slotNumber,
          correctAssignedSlot: correctSlotNum,
          reason: 'Wrong parking bay scanned.',
        },
      });

      return {
        authorized: false,
        action: 'BAY_ENTRY',
        readerId: reader.readerId,
        readerType: 'SLOT',
        barrierState: reader.barrierState,
        message: `Access Denied: Wrong Parking Bay. Your assigned slot is Bay ${correctSlotNum}.`,
        errorCode: 'WRONG_SLOT',
        assignedSlot: this.formatSlotSummary(booking.currentSlotId),
        booking: this.formatBookingSummary(booking),
      };
    }

    if (booking.bookingStatus !== 'Active' && booking.bookingStatus !== 'Overstay') {
      // Gate scan is mandatory first: a Confirmed booking cannot activate itself at the bay.
      return {
        authorized: false,
        action: 'BAY_ENTRY',
        readerId: reader.readerId,
        readerType: 'SLOT',
        barrierState: reader.barrierState,
        message: 'Please scan your pass at the main entry gate first before accessing your bay.',
        errorCode: 'ENTRY_NOT_RECORDED',
      };
    }

    const currentSlot = await (ParkingSlotModel as any).findById(reader.slotId).exec();

    // CASE 2: BAY_DEPARTURE (Vehicle is already parked inside the bay)
    const isVehicleParked = currentSlot?.slotStatus === 'Occupied';

    if (isVehicleParked) {
      const openRes = await this.controller.openBarrier(reader);
      if (!openRes.success) {
        return {
          authorized: false,
          action: 'BAY_DEPARTURE',
          readerId: reader.readerId,
          readerType: 'SLOT',
          barrierState: 'ERROR',
          message: openRes.error || 'Failed to open bay barrier for departure.',
          errorCode: 'CONTROLLER_ERROR',
        };
      }

      const fiveMinutesMs = (5 * 60 * 1000) / this.acceleratedTimerMultiplier;
      reader.barrierState = 'OPEN';
      reader.barrierOpenedAt = new Date();
      reader.autoCloseTimerActive = true;
      reader.autoCloseDeadline = new Date(Date.now() + fiveMinutesMs);
      reader.activeBookingId = booking._id;
      reader.lastEvent = 'BAY_DEPARTURE_AUTHORIZED';
      reader.lastEventAt = new Date();
      await reader.save();

      await this.recordBarrierEvent({
        readerId: reader.readerId,
        readerType: 'SLOT',
        parkingLotId: lotObjectId,
        slotId: reader.slotId,
        bookingId: booking._id,
        eventType: 'BAY_DEPARTURE_AUTHORIZED',
        eventOutcome: 'GRANTED',
        source,
        details: { slotNumber: reader.slotNumber, autoCloseCancelled: true },
      });

      await BookingTimelineModel.create({
        bookingId: booking._id,
        eventCode: 'VEHICLE_EXITED',
        eventType: 'Vehicle Exited',
        eventTitle: `Bay ${reader.slotNumber} Departure Authorized`,
        eventDescription: `Customer scanned at bay to depart. Barrier opened. Slot remains protected until main exit.`,
        eventSource: 'System',
        eventTime: new Date(),
      });

      this.broadcastBarrierUpdate(lotObjectId.toString(), reader.readerId, 'OPEN');

      return {
        authorized: true,
        action: 'BAY_DEPARTURE',
        readerId: reader.readerId,
        readerType: 'SLOT',
        barrierState: 'OPEN',
        message: `Bay ${reader.slotNumber} Departure Authorized. Drive out safely toward the main exit gate.`,
        assignedSlot: this.formatSlotSummary(booking.currentSlotId),
        booking: this.formatBookingSummary(booking),
      };
    }

    // CASE 1: BAY_ENTRY (Slot Reserved / Available)
    if (!currentSlot || currentSlot.slotStatus === 'Reserved' || currentSlot.slotStatus === 'Available') {
      const openRes = await this.controller.openBarrier(reader);
      if (!openRes.success) {
        return {
          authorized: false,
          action: 'BAY_ENTRY',
          readerId: reader.readerId,
          readerType: 'SLOT',
          barrierState: 'ERROR',
          message: openRes.error || 'Failed to open bay barrier.',
          errorCode: 'CONTROLLER_ERROR',
        };
      }

      const fiveMinutesMs = (5 * 60 * 1000) / this.acceleratedTimerMultiplier;
      const autoCloseDeadline = new Date(Date.now() + fiveMinutesMs);

      reader.barrierState = 'OPEN';
      reader.barrierOpenedAt = new Date();
      reader.autoCloseTimerActive = true;
      reader.autoCloseDeadline = autoCloseDeadline;
      reader.activeBookingId = booking._id;
      reader.lastEvent = 'BAY_ENTRY_AUTHORIZED';
      reader.lastEventAt = new Date();
      await reader.save();

      await this.recordBarrierEvent({
        readerId: reader.readerId,
        readerType: 'SLOT',
        parkingLotId: lotObjectId,
        slotId: reader.slotId,
        bookingId: booking._id,
        eventType: 'BAY_ENTRY_AUTHORIZED',
        eventOutcome: 'GRANTED',
        source,
        details: { slotNumber: reader.slotNumber },
      });

      this.broadcastBarrierUpdate(lotObjectId.toString(), reader.readerId, 'OPEN');

      return {
        authorized: true,
        action: 'BAY_ENTRY',
        readerId: reader.readerId,
        readerType: 'SLOT',
        barrierState: 'OPEN',
        message: `Bay ${reader.slotNumber} Barrier Opened. Drive into the bay to confirm occupancy.`,
        assignedSlot: this.formatSlotSummary(booking.currentSlotId),
        booking: this.formatBookingSummary(booking),
      };
    }

    return {
      authorized: false,
      action: 'BAY_ENTRY',
      readerId: reader.readerId,
      readerType: 'SLOT',
      barrierState: reader.barrierState,
      message: 'Slot state does not permit access.',
      errorCode: 'SLOT_UNAVAILABLE',
    };
  }

  private async processMainExitScan(
    booking: any,
    reader: any,
    source: 'SIMULATOR' | 'PHYSICAL_CONTROLLER',
  ): Promise<BarrierScanResult> {
    const lotObjectId = booking.parkingLotId;

    if (booking.bookingStatus !== 'Active' && booking.bookingStatus !== 'Overstay') {
      return {
        authorized: false,
        action: 'EXIT',
        readerId: reader.readerId,
        readerType: 'EXIT',
        barrierState: reader.barrierState,
        message: `Exit Denied: Booking status is ${booking.bookingStatus}.`,
        errorCode: 'INELIGIBLE_STATUS',
      };
    }

    // Mandatory Bay Barrier Departure Scan Enforcement:
    // Customer must scan at their assigned bay barrier to move out the vehicle before scanning at the main exit gate.
    const slotId = booking.currentSlotId?._id || booking.currentSlotId;
    const bayReader = slotId
      ? await (BarrierReaderModel as any).findOne({ parkingLotId: lotObjectId, slotId }).lean().exec()
      : null;

    const hasBayDepartureEvent = await (BarrierEventModel as any).exists({
      bookingId: booking._id,
      eventType: { $in: ['BAY_DEPARTURE_AUTHORIZED', 'VEHICLE_PASSAGE_OUT_CONFIRMED'] },
      eventOutcome: { $in: ['GRANTED', 'SUCCESS'] },
    });

    const isBayDepartureRecordedOnReader =
      bayReader &&
      bayReader.activeBookingId?.toString() === booking._id.toString() &&
      (bayReader.lastEvent === 'BAY_DEPARTURE_AUTHORIZED' || bayReader.lastEvent === 'BAY_DEPARTURE_COMPLETED');

    if (!hasBayDepartureEvent && !isBayDepartureRecordedOnReader) {
      const slotNum = booking.currentSlotId?.slotNumber || 'Assigned Bay';
      await this.recordBarrierEvent({
        readerId: reader.readerId,
        readerType: 'EXIT',
        parkingLotId: lotObjectId,
        slotId,
        bookingId: booking._id,
        eventType: 'EXIT_DENIED',
        eventOutcome: 'DENIED',
        source,
        details: {
          reason: 'Bay barrier is still occupied; departure scan at bay barrier required first.',
          slotNumber: slotNum,
        },
      });
      return {
        authorized: false,
        action: 'EXIT',
        readerId: reader.readerId,
        readerType: 'EXIT',
        barrierState: reader.barrierState,
        message: `Can't complete the process as the barrier (Bay ${slotNum}) is still occupied. Please scan at the bay barrier first to move out the vehicle.`,
        errorCode: 'BAY_BARRIER_STILL_OCCUPIED',
        assignedSlot: this.formatSlotSummary(booking.currentSlotId),
        booking: this.formatBookingSummary(booking),
      };
    }

    // Check for pending cash extension payment
    const pendingCashPayment = await (PaymentModel as any).findOne({
      bookingId: booking._id,
      paymentMethod: 'CASH',
      paymentStatus: 'PENDING',
    }).exec();

    if (pendingCashPayment) {
      await this.recordBarrierEvent({
        readerId: reader.readerId,
        readerType: 'EXIT',
        parkingLotId: lotObjectId,
        bookingId: booking._id,
        eventType: 'EXIT_DENIED',
        eventOutcome: 'DENIED',
        source,
        details: { reason: 'Pending cash extension payment required.', amount: pendingCashPayment.amount },
      });
      return {
        authorized: false,
        action: 'EXIT',
        readerId: reader.readerId,
        readerType: 'EXIT',
        barrierState: reader.barrierState,
        message: `Exit Blocked: Outstanding extension cash payment of ₹${pendingCashPayment.amount} must be settled with Security Staff before exit.`,
        errorCode: 'EXTENSION_PAYMENT_PENDING',
        overstayInfo: { isOverstay: false, unpaidOverstayCharge: pendingCashPayment.amount },
      };
    }

    // Check overstay charges once scheduledExitTime (including any approved extensions) has elapsed
    let effectiveExitTime = new Date(booking.scheduledExitTime);
    if (Array.isArray(booking.extensions)) {
      for (const ext of booking.extensions) {
        if (ext && ext.newScheduledExitTime && ext.status !== 'FAILED' && ext.status !== 'CANCELLED') {
          const d = new Date(ext.newScheduledExitTime);
          if (!isNaN(d.getTime()) && d.getTime() > effectiveExitTime.getTime()) {
            effectiveExitTime = d;
          }
        }
      }
    }
    const isActuallyOverstay = Date.now() > effectiveExitTime.getTime();

    if (isActuallyOverstay || booking.bookingStatus === 'Overstay' || booking.overstayDetected) {
      const overstayMinutes = isActuallyOverstay
        ? Math.max(1, Math.ceil((Date.now() - effectiveExitTime.getTime()) / (60 * 1000)))
        : booking.overstayDurationMinutes || 1;
      const billableHours = Math.max(1, Math.ceil(overstayMinutes / 60));
      const ratePerHour = booking.overstayRateAtBooking || booking.parkingRateAtBooking || 50;
      const computedCharge = Math.max(booking.overstayCharge || 0, Math.round(billableHours * ratePerHour));

      if (
        booking.bookingStatus !== 'Overstay' ||
        !booking.overstayDetected ||
        booking.overstayCharge !== computedCharge ||
        booking.overstayDurationMinutes !== overstayMinutes
      ) {
        booking.bookingStatus = 'Overstay';
        booking.overstayDetected = true;
        booking.overstayStartedAt = booking.overstayStartedAt || effectiveExitTime;
        booking.overstayDurationMinutes = overstayMinutes;
        booking.overstayCharge = computedCharge;
        booking.additionalCharges = computedCharge;
        booking.totalAmount = (booking.baseAmount || 0) + (booking.platformBookingFee || 0) + computedCharge;
        await booking.save();
      }

      const settledOverstayPayment = await (PaymentModel as any)
        .findOne({
          bookingId: booking._id,
          paymentTypeCode: 'OVERSTAY',
          paymentStatus: 'SUCCESSFUL',
        })
        .lean()
        .exec();

      const isOverstaySettled = Boolean(booking.overstaySettled || settledOverstayPayment);

      if (!isOverstaySettled && computedCharge > 0) {
        await this.recordBarrierEvent({
          readerId: reader.readerId,
          readerType: 'EXIT',
          parkingLotId: lotObjectId,
          bookingId: booking._id,
          eventType: 'EXIT_PAYMENT_REQUIRED',
          eventOutcome: 'DENIED',
          source,
          details: { overstayCharge: computedCharge, overstayDurationMinutes: overstayMinutes },
        });
        return {
          authorized: false,
          action: 'EXIT',
          readerId: reader.readerId,
          readerType: 'EXIT',
          barrierState: reader.barrierState,
          message: `Exit Blocked: Unpaid overstay penalty of ₹${computedCharge} (${overstayMinutes} mins overstay). Please settle online or with Security Staff.`,
          errorCode: 'EXIT_PAYMENT_REQUIRED',
          overstayInfo: { isOverstay: true, unpaidOverstayCharge: computedCharge },
        };
      }
    }

    const openRes = await this.controller.openBarrier(reader);
    if (!openRes.success) {
      return {
        authorized: false,
        action: 'EXIT',
        readerId: reader.readerId,
        readerType: 'EXIT',
        barrierState: 'ERROR',
        message: openRes.error || 'Failed to open exit barrier.',
        errorCode: 'CONTROLLER_ERROR',
      };
    }

    const fiveMinutesMs = (5 * 60 * 1000) / this.acceleratedTimerMultiplier;
    reader.barrierState = 'OPEN';
    reader.barrierOpenedAt = new Date();
    reader.autoCloseTimerActive = true;
    reader.autoCloseDeadline = new Date(Date.now() + fiveMinutesMs);
    reader.activeBookingId = booking._id;
    reader.lastEvent = 'EXIT_AUTHORIZED';
    reader.lastEventAt = new Date();
    await reader.save();

    await this.recordBarrierEvent({
      readerId: reader.readerId,
      readerType: 'EXIT',
      parkingLotId: lotObjectId,
      bookingId: booking._id,
      eventType: 'EXIT_AUTHORIZED',
      eventOutcome: 'GRANTED',
      source,
      details: { bookingReference: booking.bookingReference },
    });

    this.broadcastBarrierUpdate(lotObjectId.toString(), reader.readerId, 'OPEN');

    return {
      authorized: true,
      action: 'EXIT',
      readerId: reader.readerId,
      readerType: 'EXIT',
      barrierState: 'OPEN',
      message: 'Main Exit Authorized. Drive out safely.',
      assignedSlot: this.formatSlotSummary(booking.currentSlotId),
      booking: this.formatBookingSummary(booking),
    };
  }

  public async confirmVehiclePassage(input: BarrierPassageInput): Promise<{ success: boolean; message: string }> {
    const { parkingLotId, readerId, bookingId, direction, source = 'SIMULATOR' } = input;
    const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);

    const reader = await (BarrierReaderModel as any).findOne({ readerId, parkingLotId: lotObjectId }).exec();
    if (!reader) {
      throw new AppError(`Reader "${readerId}" not found.`, 404, 'READER_NOT_FOUND');
    }

    const booking = await (BookingModel as any)
      .findById(bookingId)
      .populate('currentSlotId')
      .populate('vehicleId')
      .exec();

    if (!booking) {
      throw new AppError('Booking record not found.', 404, 'BOOKING_NOT_FOUND');
    }

    // 1. ENTRY BARRIER PASSAGE
    if (reader.readerType === 'ENTRY') {
      reader.barrierState = 'CLOSED';
      reader.lastEvent = 'VEHICLE_PASSAGE_IN_CONFIRMED';
      reader.lastEventAt = new Date();
      await reader.save();

      await this.recordBarrierEvent({
        readerId,
        readerType: 'ENTRY',
        parkingLotId: lotObjectId,
        bookingId: booking._id,
        eventType: 'VEHICLE_PASSAGE_IN_CONFIRMED',
        eventOutcome: 'SUCCESS',
        source,
        details: { direction: 'IN' },
      });

      this.broadcastBarrierUpdate(lotObjectId.toString(), readerId, 'CLOSED');
      return { success: true, message: 'Main entry vehicle passage confirmed. Entry barrier closed.' };
    }

    // 2. BAY BARRIER PASSAGE (IN / OUT)
    if (reader.readerType === 'SLOT') {
      const slotId = reader.slotId || booking.currentSlotId?._id || booking.currentSlotId;

      if (direction === 'IN') {
        await (ParkingSlotModel as any)
          .findByIdAndUpdate(slotId, {
            slotStatus: 'Occupied',
            currentBookingId: booking._id,
          })
          .exec();

        reader.barrierState = 'CLOSED';
        reader.autoCloseTimerActive = false;
        reader.autoCloseDeadline = null;
        reader.lastEvent = 'VEHICLE_PASSAGE_IN_CONFIRMED';
        reader.lastEventAt = new Date();
        await reader.save();

        await this.recordBarrierEvent({
          readerId,
          readerType: 'SLOT',
          parkingLotId: lotObjectId,
          slotId,
          bookingId: booking._id,
          eventType: 'VEHICLE_PASSAGE_IN_CONFIRMED',
          eventOutcome: 'SUCCESS',
          source,
          details: { slotOccupied: true, timerCancelled: true },
        });

        await BookingTimelineModel.create({
          bookingId: booking._id,
          eventCode: 'SLOT_RESERVED',
          eventType: 'Slot Reserved',
          eventTitle: `Vehicle Parked in Bay ${reader.slotNumber || ''}`,
          eventDescription: `Vehicle passage confirmed into bay. Slot marked Occupied. Bay barrier closed.`,
          eventSource: 'System',
          eventTime: new Date(),
        });

        emitSlotStatusUpdate({
          parkingLotId: lotObjectId.toString(),
          floorId: booking.floorId?.toString() || '',
          zoneId: booking.zoneId?.toString() || '',
          slotId: slotId.toString(),
          slotNumber: reader.slotNumber || '',
          slotStatus: 'Occupied',
          timestamp: new Date().toISOString(),
        });

        this.broadcastBarrierUpdate(lotObjectId.toString(), readerId, 'CLOSED');

        return {
          success: true,
          message: `Vehicle parked into Bay ${reader.slotNumber}. Slot marked OCCUPIED. Bay barrier closed.`,
        };
      }

      if (direction === 'OUT') {
        reader.barrierState = 'CLOSED';
        reader.autoCloseTimerActive = false;
        reader.autoCloseDeadline = null;
        reader.lastEvent = 'BAY_DEPARTURE_COMPLETED';
        reader.lastEventAt = new Date();
        await reader.save();

        await this.recordBarrierEvent({
          readerId,
          readerType: 'SLOT',
          parkingLotId: lotObjectId,
          slotId,
          bookingId: booking._id,
          eventType: 'VEHICLE_PASSAGE_OUT_CONFIRMED',
          eventOutcome: 'SUCCESS',
          source,
          details: { slotOccupiedKept: true },
        });

        this.broadcastBarrierUpdate(lotObjectId.toString(), readerId, 'CLOSED');

        return {
          success: true,
          message: `Bay ${reader.slotNumber} departure confirmed. Bay barrier closed. Slot remains protected until main exit.`,
        };
      }
    }

    // 3. MAIN EXIT BARRIER PASSAGE
    if (reader.readerType === 'EXIT') {
      const slotId = booking.currentSlotId?._id || booking.currentSlotId;

      reader.barrierState = 'CLOSED';
      reader.lastEvent = 'FINAL_VEHICLE_EXIT_CONFIRMED';
      reader.lastEventAt = new Date();
      await reader.save();

      booking.bookingStatus = 'Completed';
      booking.actualExitTime = new Date();
      await booking.save();
      void this.dispatchBookingCompletionEmail(booking._id);

      if (slotId) {
        await (ParkingSlotModel as any)
          .findByIdAndUpdate(slotId, {
            slotStatus: 'Available',
            currentBookingId: null,
          })
          .exec();
      }

      await (VehicleMovementLogModel as any).findOneAndUpdate(
        { bookingId: booking._id },
        {
          $set: {
            exitTime: new Date(),
            exitMethod: 'QR Code',
            movementStatus: 'Vehicle Exited',
            remarks: `Final exit confirmed via ${source}. Slot released to Available.`,
          },
        },
      ).exec();

      await BookingTimelineModel.create({
        bookingId: booking._id,
        eventCode: 'BOOKING_COMPLETED',
        eventType: 'Booking Completed',
        eventTitle: 'Vehicle Exited Facility',
        eventDescription: `Vehicle cleared main exit barrier. Booking completed and Bay ${booking.currentSlotId?.slotNumber || ''} released.`,
        eventSource: 'System',
        eventTime: new Date(),
      });

      await this.recordBarrierEvent({
        readerId,
        readerType: 'EXIT',
        parkingLotId: lotObjectId,
        bookingId: booking._id,
        slotId,
        eventType: 'FINAL_VEHICLE_EXIT_CONFIRMED',
        eventOutcome: 'SUCCESS',
        source,
        details: { bookingCompleted: true, slotReleased: true },
      });

      emitBookingStatusUpdate({
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        parkingLotId: lotObjectId.toString(),
        customerId: (booking.customerId?._id || booking.customerId)?.toString() || '',
        bookingStatus: 'Completed',
        timestamp: new Date().toISOString(),
      });

      emitLiveVehicleUpdate({
        event: 'VEHICLE_EXITED',
        bookingId: booking._id.toString(),
        parkingLotId: lotObjectId.toString(),
        vehicleNumber: booking.vehicleId?.licensePlate || 'Vehicle',
        timestamp: new Date().toISOString(),
      });

      if (slotId) {
        emitSlotStatusUpdate({
          parkingLotId: lotObjectId.toString(),
          floorId: booking.floorId?.toString() || '',
          zoneId: booking.zoneId?.toString() || '',
          slotId: slotId.toString(),
          slotNumber: booking.currentSlotId?.slotNumber || '',
          slotStatus: 'Available',
          timestamp: new Date().toISOString(),
        });
      }

      this.broadcastBarrierUpdate(lotObjectId.toString(), readerId, 'CLOSED');

      return {
        success: true,
        message: 'Vehicle exit confirmed. Booking completed and slot released to Available.',
      };
    }

    return { success: false, message: 'Unsupported passage event.' };
  }

  private async executeReaderAutoClose(
    reader: any,
    details: Record<string, any> = { autoCloseDurationMinutes: 5 }
  ): Promise<boolean> {
    const closeRes = await this.controller.closeBarrier(reader);
    if (!closeRes.success) return false;

    const prevEvent = reader.lastEvent;
    reader.barrierState = 'CLOSED';
    reader.autoCloseTimerActive = false;
    reader.autoCloseDeadline = null;
    reader.lastEvent =
      reader.readerType === 'SLOT' && prevEvent === 'BAY_DEPARTURE_AUTHORIZED'
        ? 'BAY_DEPARTURE_COMPLETED'
        : 'BARRIER_AUTO_CLOSE_COMMAND';
    reader.lastEventAt = new Date();
    await reader.save();

    if (reader.readerType === 'SLOT' && reader.slotId) {
      const slot = await (ParkingSlotModel as any).findById(reader.slotId).exec();
      if (slot && slot.slotStatus === 'Reserved') {
        slot.slotStatus = 'Occupied';
        if (reader.activeBookingId) slot.currentBookingId = reader.activeBookingId;
        await slot.save();

        emitSlotStatusUpdate({
          parkingLotId: reader.parkingLotId.toString(),
          floorId: slot.floorId?.toString() || '',
          zoneId: slot.zoneId?.toString() || '',
          slotId: slot._id.toString(),
          slotNumber: slot.slotNumber,
          slotStatus: 'Occupied',
          timestamp: new Date().toISOString(),
        });
      }
    } else if (reader.readerType === 'EXIT' && reader.activeBookingId && prevEvent === 'EXIT_AUTHORIZED') {
      const booking = await (BookingModel as any).findById(reader.activeBookingId).populate('currentSlotId').exec();
      if (booking && (booking.bookingStatus === 'Active' || booking.bookingStatus === 'Overstay')) {
        const exitSlotId = booking.currentSlotId?._id || booking.currentSlotId;
        booking.bookingStatus = 'Completed';
        booking.actualExitTime = new Date();
        await booking.save();
        void this.dispatchBookingCompletionEmail(booking._id);

        if (exitSlotId) {
          await (ParkingSlotModel as any)
            .findByIdAndUpdate(exitSlotId, {
              slotStatus: 'Available',
              currentBookingId: null,
            })
            .exec();

          emitSlotStatusUpdate({
            parkingLotId: reader.parkingLotId.toString(),
            floorId: booking.floorId?.toString() || '',
            zoneId: booking.zoneId?.toString() || '',
            slotId: exitSlotId.toString(),
            slotNumber: booking.currentSlotId?.slotNumber || '',
            slotStatus: 'Available',
            timestamp: new Date().toISOString(),
          });
        }

        await (VehicleMovementLogModel as any)
          .findOneAndUpdate(
            { bookingId: booking._id },
            {
              $set: {
                exitTime: new Date(),
                exitMethod: 'QR Code',
                movementStatus: 'Vehicle Exited',
                remarks: 'Final exit auto-completed upon exit barrier closure. Slot released to Available.',
              },
            },
          )
          .exec();

        emitBookingStatusUpdate({
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          parkingLotId: reader.parkingLotId.toString(),
          customerId: (booking.customerId?._id || booking.customerId)?.toString() || '',
          bookingStatus: 'Completed',
          timestamp: new Date().toISOString(),
        });
      }
    }

    await this.recordBarrierEvent({
      readerId: reader.readerId,
      readerType: reader.readerType,
      parkingLotId: reader.parkingLotId,
      slotId: reader.slotId,
      bookingId: reader.activeBookingId,
      eventType: 'BARRIER_AUTO_CLOSE_COMMAND',
      eventOutcome: 'SUCCESS',
      source: 'SIMULATOR',
      details,
    });

    this.broadcastBarrierUpdate(reader.parkingLotId.toString(), reader.readerId, 'CLOSED');
    return true;
  }

  public async processOverdueAutoClosures(): Promise<number> {
    if (mongoose.connection.readyState !== 1) return 0;

    const now = new Date();
    const openReaders = await (BarrierReaderModel as any).find({
      barrierState: { $in: ['OPEN', 'OPENING'] },
    }).exec();

    let closedCount = 0;
    const defaultDurationMs = (5 * 60 * 1000) / this.acceleratedTimerMultiplier;

    for (const reader of openReaders) {
      if (reader.isObstructed) {
        continue;
      }

      const hasValidDeadline =
        reader.autoCloseTimerActive &&
        reader.autoCloseDeadline instanceof Date &&
        !isNaN(reader.autoCloseDeadline.getTime());

      if (hasValidDeadline) {
        if (reader.autoCloseDeadline <= now) {
          const closed = await this.executeReaderAutoClose(reader, { autoCloseDurationMinutes: 5 });
          if (closed) closedCount++;
        }
      } else {
        // Barrier is OPEN without an active deadline (e.g. legacy/straggler state or uninitialized timer)
        const openedAt = reader.barrierOpenedAt ? new Date(reader.barrierOpenedAt).getTime() : 0;
        const elapsed = openedAt ? now.getTime() - openedAt : Number.MAX_SAFE_INTEGER;

        if (elapsed >= defaultDurationMs) {
          // Exceeded 5 minutes (or openedAt is missing) -> close immediately
          const closed = await this.executeReaderAutoClose(reader, {
            autoCloseDurationMinutes: 5,
            reason: 'OVERDUE_OPEN_WITHOUT_TIMER',
          });
          if (closed) closedCount++;
        } else {
          // Opened recently (< 5 minutes ago) -> heal its timer so UI displays countdown
          reader.autoCloseTimerActive = true;
          reader.autoCloseDeadline = new Date(openedAt + defaultDurationMs);
          await reader.save();
          this.broadcastBarrierUpdate(reader.parkingLotId.toString(), reader.readerId, 'OPEN');
        }
      }
    }
    return closedCount;
  }

  public async forceAutoCloseBay(
    readerId: string,
    parkingLotId?: string,
  ): Promise<{ closed: boolean; message: string }> {
    const query: any = { readerId };
    if (parkingLotId && mongoose.isValidObjectId(parkingLotId)) {
      query.parkingLotId = new mongoose.Types.ObjectId(parkingLotId);
    }

    const reader = await (BarrierReaderModel as any).findOne(query).exec();
    if (!reader) {
      return { closed: false, message: 'Barrier reader not found.' };
    }

    if (reader.isObstructed) {
      return { closed: false, message: 'Auto-closure deferred safely: Sensor detects obstruction.' };
    }

    await this.executeReaderAutoClose(reader, { forcedBySimulator: true });
    return { closed: true, message: 'Barrier auto-closed successfully.' };
  }

  public async setReaderObstruction(
    readerId: string,
    isObstructed: boolean,
    parkingLotId?: string,
  ): Promise<boolean> {
    const query: any = { readerId };
    if (parkingLotId && mongoose.isValidObjectId(parkingLotId)) {
      query.parkingLotId = new mongoose.Types.ObjectId(parkingLotId);
    }

    const reader = await (BarrierReaderModel as any).findOne(query).exec();
    if (!reader) throw new AppError('Reader not found.', 404, 'READER_NOT_FOUND');
    reader.isObstructed = isObstructed;
    await reader.save();
    this.broadcastBarrierUpdate(reader.parkingLotId.toString(), reader.readerId, reader.barrierState);
    return true;
  }

  public async sendBarrierCommand(
    readerId: string,
    command: 'OPEN' | 'CLOSE',
    source: 'SIMULATOR' | 'PHYSICAL_CONTROLLER' = 'SIMULATOR',
    parkingLotId?: string,
  ): Promise<BarrierReader> {
    const query: any = { readerId };
    if (parkingLotId && mongoose.isValidObjectId(parkingLotId)) {
      query.parkingLotId = new mongoose.Types.ObjectId(parkingLotId);
    }

    const reader = await (BarrierReaderModel as any).findOne(query).exec();
    if (!reader) throw new AppError('Reader not found.', 404, 'READER_NOT_FOUND');

    if (command === 'OPEN') {
      const res = await this.controller.openBarrier(reader);
      if (!res.success) throw new AppError(res.error || 'Open command failed.', 500, 'CONTROLLER_ERROR');
      const fiveMinutesMs = (5 * 60 * 1000) / this.acceleratedTimerMultiplier;
      reader.barrierState = 'OPEN';
      reader.barrierOpenedAt = new Date();
      reader.autoCloseTimerActive = true;
      reader.autoCloseDeadline = new Date(Date.now() + fiveMinutesMs);
      reader.lastEvent = 'BARRIER_OPEN_COMMAND';
    } else {
      if (reader.isObstructed) {
        throw new AppError('Cannot close: Safety sensor detects obstruction.', 400, 'OBSTRUCTION_DETECTED');
      }
      const res = await this.controller.closeBarrier(reader);
      if (!res.success) throw new AppError(res.error || 'Close command failed.', 500, 'CONTROLLER_ERROR');
      reader.barrierState = 'CLOSED';
      reader.autoCloseTimerActive = false;
      reader.autoCloseDeadline = null;
      reader.lastEvent = 'BARRIER_CLOSED_COMMAND';
    }

    reader.lastEventAt = new Date();
    await reader.save();

    await this.recordBarrierEvent({
      readerId: reader.readerId,
      readerType: reader.readerType,
      parkingLotId: reader.parkingLotId,
      slotId: reader.slotId,
      eventType: `BARRIER_${command}_COMMAND`,
      eventOutcome: 'SUCCESS',
      source,
    });

    this.broadcastBarrierUpdate(reader.parkingLotId.toString(), reader.readerId, reader.barrierState);
    return reader.toObject();
  }

  public async resolveOverstaySlotConflict(
    booking: any,
    parkingLotId: mongoose.Types.ObjectId,
    source: 'SIMULATOR' | 'PHYSICAL_CONTROLLER',
  ): Promise<{ success: boolean; message: string; booking?: any }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const entryTime = booking.scheduledEntryTime || new Date();
      const exitTime = booking.scheduledExitTime || new Date(Date.now() + 2 * 60 * 60 * 1000);
      const vehicle = booking.vehicleId;
      const vehicleType = vehicle?.vehicleType || 'Car';

      // Stage 1: Check for fully free REGULAR compatible slot first
      const regularCandidateSlots = await (ParkingSlotModel as any)
        .find({
          parkingLotId,
          _id: { $ne: booking.currentSlotId?._id || booking.currentSlotId },
          slotStatus: { $in: ['Available', 'Reserved'] },
          supportedVehicleType: vehicleType,
          $or: [{ isOverflow: false }, { isOverflow: { $exists: false } }],
        })
        .session(session)
        .exec();

      let replacementSlot: any = null;
      let reassignedToOverflow = false;

      for (const slot of regularCandidateSlots) {
        if (slot.slotStatus === 'Occupied' || slot.slotStatus === 'Under Maintenance') continue;

        const conflictingBooking = await (BookingModel as any)
          .findOne({
            _id: { $ne: booking._id },
            currentSlotId: slot._id,
            bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
            $or: [
              {
                scheduledEntryTime: { $lt: exitTime },
                scheduledExitTime: { $gt: entryTime },
              },
            ],
          })
          .session(session)
          .exec();

        if (!conflictingBooking) {
          replacementSlot = slot;
          break;
        }
      }

      // Stage 2: Fallback to available OVERFLOW slot (universal vehicle compatibility) within overflowCapacity
      if (!replacementSlot) {
        const lot = await (ParkingLotModel as any).findById(parkingLotId).session(session).lean();
        const maxOverflowCapacity = lot?.overflowCapacity ?? 0;

        if (maxOverflowCapacity > 0) {
          const overflowCandidateSlots = await (ParkingSlotModel as any)
            .find({
              parkingLotId,
              _id: { $ne: booking.currentSlotId?._id || booking.currentSlotId },
              slotStatus: { $in: ['Available', 'Reserved'] },
              isOverflow: true,
            })
            .session(session)
            .exec();

          if (overflowCandidateSlots.length > 0) {
            const overflowSlotIds = overflowCandidateSlots.map((s: any) => s._id);
            const activeOverflowBookingsCount = await (BookingModel as any)
              .countDocuments({
                parkingLotId,
                _id: { $ne: booking._id },
                currentSlotId: { $in: overflowSlotIds },
                bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
                scheduledEntryTime: { $lt: exitTime },
                scheduledExitTime: { $gt: entryTime },
              })
              .session(session);

            if (activeOverflowBookingsCount < maxOverflowCapacity) {
              for (const slot of overflowCandidateSlots) {
                if (slot.slotStatus === 'Occupied' || slot.slotStatus === 'Under Maintenance') continue;

                const conflictingBooking = await (BookingModel as any)
                  .findOne({
                    _id: { $ne: booking._id },
                    currentSlotId: slot._id,
                    bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
                    scheduledEntryTime: { $lt: exitTime },
                    scheduledExitTime: { $gt: entryTime },
                  })
                  .session(session)
                  .exec();

                if (!conflictingBooking) {
                  replacementSlot = slot;
                  reassignedToOverflow = true;
                  break;
                }
              }
            }
          }
        }
      }

      if (replacementSlot) {
        const originalSlotNum = booking.currentSlotId?.slotNumber || 'Original';
        const newSlotNum = replacementSlot.slotNumber;

        replacementSlot.slotStatus = 'Reserved';
        replacementSlot.currentBookingId = booking._id;
        await replacementSlot.save({ session });

        const originalSlotId = booking.originalSlotId?._id || booking.originalSlotId || booking.currentSlotId?._id || booking.currentSlotId;
        booking.originalSlotId = originalSlotId;
        booking.currentSlotId = replacementSlot._id;
        booking.slotReassignmentStatus = 'REASSIGNED';
        booking.slotReassignedAt = new Date();
        booking.slotReassignmentReason = 'OVERSTAY_SLOT_CONFLICT';
        await booking.save({ session });

        const reassignmentNotice = reassignedToOverflow
          ? `Original bay ${originalSlotNum} is occupied by an overstay vehicle. Automatically reassigned to Overflow Bay ${newSlotNum} with universal compatibility and zero extra charge.`
          : `Original bay ${originalSlotNum} is occupied by an overstay vehicle. Automatically reassigned to Bay ${newSlotNum} with zero extra charge.`;

        await BookingTimelineModel.create(
          [
            {
              bookingId: booking._id,
              eventCode: 'SLOT_REASSIGNED_OVERSTAY',
              eventType: 'Slot Reassigned Due to Overstay',
              eventTitle: reassignedToOverflow
                ? 'Slot Reassigned to Overflow Bay Due to Overstay Conflict'
                : 'Slot Reassigned Due to Overstay Conflict',
              eventDescription: reassignmentNotice,
              eventSource: 'System',
              eventTime: new Date(),
            },
          ],
          { session },
        );

        await AuditLogModel.create(
          [
            {
              actionCode: 'SLOT_REASSIGNED_OVERSTAY_CONFLICT',
              module: 'Booking Management',
              actionTitle: 'Slot Reassigned Due to Overstay Conflict',
              description: `Original bay ${originalSlotNum} occupied. Reassigned to ${reassignedToOverflow ? 'Overflow ' : ''}Bay ${newSlotNum}.`,
              bookingId: booking._id,
              parkingLotId,
              targetCollection: 'Booking',
              targetDocumentId: booking._id,
              metadata: {
                isOverflow: reassignedToOverflow,
                originalSlot: originalSlotNum,
                newSlot: newSlotNum,
              },
            },
          ],
          { session },
        );

        await NotificationModel.create(
          [
            {
              userId: booking.customerId?._id || booking.customerId,
              bookingId: booking._id,
              title: reassignedToOverflow ? 'Assigned to Overflow Bay' : 'Parking Slot Reassigned',
              message: `Your parking slot was updated from Bay ${originalSlotNum} to ${reassignedToOverflow ? 'Overflow ' : ''}Bay ${newSlotNum} due to lot management. Proceed to your new bay.`,
              notificationType: 'Booking',
              eventType: 'Slot Reassigned Due to Overstay',
              deliveryChannel: 'In-App',
              deliveryStatus: 'Delivered',
              notificationReference: `NOTIF-${Date.now()}`,
              isRead: false,
            },
          ],
          { session },
        );

        await session.commitTransaction();

        const updatedBooking = await (BookingModel as any)
          .findById(booking._id)
          .populate('currentSlotId')
          .populate('originalSlotId')
          .populate('floorId')
          .populate('zoneId')
          .exec();

        emitSlotStatusUpdate({
          parkingLotId: parkingLotId.toString(),
          floorId: replacementSlot.floorId?.toString() || '',
          zoneId: replacementSlot.zoneId?.toString() || '',
          slotId: replacementSlot._id.toString(),
          slotNumber: replacementSlot.slotNumber || '',
          slotStatus: 'Reserved',
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          message: `Slot Reassigned: Original Bay ${originalSlotNum} is occupied. Reassigned to Bay ${newSlotNum}.`,
          booking: updatedBooking,
        };
      }

      // NO REPLACEMENT AVAILABLE -> 100% FULL REFUND
      const totalAmount = booking.totalAmount || 0;
      booking.bookingStatus = 'Cancelled';
      booking.slotReassignmentStatus = 'CANCELLED_REFUNDED';
      booking.slotReassignmentReason = 'OVERSTAY_SLOT_CONFLICT';
      booking.cancellationReason = 'OVERSTAY_SLOT_CONFLICT';
      booking.cancelledBy = 'System';
      booking.cancelledAt = new Date();
      booking.refundAmount = totalAmount;
      await booking.save({ session });

      await (PaymentModel as any).findOneAndUpdate(
        { bookingId: booking._id },
        {
          $set: {
            paymentStatus: 'REFUNDED',
            refundStatus: 'FULL_REFUND',
            refundAmount: totalAmount,
            refundPercentage: 100,
            refundReason: 'Overstay slot conflict - no alternate slot available in facility.',
            refundCompletedAt: new Date(),
          },
        },
        { session },
      );

      await BookingTimelineModel.create(
        [
          {
            bookingId: booking._id,
            eventCode: 'BOOKING_CANCELLED_OVERSTAY_CONFLICT',
            eventType: 'Booking Automatically Cancelled Due to Overstay Slot Conflict',
            eventTitle: 'Booking Cancelled Due to Overstay Conflict',
            eventDescription: 'Original slot was occupied by an overstay vehicle and no compatible alternate bay was available. 100% full refund issued.',
            eventSource: 'System',
            eventTime: new Date(),
          },
          {
            bookingId: booking._id,
            eventCode: 'FULL_REFUND_COMPLETED',
            eventType: 'Full Refund Completed',
            eventTitle: '100% Full Refund Processed',
            eventDescription: `Full refund of ₹${totalAmount} processed for cancelled booking ${booking.bookingReference}.`,
            eventSource: 'System',
            eventTime: new Date(),
          },
        ],
        { session, ordered: true },
      );

      await AuditLogModel.create(
        [
          {
            actionCode: 'BOOKING_CANCELLED_OVERSTAY_NO_SLOT',
            module: 'Booking Management',
            actionTitle: 'Booking Cancelled Overstay No Slot',
            description: `Original slot occupied by overstay vehicle and no replacement available. 100% refund of ₹${totalAmount} issued.`,
            bookingId: booking._id,
            parkingLotId,
            targetCollection: 'Booking',
            targetDocumentId: booking._id,
          },
        ],
        { session },
      );

      await NotificationModel.create(
        [
          {
            userId: booking.customerId?._id || booking.customerId,
            bookingId: booking._id,
            title: 'Booking Cancelled & 100% Refunded',
            message: `We sincerely apologize: Your parking slot is occupied by an overstay vehicle and no replacement bay is available. A 100% refund of ₹${totalAmount} has been processed.`,
            notificationType: 'Refund',
            eventType: 'Booking Automatically Cancelled Due to Overstay Slot Conflict',
            deliveryChannel: 'In-App',
            deliveryStatus: 'Delivered',
            notificationReference: `NOTIF-${Date.now()}`,
            isRead: false,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      emitBookingStatusUpdate({
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        parkingLotId: parkingLotId.toString(),
        customerId: (booking.customerId?._id || booking.customerId)?.toString() || '',
        bookingStatus: 'Cancelled',
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        message: `Facility Full: Assigned bay is occupied by an overstaying vehicle and no compatible replacement slot is available. Booking cancelled with 100% full refund of ₹${totalAmount}.`,
        booking,
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  private async recordBarrierEvent(params: {
    readerId: string;
    readerType: string;
    parkingLotId: mongoose.Types.ObjectId;
    slotId?: mongoose.Types.ObjectId;
    bookingId?: mongoose.Types.ObjectId;
    eventType: string;
    eventOutcome: 'GRANTED' | 'DENIED' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
    source: 'SIMULATOR' | 'PHYSICAL_CONTROLLER';
    details?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await (BarrierEventModel as any).create({
        readerId: params.readerId,
        readerType: params.readerType,
        parkingLotId: params.parkingLotId,
        slotId: params.slotId || null,
        bookingId: params.bookingId || null,
        eventType: params.eventType,
        eventOutcome: params.eventOutcome,
        source: params.source,
        controllerType: params.source === 'SIMULATOR' ? 'SIMULATED' : 'PHYSICAL',
        details: params.details || {},
        timestamp: new Date(),
      });
    } catch (err) {
      console.warn('[BarrierService] Failed to record barrier event:', err);
    }
  }

  private broadcastBarrierUpdate(parkingLotId: string, readerId: string, barrierState: string): void {
    const io = getIO();
    if (!io) return;
    const payload = {
      parkingLotId,
      readerId,
      barrierState,
      timestamp: new Date().toISOString(),
    };
    io.to(`lot_${parkingLotId}`).emit('barrier_state_changed', payload);
    io.emit('barrier_state_changed', payload);
  }

  private formatBookingSummary(b: any): any {
    if (!b) return undefined;
    return {
      _id: b._id.toString(),
      bookingReference: b.bookingReference,
      bookingStatus: b.bookingStatus,
      customerId: (b.customerId?._id || b.customerId)?.toString(),
      vehicleNumber: b.vehicleId?.licensePlate || b.vehicleId?.vehicleNumber,
      currentSlotId: (b.currentSlotId?._id || b.currentSlotId)?.toString(),
      currentSlotNumber: b.currentSlotId?.slotNumber,
      originalSlotNumber: b.originalSlotId?.slotNumber,
      isReassigned: b.slotReassignmentStatus === 'REASSIGNED',
      reassignmentReason: b.slotReassignmentReason,
    };
  }

  private async dispatchBookingCompletionEmail(bookingId: mongoose.Types.ObjectId | string): Promise<void> {
    try {
      const booking = await (BookingModel as any).findById(bookingId);
      if (!booking || (booking as any).completionEmailSent) return;

      (booking as any).completionEmailSent = true;
      await booking.save();

      const populatedBooking = await (BookingModel as any)
        .findById(bookingId)
        .populate('customerId', 'fullName email mobileNumber')
        .populate('parkingLotId', 'parkingName address city state')
        .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel')
        .populate('floorId', 'floorName floorNumber')
        .populate('zoneId', 'zoneCode zoneName')
        .populate('currentSlotId', 'slotNumber')
        .lean()
        .exec();

      if (!populatedBooking) return;
      const cust = populatedBooking.customerId as any;
      const lotDoc = populatedBooking.parkingLotId as any;
      const vehDoc = populatedBooking.vehicleId as any;
      const targetEmail = cust?.email || (populatedBooking as any).guestEmail;

      if (targetEmail && lotDoc) {
        const entryTime = populatedBooking.actualEntryTime || populatedBooking.scheduledEntryTime;
        const exitTime = populatedBooking.actualExitTime || new Date();
        const stayDurationMinutes = Math.max(
          1,
          Math.ceil((exitTime.getTime() - new Date(entryTime).getTime()) / (60 * 1000)),
        );

        await emailService.sendBookingCompletionEmail({
          to: targetEmail,
          customerName: cust?.fullName || 'Valued Customer',
          bookingId: (populatedBooking._id as mongoose.Types.ObjectId).toString(),
          parkingLotId: (lotDoc._id || populatedBooking.parkingLotId).toString(),
          bookingReference: populatedBooking.bookingReference,
          parkingName: lotDoc.parkingName || 'Parking Facility',
          parkingAddress:
            typeof lotDoc.address === 'string'
              ? lotDoc.address
              : `${lotDoc.address?.street || ''}, ${lotDoc.address?.city || ''}`,
          vehicleNumber: vehDoc?.vehicleNumber || 'Vehicle',
          vehicleType: vehDoc?.vehicleType || 'Car',
          slotNumber: (populatedBooking.currentSlotId as any)?.slotNumber,
          floorName: (populatedBooking.floorId as any)?.floorName,
          zoneCode: (populatedBooking.zoneId as any)?.zoneCode,
          entryTime: new Date(entryTime),
          exitTime: new Date(exitTime),
          stayDurationMinutes,
          totalAmount: populatedBooking.totalAmount,
        });
      }
    } catch (err) {
      console.error('[dispatchBookingCompletionEmail Error]:', err);
    }
  }

  private formatSlotSummary(s: any): any {
    if (!s) return undefined;
    return {
      slotId: (s._id || s).toString(),
      slotNumber: s.slotNumber || 'Unknown',
      slotType: s.slotType,
      floorName: s.floorId?.floorName,
      zoneCode: s.zoneId?.zoneCode,
    };
  }
}

export const barrierService = new BarrierService();
