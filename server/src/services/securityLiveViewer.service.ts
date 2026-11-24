import mongoose from 'mongoose';
import {
  AuditLogModel,
  BookingModel,
  ParkingFloorModel,
  ParkingLayoutModel,
  ParkingLotModel,
  ParkingSlotModel,
  ParkingZoneModel,
  SecurityStaffAssignmentModel,
  VehicleModel,
  UserModel,
  type AuditLog,
  type Booking,
  type ParkingFloor,
  type ParkingLayout,
  type ParkingLot,
  type ParkingSlot,
  type ParkingZone,
  type SecurityStaffAssignment,
  type User,
} from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { emitSlotStatusUpdate } from '../socket.js';
import { customerBookingService } from './customerBooking.service.js';

export interface SecurityAssignedFacility {
  parkingLotId: string;
  parkingName: string;
  address: string;
  city: string;
  floors: Array<{
    floorId: string;
    floorName: string;
    floorNumber: number;
    hasPublishedLayout: boolean;
  }>;
}

export interface SecurityEnrichedSlotElement {
  elementId: string;
  elementType: string;
  slotId?: string | undefined;
  slotNumber?: string | undefined;
  slotLabel?: string | undefined;
  slotType?: string | undefined;
  supportedVehicleType?: string | undefined;
  floorId?: string | undefined;
  zoneId?: string | undefined;
  zoneCode?: string | undefined;
  zoneName?: string | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number | undefined;
  effectiveStatus: 'Available' | 'Reserved' | 'Occupied' | 'Under Maintenance';
  isOverflow?: boolean | undefined;
  vehicleNumber?: string | null | undefined;
  vehicleType?: string | null | undefined;
  bookingReference?: string | null | undefined;
  scheduledExitTime?: string | null | undefined;
  isOverstay?: boolean | undefined;
}

export interface SecurityLiveFloorLayoutData {
  parkingLotId: string;
  parkingName: string;
  floor: {
    floorId: string;
    floorName: string;
    floorNumber: number;
  };
  canvasConfig: {
    width: number;
    height: number;
    gridSize: number;
    backgroundColor: string;
  };
  elements: SecurityEnrichedSlotElement[];
  stats: {
    totalSlots: number;
    availableSlots: number;
    reservedSlots: number;
    occupiedSlots: number;
    maintenanceSlots: number;
    overflowSlots: number;
    occupancyRate: number;
  };
}

export interface SecuritySlotDetailedInfo {
  slot: {
    _id: string;
    slotNumber: string;
    slotLabel: string;
    slotType: string;
    supportedVehicleType: string;
    slotStatus: string;
    isOverflow: boolean;
    remarks?: string | null | undefined;
  };
  floor: {
    _id: string;
    floorName: string;
    floorNumber: number;
  };
  zone: {
    _id: string;
    zoneName: string;
    zoneCode: string;
  };
  activeBooking?: {
    _id: string;
    bookingReference: string;
    bookingType: string;
    bookingStatus: string;
    scheduledEntryTime: string;
    scheduledExitTime: string;
    actualEntryTime?: string | null | undefined;
    customerName: string;
    customerPhone: string;
    vehicle: {
      vehicleNumber: string;
      vehicleType: string;
      vehicleBrand?: string | null | undefined;
      vehicleModel?: string | null | undefined;
    };
  } | null | undefined;
}

class SecurityLiveViewerService {
  /**
   * Helper to verify staff is assigned to the parking lot
   */
  private async assertStaffAssignment(staffUserId: string, parkingLotId: string): Promise<void> {
    const assignment = await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>).findOne({
      securityStaffId: new mongoose.Types.ObjectId(staffUserId),
      parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
      assignmentStatus: 'Active',
    }).lean().exec();

    if (!assignment) {
      throw new AppError('You are not assigned to this parking facility.', 403, 'FORBIDDEN_FACILITY_ACCESS');
    }
  }

  /**
   * Get facilities assigned to security staff with published floor lists
   */
  public async getAssignedFacilities(staffUserId: string): Promise<SecurityAssignedFacility[]> {
    const assignments = await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>)
      .find({
        securityStaffId: new mongoose.Types.ObjectId(staffUserId),
        assignmentStatus: 'Active',
      })
      .populate('parkingLotId', '_id parkingName address city')
      .lean()
      .exec();

    const results: SecurityAssignedFacility[] = [];

    for (const a of assignments) {
      const lot = a.parkingLotId as any;
      if (!lot || !lot._id) continue;

      const [floors, publishedLayouts] = await Promise.all([
        (ParkingFloorModel as mongoose.Model<ParkingFloor>)
          .find({ parkingLotId: lot._id, floorStatus: 'Active' })
          .sort({ floorNumber: 1 })
          .lean()
          .exec(),
        (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
          .find({ parkingLotId: lot._id, isPublished: true }, 'floorId')
          .lean()
          .exec(),
      ]);

      const publishedFloorSet = new Set(publishedLayouts.map((l) => l.floorId.toString()));

      results.push({
        parkingLotId: lot._id.toString(),
        parkingName: lot.parkingName,
        address: typeof lot.address === 'string' ? lot.address : lot.address?.street || '',
        city: lot.city || '',
        floors: floors.map((f) => ({
          floorId: f._id.toString(),
          floorName: f.floorName,
          floorNumber: f.floorNumber,
          hasPublishedLayout: publishedFloorSet.has(f._id.toString()),
        })),
      });
    }

    return results;
  }

  /**
   * Get official 2D live layout enriched with real-time operational slot statuses & vehicle plates
   */
  public async getLiveFloorLayout(params: {
    staffUserId: string;
    parkingLotId: string;
    floorId: string;
  }): Promise<SecurityLiveFloorLayoutData> {
    const { staffUserId, parkingLotId, floorId } = params;

    await this.assertStaffAssignment(staffUserId, parkingLotId);

    const [lot, floor, layout] = await Promise.all([
      (ParkingLotModel as mongoose.Model<ParkingLot>).findById(parkingLotId, 'parkingName').lean().exec(),
      (ParkingFloorModel as mongoose.Model<ParkingFloor>).findById(floorId).lean().exec(),
      (ParkingLayoutModel as mongoose.Model<ParkingLayout>).findOne({
        parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
        floorId: new mongoose.Types.ObjectId(floorId),
        isPublished: true,
      }).lean().exec(),
    ]);

    if (!lot) throw new AppError('Facility not found.', 404, 'FACILITY_NOT_FOUND');
    if (!floor) throw new AppError('Floor not found.', 404, 'FLOOR_NOT_FOUND');
    if (!layout) {
      throw new AppError('Published 2D parking layout not found for this floor.', 404, 'LAYOUT_NOT_FOUND');
    }

    // Fetch official slots on this floor
    const [slots, zones, activeBookings] = await Promise.all([
      (ParkingSlotModel as mongoose.Model<ParkingSlot>)
        .find({ parkingLotId: new mongoose.Types.ObjectId(parkingLotId), floorId: new mongoose.Types.ObjectId(floorId) })
        .lean()
        .exec(),
      (ParkingZoneModel as mongoose.Model<ParkingZone>)
        .find({ parkingLotId: new mongoose.Types.ObjectId(parkingLotId), floorId: new mongoose.Types.ObjectId(floorId) })
        .lean()
        .exec(),
      (BookingModel as mongoose.Model<Booking>)
        .find({
          parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
          floorId: new mongoose.Types.ObjectId(floorId),
          bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
        })
        .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel')
        .populate('customerId', 'fullName mobileNumber')
        .lean()
        .exec(),
    ]);

    const zoneMap = new Map(zones.map((z) => [z._id.toString(), z]));
    const slotMap = new Map(slots.map((s) => [s._id.toString(), s]));
    const slotByNumberMap = new Map(slots.map((s) => [s.slotNumber, s]));

    // Map bookings by slot ID
    const bookingBySlotMap = new Map<string, any>();
    for (const b of activeBookings) {
      const sId = b.currentSlotId.toString();
      // If active or overstay, it takes priority over Confirmed
      if (!bookingBySlotMap.has(sId) || b.bookingStatus === 'Active' || b.bookingStatus === 'Overstay') {
        bookingBySlotMap.set(sId, b);
      }
    }

    let availableCount = 0;
    let reservedCount = 0;
    let occupiedCount = 0;
    let maintenanceCount = 0;
    let overflowCount = 0;

    // Enrich layout elements with authoritative operational statuses
    const enrichedElements: SecurityEnrichedSlotElement[] = (layout.elements || []).map((el: any) => {
      if (el.elementType !== 'ParkingSlot') {
        return {
          ...el,
          effectiveStatus: 'Available',
        };
      }

      const slotIdStr = el.slotId ? el.slotId.toString() : '';
      const slot = (slotIdStr ? slotMap.get(slotIdStr) : undefined) ?? slotByNumberMap.get(el.slotNumber || '');
      const zone = slot ? zoneMap.get(slot.zoneId?.toString()) : undefined;
      const booking = slot ? bookingBySlotMap.get(slot._id.toString()) : undefined;

      let effectiveStatus: 'Available' | 'Reserved' | 'Occupied' | 'Under Maintenance' = 'Available';
      let vehicleNumber: string | null = null;
      let vehicleType: string | null = null;
      let bookingReference: string | null = null;
      let scheduledExitTime: string | null = null;
      let isOverstay = false;
      const isOverflow = Boolean(slot?.isOverflow || el.isOverflow);

      if (isOverflow) {
        overflowCount++;
      }

      if (!slot || slot.slotStatus === 'Under Maintenance' || (zone && zone.zoneStatus !== 'Active')) {
        effectiveStatus = 'Under Maintenance';
        maintenanceCount++;
      } else if (booking) {
        bookingReference = booking.bookingReference;
        scheduledExitTime = booking.scheduledExitTime ? new Date(booking.scheduledExitTime).toISOString() : null;
        const veh = booking.vehicleId as any;
        if (veh) {
          vehicleNumber = veh.vehicleNumber || null;
          vehicleType = veh.vehicleType || null;
        }

        if (booking.bookingStatus === 'Active' || booking.bookingStatus === 'Overstay' || slot.slotStatus === 'Occupied') {
          effectiveStatus = 'Occupied';
          isOverstay = booking.bookingStatus === 'Overstay';
          occupiedCount++;
        } else {
          effectiveStatus = 'Reserved';
          reservedCount++;
        }
      } else if (slot.slotStatus === 'Occupied') {
        effectiveStatus = 'Occupied';
        occupiedCount++;
      } else if (slot.slotStatus === 'Reserved') {
        effectiveStatus = 'Reserved';
        reservedCount++;
      } else {
        effectiveStatus = 'Available';
        availableCount++;
      }

      return {
        ...el,
        slotId: slot?._id ? slot._id.toString() : el.slotId,
        slotNumber: slot?.slotNumber || el.slotNumber,
        slotLabel: slot?.slotLabel || el.slotLabel || slot?.slotNumber || 'Bay',
        slotType: slot?.slotType || el.slotType || 'Standard',
        supportedVehicleType: slot?.supportedVehicleType || el.supportedVehicleType || 'Car',
        floorId: floor._id.toString(),
        zoneId: slot?.zoneId?.toString() || el.zoneId,
        zoneCode: zone?.zoneCode || 'A',
        zoneName: zone?.zoneName || 'Zone A',
        effectiveStatus,
        isOverflow,
        vehicleNumber,
        vehicleType,
        bookingReference,
        scheduledExitTime,
        isOverstay,
      };
    });

    const totalSlots = slots.length;
    const occupancyRate = totalSlots > 0 ? Math.round(((occupiedCount + reservedCount) / totalSlots) * 100) : 0;

    return {
      parkingLotId,
      parkingName: lot.parkingName,
      floor: {
        floorId: floor._id.toString(),
        floorName: floor.floorName,
        floorNumber: floor.floorNumber,
      },
      canvasConfig: {
        width: layout.canvasConfig?.width || 1200,
        height: layout.canvasConfig?.height || 800,
        gridSize: layout.canvasConfig?.gridSize || 20,
        backgroundColor: layout.canvasConfig?.backgroundColor || '#0f172a',
      },
      elements: enrichedElements,
      stats: {
        totalSlots,
        availableSlots: availableCount,
        reservedSlots: reservedCount,
        occupiedSlots: occupiedCount,
        maintenanceSlots: maintenanceCount,
        overflowSlots: overflowCount,
        occupancyRate,
      },
    };
  }

  /**
   * Get operational details of a specific bay for Security Staff inspector dialog
   */
  public async getSlotDetails(params: {
    staffUserId: string;
    parkingLotId: string;
    slotId: string;
  }): Promise<SecuritySlotDetailedInfo> {
    const { staffUserId, parkingLotId, slotId } = params;

    await this.assertStaffAssignment(staffUserId, parkingLotId);

    const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .findById(slotId)
      .lean()
      .exec();

    if (!slot || slot.parkingLotId.toString() !== parkingLotId) {
      throw new AppError('Parking slot not found in this facility.', 404, 'SLOT_NOT_FOUND');
    }

    const [floor, zone, booking] = await Promise.all([
      (ParkingFloorModel as mongoose.Model<ParkingFloor>).findById(slot.floorId).lean().exec(),
      (ParkingZoneModel as mongoose.Model<ParkingZone>).findById(slot.zoneId).lean().exec(),
      (BookingModel as mongoose.Model<Booking>)
        .findOne({
          parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
          currentSlotId: slot._id,
          bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
        })
        .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel')
        .populate('customerId', 'fullName mobileNumber')
        .sort({ updatedAt: -1 })
        .lean()
        .exec(),
    ]);

    if (!floor || !zone) {
      throw new AppError('Floor or Zone structure not found.', 500, 'HIERARCHY_ERROR');
    }

    let activeBooking: SecuritySlotDetailedInfo['activeBooking'] = null;

    if (booking) {
      const cust = booking.customerId as any;
      const veh = booking.vehicleId as any;

      activeBooking = {
        _id: booking._id.toString(),
        bookingReference: booking.bookingReference,
        bookingType: booking.bookingType || 'ONLINE',
        bookingStatus: booking.bookingStatus,
        scheduledEntryTime: booking.scheduledEntryTime.toISOString(),
        scheduledExitTime: booking.scheduledExitTime.toISOString(),
        actualEntryTime: booking.actualEntryTime ? booking.actualEntryTime.toISOString() : null,
        customerName: cust?.fullName || 'Walk-in Guest',
        customerPhone: cust?.mobileNumber || 'Direct On-Site',
        vehicle: {
          vehicleNumber: veh?.vehicleNumber || 'Unassigned',
          vehicleType: veh?.vehicleType || slot.supportedVehicleType,
          vehicleBrand: veh?.vehicleBrand || null,
          vehicleModel: veh?.vehicleModel || null,
        },
      };
    }

    return {
      slot: {
        _id: slot._id.toString(),
        slotNumber: slot.slotNumber,
        slotLabel: slot.slotLabel,
        slotType: slot.slotType,
        supportedVehicleType: slot.supportedVehicleType,
        slotStatus: slot.slotStatus,
        isOverflow: Boolean(slot.isOverflow),
        remarks: slot.remarks,
      },
      floor: {
        _id: floor._id.toString(),
        floorName: floor.floorName,
        floorNumber: floor.floorNumber,
      },
      zone: {
        _id: zone._id.toString(),
        zoneName: zone.zoneName,
        zoneCode: zone.zoneCode,
      },
      activeBooking,
    };
  }

  /**
   * Allows assigned on-duty Security Staff to update operational slot status
   * (e.g. Place slot "Under Maintenance" or restore to "Available").
   * Strictly limited to Parking Slots only; validates facility assignment, physical occupancy,
   * conflicting reservations, writes audit logs, reconciles counters, and emits real-time events.
   */
  public async updateSlotStatus(params: {
    staffUserId: string;
    parkingLotId: string;
    slotId: string;
    payload: {
      slotStatus: string;
      remarks?: string | null | undefined;
    };
    context?: {
      ipAddress?: string | undefined;
      userAgent?: string | undefined;
    };
  }): Promise<{
    success: boolean;
    message: string;
    slot: {
      _id: string;
      slotNumber: string;
      slotStatus: string;
      remarks: string | null;
    };
  }> {
    if (!params.staffUserId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    if (!mongoose.Types.ObjectId.isValid(params.slotId)) {
      throw new AppError('Invalid parking slot ID format.', 400, 'INVALID_SLOT_ID');
    }

    // 1. Verify staff has an active assignment for this facility
    const assignment = await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>)
      .findOne({
        securityStaffId: new mongoose.Types.ObjectId(params.staffUserId),
        parkingLotId: new mongoose.Types.ObjectId(params.parkingLotId),
        assignmentStatus: 'Active',
      })
      .lean()
      .exec();

    if (!assignment) {
      throw new AppError('Access denied: You are not actively assigned to this parking facility.', 403, 'FORBIDDEN');
    }

    // 2. Fetch the slot
    const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).findById(params.slotId);
    if (!slot) {
      throw new AppError('Parking slot not found.', 404, 'SLOT_NOT_FOUND');
    }

    if (slot.parkingLotId.toString() !== params.parkingLotId) {
      throw new AppError('Parking slot does not belong to this facility.', 400, 'FACILITY_MISMATCH');
    }

    // 3. Status Transition validation (Only slots, Available <-> Under Maintenance)
    const rawStatus = (params.payload.slotStatus || '').trim();
    let targetStatus: 'Available' | 'Under Maintenance';
    if (rawStatus === 'Available') {
      targetStatus = 'Available';
    } else if (rawStatus === 'Under Maintenance' || rawStatus === 'Maintenance' || rawStatus === 'Blocked') {
      targetStatus = 'Under Maintenance';
    } else {
      throw new AppError(
        'Invalid status transition. Supported operational states are "Available" and "Under Maintenance".',
        400,
        'INVALID_STATUS_TRANSITION',
      );
    }

    // 4. Physical occupancy / reservation conflict checks
    if (slot.slotStatus === 'Occupied') {
      throw new AppError(
        `Cannot change status: Slot ${slot.slotNumber} is currently occupied by a parked vehicle.`,
        409,
        'SLOT_OCCUPIED_CONFLICT',
      );
    }

    if (slot.slotStatus === 'Reserved') {
      throw new AppError(
        `Cannot change status: Slot ${slot.slotNumber} is currently reserved for an incoming customer booking.`,
        409,
        'SLOT_RESERVED_CONFLICT',
      );
    }

    // 5. Booking conflict check for Under Maintenance transition
    if (targetStatus === 'Under Maintenance') {
      const conflictingBooking = await (BookingModel as mongoose.Model<Booking>)
        .findOne({
          currentSlotId: slot._id,
          bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
        })
        .select('bookingReference bookingStatus scheduledEntryTime')
        .lean();

      if (conflictingBooking) {
        throw new AppError(
          `Cannot place slot under maintenance: Active or confirmed booking (${conflictingBooking.bookingReference}) is assigned to this slot.`,
          409,
          'ACTIVE_BOOKING_CONFLICT',
        );
      }
    }

    const oldStatus = slot.slotStatus;
    slot.slotStatus = targetStatus;

    if (params.payload.remarks !== undefined) {
      slot.remarks =
        params.payload.remarks && params.payload.remarks.trim().length > 0
          ? params.payload.remarks.trim().slice(0, 250)
          : null;
    } else if (targetStatus === 'Available') {
      slot.remarks = null;
    }

    await slot.save();

    // 6. Reconcile hierarchy slot availability counters
    try {
      await customerBookingService.reconcileHierarchyCounters({
        parkingLotId: slot.parkingLotId as mongoose.Types.ObjectId,
        floorId: slot.floorId as mongoose.Types.ObjectId,
        zoneId: slot.zoneId as mongoose.Types.ObjectId,
      });
    } catch (reconcileErr) {
      console.warn('Reconcile hierarchy counters warning:', reconcileErr);
    }

    // 7. Record Immutable Audit Log
    try {
      const staffUser = await (UserModel as mongoose.Model<User>)
        .findById(params.staffUserId)
        .select('fullName roleId');
      await (AuditLogModel as mongoose.Model<AuditLog>).create({
        userId: new mongoose.Types.ObjectId(params.staffUserId),
        roleId: staffUser?.roleId ?? null,
        actionCode: 'SECURITY_SLOT_STATUS_UPDATED',
        module: 'Parking Management',
        actionTitle: 'Operational Slot Status Changed by Security Staff',
        description: `Slot "${slot.slotNumber}" operational status changed from "${oldStatus}" to "${targetStatus}" by Security Officer ${staffUser?.fullName || 'Staff'}.${slot.remarks ? ` Remarks: ${slot.remarks}` : ''}`,
        targetDocumentId: slot._id,
        targetCollection: 'parkingSlots',
        ipAddress: params.context?.ipAddress || '127.0.0.1',
        actionStatus: 'Success',
        metadata: {
          parkingLotId: slot.parkingLotId,
          floorId: slot.floorId,
          zoneId: slot.zoneId,
          oldStatus,
          newStatus: targetStatus,
          remarks: slot.remarks,
        },
      });
    } catch (auditErr) {
      console.warn('Audit log write error for security slot status change:', auditErr);
    }

    // 8. Emit Real-time WebSocket Event
    try {
      emitSlotStatusUpdate({
        parkingLotId: slot.parkingLotId.toString(),
        floorId: slot.floorId.toString(),
        zoneId: slot.zoneId.toString(),
        slotId: slot._id.toString(),
        slotNumber: slot.slotNumber,
        slotStatus: slot.slotStatus,
        remarks: slot.remarks,
        timestamp: new Date().toISOString(),
      });
    } catch (socketErr) {
      console.warn('Socket emission warning for security slot status change:', socketErr);
    }

    return {
      success: true,
      message: `Bay ${slot.slotNumber} status updated to ${slot.slotStatus}.`,
      slot: {
        _id: slot._id.toString(),
        slotNumber: slot.slotNumber,
        slotStatus: slot.slotStatus,
        remarks: slot.remarks ?? null,
      },
    };
  }
}

export const securityLiveViewerService = new SecurityLiveViewerService();
