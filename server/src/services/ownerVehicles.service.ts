import mongoose from 'mongoose';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { ParkingFloorModel, type ParkingFloor } from '../models/ParkingFloor.js';
import { ParkingSlotModel, type ParkingSlot } from '../models/ParkingSlot.js';
import { VehicleMovementLogModel, type VehicleMovementLog } from '../models/VehicleMovementLog.js';
import { BookingModel, type Booking } from '../models/Booking.js';
import { VehicleModel } from '../models/Vehicle.js';
import { AppError } from '../utils/AppError.js';

export interface OwnerVehiclesOverviewQuery {
  parkingLotId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export interface OwnerVehiclesListQuery {
  parkingLotId?: string | undefined;
  movementStatus?: string | undefined;
  vehicleType?: string | undefined;
  search?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export class OwnerVehiclesService {
  private async getAuthorizedLotIds(ownerId: string, requestedLotId?: string) {
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      throw new AppError('Invalid owner identifier.', 401, 'INVALID_OWNER_ID');
    }

    const ownerLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: new mongoose.Types.ObjectId(ownerId) })
      .select('_id name parkingName address city totalFloors totalSlots')
      .lean();

    const allOwnerLotIds = ownerLots.map((l) => new mongoose.Types.ObjectId(l._id.toString()));

    if (allOwnerLotIds.length === 0) {
      return { allOwnerLotIds: [], targetLotIds: [], ownerLots: [] };
    }

    let targetLotIds = allOwnerLotIds;
    if (requestedLotId && requestedLotId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(requestedLotId)) {
        throw new AppError('Invalid parking lot ID filter.', 400, 'INVALID_LOT_ID');
      }
      const match = allOwnerLotIds.some((id) => id.toString() === requestedLotId);
      if (!match) {
        throw new AppError('Forbidden: You do not own this parking lot.', 403, 'FORBIDDEN_LOT');
      }
      targetLotIds = [new mongoose.Types.ObjectId(requestedLotId)];
    }

    return {
      allOwnerLotIds,
      targetLotIds,
      ownerLots: ownerLots.map((l) => ({
        _id: l._id.toString(),
        parkingName: l.parkingName || (l as any).name || 'Unnamed Facility',
        address: l.address || '',
        city: l.city || '',
        totalFloors: l.totalFloors || 1,
        totalSlots: l.totalSlots || 0,
      })),
    };
  }

  /**
   * OWNER-02: Vehicles Overview KPI metrics
   */
  public async getOwnerVehiclesOverview(ownerId: string, query: OwnerVehiclesOverviewQuery) {
    const { targetLotIds, ownerLots } = await this.getAuthorizedLotIds(ownerId, query.parkingLotId);

    if (targetLotIds.length === 0) {
      return {
        ownerLots: [],
        kpis: {
          totalVehicles: 0,
          vehiclesInside: 0,
          vehiclesExpected: 0,
          vehiclesOverstaying: 0,
          vehiclesDeparted: 0,
        },
      };
    }

    const filter: Record<string, any> = {
      parkingLotId: { $in: targetLotIds },
    };

    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
    }

    const logs = await (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>)
      .find(filter)
      .select('movementStatus vehicleId')
      .lean();

    let inside = 0;
    let expected = 0;
    let overstaying = 0;
    let departed = 0;
    const distinctVehicles = new Set<string>();

    for (const log of logs) {
      distinctVehicles.add(log.vehicleId?.toString());
      if (log.movementStatus === 'Vehicle Inside') inside += 1;
      else if (log.movementStatus === 'Entry Pending') expected += 1;
      else if (log.movementStatus === 'Overstayed') overstaying += 1;
      else if (log.movementStatus === 'Vehicle Exited') departed += 1;
    }

    // Also check upcoming confirmed bookings for expected arrivals that don't have movement logs yet
    const upcomingBookingsCount = await (BookingModel as any).countDocuments({
      parkingLotId: { $in: targetLotIds },
      bookingStatus: 'Confirmed',
    });

    const totalExpected = Math.max(expected, upcomingBookingsCount);

    return {
      ownerLots,
      kpis: {
        totalVehicles: distinctVehicles.size,
        vehiclesInside: inside,
        vehiclesExpected: totalExpected,
        vehiclesOverstaying: overstaying,
        vehiclesDeparted: departed,
      },
    };
  }

  /**
   * OWNER-02: Paginated vehicle listing
   */
  public async getOwnerVehiclesList(ownerId: string, query: OwnerVehiclesListQuery) {
    const { targetLotIds, ownerLots } = await this.getAuthorizedLotIds(ownerId, query.parkingLotId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 15));
    const skip = (page - 1) * limit;

    if (targetLotIds.length === 0) {
      return {
        vehicles: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        ownerLots,
      };
    }

    const filter: Record<string, any> = {
      parkingLotId: { $in: targetLotIds },
    };

    if (query.movementStatus && query.movementStatus !== 'all') {
      filter.movementStatus = query.movementStatus;
    }

    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
    }

    const [logs, total] = await Promise.all([
      (VehicleMovementLogModel as any)
        .find(filter)
        .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel vehicleColor')
        .populate('customerId', 'fullName email mobileNumber')
        .populate('bookingId', 'bookingReference bookingStatus scheduledEntryTime scheduledExitTime totalAmount')
        .populate('parkingLotId', 'parkingName address city')
        .populate('floorId', 'floorName floorNumber')
        .populate('zoneId', 'zoneCode zoneName')
        .populate('slotId', 'slotNumber slotType')
        .sort({ entryTime: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      (VehicleMovementLogModel as any).countDocuments(filter),
    ]);

    const now = new Date();

    const formattedVehicles = logs.map((log: any) => {
      let currentStayMinutes = log.stayDurationMinutes || 0;
      if (log.movementStatus === 'Vehicle Inside' && log.entryTime) {
        currentStayMinutes = Math.max(0, Math.round((now.getTime() - new Date(log.entryTime).getTime()) / 60000));
      }

      let currentOverstayMinutes = log.overstayMinutes || 0;
      if (log.movementStatus === 'Overstayed' && log.gracePeriodEndsAt) {
        currentOverstayMinutes = Math.max(0, Math.round((now.getTime() - new Date(log.gracePeriodEndsAt).getTime()) / 60000));
      }

      return {
        _id: log._id.toString(),
        movementLogId: log._id.toString(),
        bookingId: log.bookingId?._id?.toString() || null,
        bookingReference: log.bookingId?.bookingReference || 'N/A',
        bookingStatus: log.bookingId?.bookingStatus || 'Unknown',
        scheduledEntryTime: log.bookingId?.scheduledEntryTime || null,
        scheduledExitTime: log.bookingId?.scheduledExitTime || null,
        vehicleNumber: log.vehicleId?.vehicleNumber || 'Unknown Plate',
        vehicleType: log.vehicleId?.vehicleType || 'Car',
        vehicleBrand: log.vehicleId?.vehicleBrand || '',
        vehicleModel: log.vehicleId?.vehicleModel || '',
        vehicleColor: log.vehicleId?.vehicleColor || null,
        customerName: log.customerId?.fullName || 'Walk-In Customer',
        customerPhone: log.customerId?.mobileNumber || null,
        customerEmail: log.customerId?.email || null,
        parkingLotName: log.parkingLotId?.parkingName || 'Facility',
        parkingLotId: log.parkingLotId?._id?.toString() || '',
        floorName: log.floorId?.floorName || 'Floor 1',
        zoneCode: log.zoneId?.zoneCode || 'A',
        slotNumber: log.slotId?.slotNumber || 'Bay',
        slotId: log.slotId?._id?.toString() || '',
        entryTime: log.entryTime ? new Date(log.entryTime).toISOString() : null,
        exitTime: log.exitTime ? new Date(log.exitTime).toISOString() : null,
        movementStatus: log.movementStatus,
        entryMethod: log.entryMethod,
        exitMethod: log.exitMethod,
        stayDurationMinutes: currentStayMinutes,
        overstayMinutes: currentOverstayMinutes,
        remarks: log.remarks || null,
      };
    });

    // In-memory search filter if search was requested across populated fields
    let finalVehicles = formattedVehicles;
    if (query.search && query.search.trim()) {
      const term = query.search.trim().toLowerCase();
      finalVehicles = formattedVehicles.filter(
        (v: any) =>
          v.vehicleNumber.toLowerCase().includes(term) ||
          v.bookingReference.toLowerCase().includes(term) ||
          v.customerName.toLowerCase().includes(term) ||
          v.slotNumber.toLowerCase().includes(term),
      );
    }

    if (query.vehicleType && query.vehicleType !== 'all') {
      finalVehicles = finalVehicles.filter(
        (v: any) => v.vehicleType.toLowerCase() === query.vehicleType?.toLowerCase(),
      );
    }

    return {
      vehicles: finalVehicles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      ownerLots,
    };
  }

  /**
   * OWNER-02: Live Vehicle Locator
   * Returns facility floors and real-time bay occupancy with vehicle details
   */
  public async getOwnerLiveVehicleLocator(ownerId: string, parkingLotId: string, floorId?: string) {
    const { targetLotIds, ownerLots } = await this.getAuthorizedLotIds(ownerId, parkingLotId);

    if (targetLotIds.length === 0) {
      throw new AppError('No authorized parking facilities found for this owner.', 404, 'NO_FACILITIES');
    }

    const selectedLotId = targetLotIds[0];
    if (!selectedLotId) {
      throw new AppError('No authorized parking facilities found for this owner.', 404, 'NO_FACILITIES');
    }

    // Fetch floors
    const floors = await (ParkingFloorModel as any)
      .find({ parkingLotId: selectedLotId })
      .sort({ floorNumber: 1 })
      .select('_id floorName floorNumber floorStatus totalSlots')
      .lean();

    if (floors.length === 0) {
      return {
        parkingLot: ownerLots.find((l) => l._id === selectedLotId.toString()) || null,
        floors: [],
        selectedFloor: null,
        slots: [],
        summary: {
          totalSlots: 0,
          occupiedCount: 0,
          expectedCount: 0,
          overstayCount: 0,
          availableCount: 0,
        },
      };
    }

    let activeFloor: any = floors[0];
    if (floorId) {
      const found = floors.find((f: any) => f._id.toString() === floorId);
      if (found) activeFloor = found;
    }

    if (!activeFloor) {
      throw new AppError('Floor not found for this facility.', 404, 'FLOOR_NOT_FOUND');
    }

    // Fetch all slots on this floor
    const slots = await (ParkingSlotModel as any)
      .find({
        parkingLotId: selectedLotId,
        floorId: activeFloor._id,
      })
      .populate('zoneId', 'zoneCode zoneName')
      .sort({ slotNumber: 1 })
      .lean();

    const slotIds = slots.map((s: any) => s._id);

    // Fetch active movement logs for these slots
    const activeMovements = await (VehicleMovementLogModel as any)
      .find({
        slotId: { $in: slotIds },
        movementStatus: { $in: ['Vehicle Inside', 'Overstayed', 'Entry Pending'] },
      })
      .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel vehicleColor')
      .populate('customerId', 'fullName email mobileNumber')
      .populate('bookingId', 'bookingReference bookingStatus scheduledEntryTime scheduledExitTime')
      .lean();

    const movementMap = new Map<string, any>();
    for (const m of activeMovements) {
      movementMap.set(m.slotId.toString(), m);
    }

    const now = new Date();
    let occupiedCount = 0;
    let expectedCount = 0;
    let overstayCount = 0;

    const enrichedSlots = slots.map((s: any) => {
      const activeMov = movementMap.get(s._id.toString());
      let locatorStatus: 'AVAILABLE' | 'PARKED_INSIDE' | 'OVERSTAYING' | 'EXPECTED' | 'MAINTENANCE' =
        'AVAILABLE';

      if (s.slotStatus === 'Under Maintenance') {
        locatorStatus = 'MAINTENANCE';
      } else if (activeMov) {
        if (activeMov.movementStatus === 'Vehicle Inside') {
          locatorStatus = 'PARKED_INSIDE';
          occupiedCount += 1;
        } else if (activeMov.movementStatus === 'Overstayed') {
          locatorStatus = 'OVERSTAYING';
          overstayCount += 1;
        } else if (activeMov.movementStatus === 'Entry Pending') {
          locatorStatus = 'EXPECTED';
          expectedCount += 1;
        }
      } else if (s.isOccupied) {
        locatorStatus = 'PARKED_INSIDE';
        occupiedCount += 1;
      } else if (s.isReserved) {
        locatorStatus = 'EXPECTED';
        expectedCount += 1;
      }

      let currentStayMinutes = 0;
      if (activeMov?.entryTime) {
        currentStayMinutes = Math.max(0, Math.round((now.getTime() - new Date(activeMov.entryTime).getTime()) / 60000));
      }

      return {
        slotId: s._id.toString(),
        slotNumber: s.slotNumber,
        slotType: s.slotType,
        supportedVehicleType: s.supportedVehicleType || 'Car',
        floorId: activeFloor._id.toString(),
        floorName: activeFloor.floorName,
        zoneCode: s.zoneId?.zoneCode || 'A',
        zoneName: s.zoneId?.zoneName || 'General',
        locatorStatus,
        isOccupied: locatorStatus === 'PARKED_INSIDE' || locatorStatus === 'OVERSTAYING',
        isReserved: locatorStatus === 'EXPECTED',
        vehicle: activeMov?.vehicleId
          ? {
              vehicleNumber: activeMov.vehicleId.vehicleNumber,
              vehicleType: activeMov.vehicleId.vehicleType,
              brand: activeMov.vehicleId.vehicleBrand,
              model: activeMov.vehicleId.vehicleModel,
              color: activeMov.vehicleId.vehicleColor,
            }
          : null,
        customer: activeMov?.customerId
          ? {
              fullName: activeMov.customerId.fullName,
              phone: activeMov.customerId.mobileNumber,
              email: activeMov.customerId.email,
            }
          : null,
        booking: activeMov?.bookingId
          ? {
              bookingReference: activeMov.bookingId.bookingReference,
              bookingStatus: activeMov.bookingId.bookingStatus,
              scheduledEntryTime: activeMov.bookingId.scheduledEntryTime,
              scheduledExitTime: activeMov.bookingId.scheduledExitTime,
            }
          : null,
        movement: activeMov
          ? {
              movementStatus: activeMov.movementStatus,
              entryTime: activeMov.entryTime,
              stayDurationMinutes: currentStayMinutes,
              overstayMinutes: activeMov.overstayMinutes || 0,
            }
          : null,
      };
    });

    const availableCount = Math.max(0, slots.length - occupiedCount - expectedCount - overstayCount);

    return {
      parkingLot: ownerLots.find((l) => l._id === selectedLotId.toString()) || null,
      floors: floors.map((f: any) => ({
        _id: f._id.toString(),
        floorName: f.floorName,
        floorNumber: f.floorNumber,
        totalSlots: f.totalSlots,
      })),
      selectedFloor: {
        _id: activeFloor._id.toString(),
        floorName: activeFloor.floorName,
        floorNumber: activeFloor.floorNumber,
      },
      slots: enrichedSlots,
      summary: {
        totalSlots: slots.length,
        occupiedCount,
        expectedCount,
        overstayCount,
        availableCount,
      },
    };
  }
}

export const ownerVehiclesService = new OwnerVehiclesService();
