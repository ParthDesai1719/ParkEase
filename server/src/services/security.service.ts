import crypto from 'node:crypto';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import { BookingModel, type Booking } from '../models/Booking.js';
import { BookingTimelineModel, type BookingTimeline } from '../models/BookingTimeline.js';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { ParkingSlotModel, type ParkingSlot } from '../models/ParkingSlot.js';
import { ParkingFloorModel, type ParkingFloor } from '../models/ParkingFloor.js';
import { ParkingZoneModel, type ParkingZone } from '../models/ParkingZone.js';
import { SecurityStaffAssignmentModel, type SecurityStaffAssignment } from '../models/SecurityStaffAssignment.js';
import { VehicleModel, type Vehicle } from '../models/Vehicle.js';
import { UserModel, type User } from '../models/User.js';
import { RoleModel, type Role } from '../models/Role.js';
import { VehicleMovementLogModel, type VehicleMovementLog } from '../models/VehicleMovementLog.js';
import { PaymentModel, type Payment } from '../models/Payment.js';
import { NotificationModel, type Notification } from '../models/Notification.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { IncidentModel, type Incident } from '../models/Incident.js';
import { customerBookingService } from './customerBooking.service.js';
import { razorpayService } from './razorpay.service.js';
import { emailService } from './email.service.js';
import { emitSlotStatusUpdate, emitBookingStatusUpdate, emitNewNotification, emitIncidentUpdate } from '../socket.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export interface SecurityAssignedFacility {
  assignmentId: string;
  parkingLotId: string;
  parkingName: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  parkingStatus: string;
  isOpen24Hours: boolean;
  openingTime: string | null;
  closingTime: string | null;
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  totalEvSlots: number;
  amenities: string[];
  assignedAt: Date;
  employeeId: string | null;
}

export interface SecurityDashboardStats {
  facility: {
    parkingLotId: string;
    parkingName: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    isOpen24Hours: boolean;
    openingTime: string | null;
    closingTime: string | null;
    totalSlots: number;
  };
  metrics: {
    vehiclesCurrentlyInside: number;
    entriesToday: number;
    exitsToday: number;
    availableSlots: number;
    occupiedSlots: number;
    walkinBookingsToday: number;
    currentOverstays: number;
  };
  recentActivity: Array<{
    id: string;
    eventCode: string;
    eventType: string;
    eventTitle: string;
    eventDescription: string;
    bookingReference: string;
    eventSource: string;
    eventTime: Date;
    performedByName: string | null;
  }>;
}

export interface QrVerificationResult {
  isAuthentic: boolean;
  eligibleForEntry: boolean;
  entryIneligibilityReason: string | null;
  eligibleForExit: boolean;
  exitIneligibilityReason: string | null;
  availableActions: Array<'ALLOW_ENTRY' | 'REJECT' | 'CANCEL' | 'VERIFY_EXIT' | 'COLLECT_OVERSTAY_CASH'>;
  booking: {
    bookingId: string;
    bookingReference: string;
    bookingType: 'ONLINE' | 'WALK_IN';
    bookingStatus: string;
    customer: {
      id: string;
      fullName: string;
      email: string;
      mobileNumber: string;
    };
    vehicle: {
      id: string;
      vehicleNumber: string;
      vehicleType: string;
      vehicleBrand: string;
      vehicleModel: string;
    };
    facility: {
      parkingLotId: string;
      parkingName: string;
      address: string;
      city: string;
      state: string;
      isOpen24Hours: boolean;
      openingTime: string | null;
      closingTime: string | null;
    };
    hierarchy: {
      floorId: string;
      floorName: string;
      floorNumber: number;
      zoneId: string;
      zoneName: string;
      zoneCode: string;
      slotId: string;
      slotNumber: string;
      slotLabel: string;
      slotType: string;
      slotStatus: string;
    };
    timing: {
      scheduledEntryTime: Date;
      scheduledExitTime: Date;
      actualEntryTime: Date | null;
      actualExitTime: Date | null;
      gracePeriodMinutes: number;
      bookingDurationMinutes: number;
    };
    payment: {
      baseAmount: number;
      additionalCharges: number;
      totalAmount: number;
      primaryPaymentStatus: string;
      paymentMethod: string;
    };
    cancellation: {
      isCancelled: boolean;
      cancellationType: string | null;
      cancellationReason: string | null;
      cancelledAt: Date | null;
    };
  };
  overstay: {
    overstayDetected: boolean;
    overstayDurationMinutes: number;
    overstayCharge: number;
    additionalChargePaymentStatus: 'PAID' | 'UNPAID' | 'NOT_APPLICABLE';
  };
}

export interface EntryVerificationResult {
  success: boolean;
  message: string;
  bookingId: string;
  bookingReference: string;
  bookingStatus: 'Active';
  actualEntryTime: Date;
  slot: {
    slotId: string;
    slotNumber: string;
    slotLabel: string;
    slotStatus: 'Occupied';
    floorName: string;
    zoneName: string;
    zoneCode: string;
  };
  movementLogId: string;
}

export interface ExitVerificationResult {
  success: boolean;
  message: string;
  bookingId: string;
  bookingReference: string;
  bookingStatus: 'Completed';
  actualExitTime: Date;
  stayDurationMinutes: number;
  slot: {
    slotId: string;
    slotNumber: string;
    slotStatus: string;
  };
  overstaySettled?: boolean;
  movementLogId: string;
}

export interface CollectOverstayCashResult {
  success: boolean;
  message: string;
  bookingId: string;
  bookingReference: string;
  paymentId: string;
  paymentReference: string;
  amount: number;
  paymentMethod: 'CASH';
  paymentStatus: 'SUCCESSFUL';
  additionalChargePaymentStatus: 'PAID';
}

export interface ManualBookingItem {
  bookingId: string;
  bookingReference: string;
  bookingType: string;
  bookingStatus: string;
  customer: {
    customerId: string;
    fullName: string;
    email: string;
    mobileNumber: string;
  };
  vehicle: {
    vehicleId: string;
    vehicleNumber: string;
    vehicleType: string;
    make: string | null;
    model: string | null;
    color: string | null;
  };
  facility: {
    parkingLotId: string;
    parkingName: string;
    floorName: string;
    zoneName: string;
    slotNumber: string;
    slotIdentifier: string;
  };
  timing: {
    scheduledEntryTime: Date;
    scheduledExitTime: Date;
    actualEntryTime: Date | null;
    actualExitTime: Date | null;
    durationMinutes: number;
    stayDurationMinutes: number | null;
  };
  payment: {
    baseAmount: number;
    totalAmount: number;
    paymentStatus: string;
    paymentMethod: string | null;
  };
  overstay: {
    isOverstay: boolean;
    overstayDurationMinutes: number;
    overstayCharge: number;
    overstayPaymentStatus: 'NOT_APPLICABLE' | 'UNPAID' | 'PAID';
  };
  qrStatus: {
    hasQr: boolean;
    qrStatus: string;
  };
  allowedActions: {
    canAllowEntry: boolean;
    canRejectEntry: boolean;
    canCompleteExit: boolean;
    canRejectExit: boolean;
    canCollectCash: boolean;
  };
}

export interface ManualSearchBookingsResult {
  bookings: ManualBookingItem[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
  summary: {
    total: number;
    confirmed: number;
    active: number;
    overstay: number;
    completed: number;
  };
}

export interface ManualBookingDetailData extends ManualBookingItem {
  timeline: Array<{
    _id: string;
    eventCode: string;
    eventType: string;
    eventTitle: string;
    eventDescription: string;
    eventSource: string;
    eventTime: Date;
    performedByName?: string | null;
  }>;
  movementLogs: Array<{
    _id: string;
    entryTime?: Date;
    exitTime?: Date;
    entryMethod?: string;
    exitMethod?: string;
    stayDurationMinutes?: number;
    vehicleNumberSnapshot?: string;
  }>;
  payments: Array<{
    _id: string;
    paymentReference: string;
    paymentType: string;
    paymentMethod: string;
    paymentStatus: string;
    amount: number;
    createdAt: Date;
  }>;
}

export interface WalkInSlotInfo {
  slotId: string;
  slotNumber: string;
  slotLabel?: string;
  floorId: string;
  floorName: string;
  floorNumber: number;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  supportedVehicleType: string;
  isAvailable: boolean;
}

export interface WalkInGroupedFloor {
  floorId: string;
  floorName: string;
  floorNumber: number;
  zones: Array<{
    zoneId: string;
    zoneCode: string;
    zoneName: string;
    slots: WalkInSlotInfo[];
  }>;
}

export interface WalkInAvailableSlotsResult {
  parkingLotId: string;
  vehicleType: string;
  durationHours: number;
  scheduledEntryTime: string;
  scheduledExitTime: string;
  totalAvailableCount: number;
  recommendedSlot: WalkInSlotInfo | null;
  availableSlots: WalkInSlotInfo[];
  groupedByFloor: WalkInGroupedFloor[];
}

export interface WalkInTariffResult {
  parkingLotId: string;
  vehicleType: string;
  durationHours: number;
  hourlyRate: number;
  baseAmount: number;
  additionalCharges: number;
  totalAmount: number;
  scheduledEntryTime: string;
  scheduledExitTime: string;
  gracePeriodMinutes: number;
}

export interface CreateWalkInBookingInput {
  staffUserId: string;
  parkingLotId: string;
  customerName: string;
  customerMobile: string;
  customerEmail?: string | undefined;
  vehicleNumber: string;
  vehicleType: string;
  durationHours?: number | undefined;
  entryTime?: string | undefined;
  exitTime?: string | undefined;
  slotSelectionMode: 'AUTO' | 'MANUAL';
  slotId?: string | undefined;
  cashCollected: boolean;
  cashAmountCollected: number;
  staffNotes?: string | undefined;
}

export interface SecurityIncidentItem {
  _id: string;
  incidentReference: string;
  parkingLotId: string;
  parkingName: string;
  bookingId: string | null;
  bookingReference?: string | null | undefined;
  vehicleId: string | null;
  vehicleNumber?: string | null | undefined;
  vehicleType?: string | null | undefined;
  customerId: string | null;
  customerName?: string | null | undefined;
  customerMobile?: string | null | undefined;
  reportedBy: {
    userId: string;
    fullName: string;
    role?: string | undefined;
  };
  incidentSource: string;
  incidentType: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  incidentStatus: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed';
  title: string;
  description: string;
  attachments: string[];
  location: string | null;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityIncidentListResult {
  incidents: SecurityIncidentItem[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
  summary: {
    total: number;
    open: number;
    underInvestigation: number;
    resolved: number;
    closed: number;
    critical: number;
  };
}

export interface CreateIncidentInput {
  staffUserId: string;
  parkingLotId: string;
  title: string;
  description: string;
  incidentType: string;
  severity?: 'Low' | 'Medium' | 'High' | 'Critical' | undefined;
  vehicleNumber?: string | undefined;
  bookingReference?: string | undefined;
  attachments?: string[] | undefined;
  location?: string | undefined;
}

export interface UpdateIncidentStatusInput {
  staffUserId: string;
  incidentId: string;
  status: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed';
  resolutionNotes?: string | undefined;
}


export interface WalkInBookingConfirmation {
  success: boolean;
  message: string;
  receiptNumber: string;
  booking: {
    bookingId: string;
    bookingReference: string;
    bookingType: 'WALK_IN';
    bookingStatus: 'Confirmed' | 'Active';
    scheduledEntryTime: string;
    scheduledExitTime: string;
    actualEntryTime?: string | null | undefined;
    durationHours: number;
    durationMinutes: number;
    hourlyRate: number;
    totalAmount: number;
    gracePeriodMinutes: number;
    createdAt: string;
  };
  customer: {
    customerId: string;
    fullName: string;
    mobileNumber: string;
    email: string;
  };
  vehicle: {
    vehicleId: string;
    vehicleNumber: string;
    vehicleType: string;
  };
  parkingLot: {
    parkingLotId: string;
    parkingName: string;
    address: string;
    city: string;
    state: string;
  };
  slot: {
    slotId: string;
    slotNumber: string;
    floorId: string;
    floorName: string;
    floorNumber: number;
    zoneId: string;
    zoneCode: string;
    zoneName: string;
  };
  payment: {
    paymentId: string;
    paymentReference: string;
    paymentMethod: 'CASH';
    paymentStatus: 'SUCCESSFUL';
    paymentType: string;
    amount: number;
    paymentDate: string;
  };
  qrPayload: string;
  qrCodeDataUrl: string;
}

export type MovementType = 'Entry' | 'Exit' | 'Entry Denied' | 'Exit Denied';

export interface MovementLogItem {
  _id: string;
  movementReference: string;
  bookingId: string;
  bookingReference: string;
  bookingStatus: string;
  bookingType: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  vehicleId: string;
  vehicleNumber: string;
  vehicleType: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  parkingLotId: string;
  parkingName: string;
  floorId: string;
  floorName: string;
  floorNumber: number;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  slotId: string;
  slotNumber: string;
  slotLabel?: string;
  movementType: MovementType;
  movementStatus: string;
  entryMethod: string;
  entryTime: Date;
  verifiedByName: string | null;
  verifiedById: string | null;
  exitMethod: string | null;
  exitTime: Date | null;
  exitVerifiedByName: string | null;
  exitVerifiedById: string | null;
  stayDurationMinutes: number;
  formattedDuration: string;
  overstayMinutes: number;
  remarks: string | null;
  createdAt: Date;
}

export interface MovementLogsListResult {
  logs: MovementLogItem[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
  summary: {
    total: number;
    entries: number;
    exits: number;
    denied: number;
    vehiclesInside: number;
  };
  facilityStaffList: Array<{
    staffId: string;
    staffName: string;
    employeeId: string | null;
  }>;
}

export interface MovementLogDetailResult extends MovementLogItem {
  booking: {
    bookingId: string;
    bookingReference: string;
    bookingStatus: string;
    bookingType: string;
    scheduledEntryTime: Date;
    scheduledExitTime: Date;
    actualEntryTime: Date | null;
    actualExitTime: Date | null;
    gracePeriodMinutes: number;
    baseAmount: number;
    additionalCharges: number;
    totalAmount: number;
    overstayCharge: number;
    overstayDetected: boolean;
  };
  timeline: Array<{
    _id: string;
    eventCode: string;
    eventType: string;
    eventTitle: string;
    eventDescription: string;
    eventSource: string;
    eventTime: Date;
    performedByName?: string | null;
  }>;
  payments: Array<{
    _id: string;
    paymentReference: string;
    paymentType: string;
    paymentMethod: string;
    paymentStatus: string;
    amount: number;
    createdAt: Date;
  }>;
}

export interface MovementLogsQueryParams {
  staffUserId: string;
  parkingLotId: string;
  startDate?: string | undefined;
  endDate?: string | undefined;
  movementType?: string | undefined;
  vehicleNumber?: string | undefined;
  customerName?: string | undefined;
  staffId?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

class SecurityService {
  /**
   * Retrieves all active parking facility assignments for the authenticated security staff member.
   */
  public async getSecurityStaffFacilities(staffUserId: string): Promise<SecurityAssignedFacility[]> {
    if (!staffUserId || !mongoose.isValidObjectId(staffUserId)) {
      throw new AppError('Invalid staff user ID.', 400, 'INVALID_USER_ID');
    }

    const staffObjectId = new mongoose.Types.ObjectId(staffUserId);

    const assignments = await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>)
      .find({
        securityStaffId: staffObjectId,
        assignmentStatus: 'Active',
      })
      .populate('parkingLotId')
      .sort({ assignedAt: -1 })
      .lean()
      .exec();

    const facilities: SecurityAssignedFacility[] = [];

    for (const assign of assignments) {
      const lot = assign.parkingLotId as unknown as Record<string, unknown> | null;
      if (!lot || !lot._id) continue;

      const lotId = (lot._id as mongoose.Types.ObjectId).toString();

      // Count live bays
      const totalSlots = typeof lot.totalSlots === 'number' ? lot.totalSlots : (typeof lot.totalCapacity === 'number' ? lot.totalCapacity : 0);
      const availableSlots = typeof lot.availableSlots === 'number' ? lot.availableSlots : 0;
      const occupiedSlots = typeof lot.occupiedSlots === 'number' ? lot.occupiedSlots : 0;

      const totalEvSlots = await (ParkingSlotModel as any).countDocuments({
        parkingLotId: lot._id,
        slotStatus: { $ne: 'Under Maintenance' },
        $or: [{ supportedVehicleType: 'EV' }, { slotType: 'EV Charging' }],
      });

      facilities.push({
        assignmentId: (assign._id as mongoose.Types.ObjectId).toString(),
        parkingLotId: lotId,
        parkingName: String(lot.parkingName || (lot as any).lotName || 'Parking Facility'),
        description: lot.description ? String(lot.description) : null,
        address: String(lot.address || ''),
        city: String(lot.city || ''),
        state: String(lot.state || ''),
        postalCode: String(lot.postalCode || ''),
        parkingStatus: String(lot.parkingStatus || 'Active'),
        isOpen24Hours: Boolean(lot.isOpen24Hours),
        openingTime: lot.openingTime ? String(lot.openingTime) : null,
        closingTime: lot.closingTime ? String(lot.closingTime) : null,
        totalSlots,
        availableSlots,
        occupiedSlots,
        totalEvSlots,
        amenities: Array.isArray(lot.amenities) ? lot.amenities.map(String) : [],
        assignedAt: assign.assignedAt,
        employeeId: assign.employeeId ? String(assign.employeeId) : null,
      });
    }

    return facilities;
  }

  /**
   * Calculates live dashboard statistics and recent activity feed for a specific assigned parking lot.
   */
  public async getSecurityDashboardStats(
    staffUserId: string,
    parkingLotId: string,
  ): Promise<SecurityDashboardStats> {
    if (!mongoose.isValidObjectId(parkingLotId)) {
      throw new AppError('Invalid parking lot ID.', 400, 'INVALID_LOT_ID');
    }

    const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);

    // 1. Reconcile any overdue bookings to ensure 100% current state
    await customerBookingService.reconcileBookingStatuses();

    // 2. Fetch Facility Information
    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(lotObjectId)
      .lean()
      .exec();

    if (!lot) {
      throw new AppError('Parking lot not found.', 404, 'LOT_NOT_FOUND');
    }

    // 3. Define Today's Date Boundaries (00:00:00.000 to 23:59:59.999)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 4. Calculate Operational Metrics from Database Records
    const [
      vehiclesCurrentlyInside,
      entriesToday,
      exitsToday,
      availableSlots,
      occupiedSlots,
      walkinBookingsToday,
      currentOverstays,
    ] = await Promise.all([
      // A. Vehicles currently physically inside (Active or Overstay)
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        parkingLotId: lotObjectId,
        bookingStatus: { $in: ['Active', 'Overstay'] },
      }),

      // B. Entries today (actualEntryTime falls within today)
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        parkingLotId: lotObjectId,
        actualEntryTime: { $gte: todayStart, $lte: todayEnd },
      }),

      // C. Exits today (actualExitTime falls within today)
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        parkingLotId: lotObjectId,
        actualExitTime: { $gte: todayStart, $lte: todayEnd },
      }),

      // D. Available slots in this facility
      (ParkingSlotModel as mongoose.Model<ParkingSlot>).countDocuments({
        parkingLotId: lotObjectId,
        slotStatus: 'Available',
      }),

      // E. Occupied slots in this facility
      (ParkingSlotModel as mongoose.Model<ParkingSlot>).countDocuments({
        parkingLotId: lotObjectId,
        slotStatus: 'Occupied',
      }),

      // F. Walk-in bookings created today
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        parkingLotId: lotObjectId,
        bookingType: 'WALK_IN',
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),

      // G. Current active sessions in Overstay status
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        parkingLotId: lotObjectId,
        bookingStatus: 'Overstay',
      }),
    ]);

    // 5. Fetch Recent Live Activity Feed (Latest 15 events for this parking lot)
    const lotBookingIds = await (BookingModel as mongoose.Model<Booking>)
      .find({ parkingLotId: lotObjectId })
      .distinct('_id');

    let recentActivity: SecurityDashboardStats['recentActivity'] = [];

    if (lotBookingIds.length > 0) {
      const rawTimelines = await (BookingTimelineModel as mongoose.Model<BookingTimeline>)
        .find({ bookingId: { $in: lotBookingIds } })
        .sort({ eventTime: -1 })
        .limit(15)
        .populate('bookingId', 'bookingReference bookingType bookingStatus')
        .populate('performedBy', 'fullName')
        .lean()
        .exec();

      recentActivity = rawTimelines.map((item) => {
        const itemObj = item as unknown as Record<string, unknown>;
        const booking = itemObj.bookingId as { bookingReference?: string } | undefined;
        const performedBy = itemObj.performedBy as { fullName?: string } | undefined;

        return {
          id: (itemObj._id as mongoose.Types.ObjectId).toString(),
          eventCode: String(itemObj.eventCode || 'TIMELINE_EVENT'),
          eventType: String(itemObj.eventType || 'Activity'),
          eventTitle: String(itemObj.eventTitle || 'Activity Logged'),
          eventDescription: String(itemObj.eventDescription || ''),
          bookingReference: booking?.bookingReference || 'N/A',
          eventSource: String(itemObj.eventSource || 'System'),
          eventTime: new Date(itemObj.eventTime as string | Date),
          performedByName: performedBy?.fullName || null,
        };
      });
    }

    const totalSlots =
      typeof lot.totalSlots === 'number'
        ? lot.totalSlots
        : typeof (lot as any).totalCapacity === 'number'
        ? (lot as any).totalCapacity
        : availableSlots + occupiedSlots;

    return {
      facility: {
        parkingLotId: (lot._id as mongoose.Types.ObjectId).toString(),
        parkingName: String(lot.parkingName || (lot as any).lotName || 'Parking Facility'),
        address: String(lot.address || ''),
        city: String(lot.city || ''),
        state: String(lot.state || ''),
        postalCode: String(lot.postalCode || ''),
        isOpen24Hours: Boolean(lot.isOpen24Hours),
        openingTime: lot.openingTime ? String(lot.openingTime) : null,
        closingTime: lot.closingTime ? String(lot.closingTime) : null,
        totalSlots,
      },
      metrics: {
        vehiclesCurrentlyInside,
        entriesToday,
        exitsToday,
        availableSlots,
        occupiedSlots,
        walkinBookingsToday,
        currentOverstays,
      },
      recentActivity,
    };
  }

  /**
   * Helper to parse QR code payloads.
   * Supports:
   * 1. PE-PASS|bookingRef|slotQrId|token (canonical format)
   * 2. PE-PASS|bookingRef|slotQrId
   * 3. Raw bookingReference or direct QR payload
   */
  private parseQrPayload(raw: string): {
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

  private generatePaymentReference(): string {
    return `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  /**
   * Verifies and decodes a scanned QR pass, populates booking, customer, vehicle, and hierarchy
   * details, validates facility authorization, and determines entry/exit eligibility.
   */
  public async verifyQrPass(params: {
    staffUserId: string;
    parkingLotId: string;
    qrPayload: string;
  }): Promise<QrVerificationResult> {
    const { parkingLotId, qrPayload } = params;

    if (!qrPayload || typeof qrPayload !== 'string' || !qrPayload.trim()) {
      throw new AppError('QR code payload is required.', 400, 'INVALID_QR_PAYLOAD');
    }

    const parsed = this.parseQrPayload(qrPayload);

    // Find booking matching raw QR payload or parsed reference
    let booking = await (BookingModel as mongoose.Model<Booking>)
      .findOne({
        $or: [
          { qrCode: parsed.rawPayload },
          ...(parsed.bookingReference ? [{ bookingReference: parsed.bookingReference }] : []),
        ],
      })
      .populate('customerId')
      .populate('vehicleId')
      .populate('parkingLotId')
      .populate('floorId')
      .populate('zoneId')
      .populate('currentSlotId')
      .exec();

    if (!booking) {
      throw new AppError(
        'Invalid or unreadable QR code. No matching booking pass found in the system.',
        404,
        'INVALID_QR_CODE',
      );
    }

    // Enforce Facility Scoping: Staff must be operating at the assigned lot
    const lot = booking.parkingLotId as any;
    if (lot?._id?.toString() !== parkingLotId) {
      throw new AppError(
        `Wrong Parking Facility: This booking is registered for "${lot?.parkingName || 'another facility'}", not your active post.`,
        403,
        'WRONG_PARKING_LOT',
      );
    }

    // Reconcile status to handle auto No-Show and Overstay detection
    const custId = (booking.customerId as any)?._id || booking.customerId;
    if (custId && mongoose.Types.ObjectId.isValid(custId.toString())) {
      await customerBookingService.reconcileBookingStatuses(
        new mongoose.Types.ObjectId(custId.toString()),
      );
    }

    // Re-fetch fresh populated document after reconciliation
    booking = (await (BookingModel as mongoose.Model<Booking>)
      .findById(booking._id)
      .populate('customerId')
      .populate('vehicleId')
      .populate('parkingLotId')
      .populate('floorId')
      .populate('zoneId')
      .populate('currentSlotId')
      .exec())!;

    const customer = booking.customerId as unknown as User;
    const vehicle = booking.vehicleId as unknown as Vehicle;
    const floor = booking.floorId as unknown as ParkingFloor;
    const zone = booking.zoneId as unknown as ParkingZone;
    const slot = booking.currentSlotId as unknown as ParkingSlot;

    // Fetch primary payment and overstay payments
    const payments = await (PaymentModel as mongoose.Model<Payment>)
      .find({ bookingId: booking._id })
      .lean()
      .exec();

    const primaryPayment =
      payments.find((p) => p.paymentTypeCode === 'BOOKING') || payments[0] || null;
    const overstayPayment =
      payments.find(
        (p) => p.paymentTypeCode === 'OVERSTAY' && p.paymentStatus === 'SUCCESSFUL',
      ) || null;

    // Check operating schedule
    let withinOperatingSchedule = true;
    let operatingScheduleRemarks: string | null = null;
    if (!lot.isOpen24Hours && lot.openingTime && lot.closingTime) {
      try {
        customerBookingService.validateOperatingHoursWindow(
          booking.scheduledEntryTime,
          booking.scheduledExitTime,
          {
            isOpen24x7: false,
            openingTime: lot.openingTime,
            closingTime: lot.closingTime,
          },
        );
      } catch (err: unknown) {
        withinOperatingSchedule = false;
        operatingScheduleRemarks =
          err instanceof Error
            ? err.message
            : 'Requested interval falls outside facility operating schedule.';
      }
    }

    // Live Overstay Calculation
    const now = new Date();
    const scheduledExitTime = new Date(booking.scheduledExitTime);
    const gracePeriodMinutes = booking.gracePeriodMinutes || 15;
    const gracePeriodEnd = new Date(scheduledExitTime.getTime() + gracePeriodMinutes * 60 * 1000);

    let overstayDetected = booking.bookingStatus === 'Overstay' || booking.overstayDetected || false;
    let overstayDurationMinutes = booking.overstayDurationMinutes || 0;
    let overstayCharge = booking.overstayCharge || 0;

    if (
      (booking.bookingStatus === 'Active' || booking.bookingStatus === 'Overstay') &&
      now.getTime() > gracePeriodEnd.getTime()
    ) {
      overstayDetected = true;
      overstayDurationMinutes = Math.max(
        1,
        Math.ceil((now.getTime() - scheduledExitTime.getTime()) / (60 * 1000)),
      );
      const billableHours = Math.max(1, Math.ceil(overstayDurationMinutes / 60));
      const ratePerHour = booking.overstayRateAtBooking || booking.parkingRateAtBooking || 0;
      overstayCharge = Math.round(billableHours * ratePerHour);
    }

    let additionalChargePaymentStatus: 'PAID' | 'UNPAID' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';
    if (overstayDetected || booking.bookingStatus === 'Overstay' || overstayCharge > 0) {
      additionalChargePaymentStatus = overstayPayment ? 'PAID' : 'UNPAID';
    }

    // Evaluate Entry Eligibility
    let eligibleForEntry = false;
    let entryIneligibilityReason: string | null = null;

    if (booking.bookingStatus === 'Cancelled') {
      eligibleForEntry = false;
      entryIneligibilityReason = 'Booking was cancelled. Cancelled bookings are strictly denied entry.';
    } else if (booking.bookingStatus === 'No Show') {
      eligibleForEntry = false;
      entryIneligibilityReason = 'Booking was marked as No Show due to expired arrival window. Denied entry.';
    } else if (booking.bookingStatus === 'Active' || booking.bookingStatus === 'Overstay') {
      eligibleForEntry = false;
      entryIneligibilityReason = 'Double Entry Prevented: Vehicle has already entered and is currently inside the facility.';
    } else if (booking.bookingStatus === 'Completed') {
      eligibleForEntry = false;
      entryIneligibilityReason = 'Booking session is already completed.';
    } else if (booking.bookingStatus === 'Pending Payment') {
      eligibleForEntry = false;
      entryIneligibilityReason = 'Booking payment is pending.';
    } else if (booking.bookingStatus === 'Confirmed') {
      if (!slot || slot.slotStatus === 'Under Maintenance') {
        eligibleForEntry = false;
        entryIneligibilityReason = 'Assigned bay is currently unavailable or under maintenance.';
      } else if (
        slot.slotStatus === 'Occupied' &&
        slot.currentBookingId &&
        slot.currentBookingId.toString() !== booking._id.toString()
      ) {
        eligibleForEntry = false;
        entryIneligibilityReason = `Assigned bay ${slot.slotNumber} is currently occupied by another vehicle.`;
      } else if (!withinOperatingSchedule) {
        eligibleForEntry = false;
        entryIneligibilityReason = operatingScheduleRemarks;
      } else {
        eligibleForEntry = true;
      }
    }

    // Evaluate Exit Eligibility
    let eligibleForExit = false;
    let exitIneligibilityReason: string | null = null;

    if (booking.bookingStatus === 'Active') {
      eligibleForExit = true;
    } else if (booking.bookingStatus === 'Overstay') {
      if (additionalChargePaymentStatus === 'PAID') {
        eligibleForExit = true;
      } else {
        eligibleForExit = false;
        exitIneligibilityReason = `Overstay fee of ₹${overstayCharge} is pending. Payment required before exit completion.`;
      }
    } else if (booking.bookingStatus === 'Completed') {
      eligibleForExit = false;
      exitIneligibilityReason = 'Double Exit Prevented: Vehicle has already exited and booking is completed.';
    } else {
      eligibleForExit = false;
      exitIneligibilityReason = 'Vehicle has not entered the parking facility.';
    }

    // Determine Available UI Actions per Module 4 Specification
    const availableActions: Array<'ALLOW_ENTRY' | 'REJECT' | 'CANCEL' | 'VERIFY_EXIT' | 'COLLECT_OVERSTAY_CASH'> = [];
    if (eligibleForEntry) {
      availableActions.push('ALLOW_ENTRY', 'REJECT', 'CANCEL');
    }
    if (eligibleForExit) {
      availableActions.push('VERIFY_EXIT');
    } else if (booking.bookingStatus === 'Overstay' && additionalChargePaymentStatus === 'UNPAID') {
      availableActions.push('COLLECT_OVERSTAY_CASH');
    }

    return {
      isAuthentic: true,
      eligibleForEntry,
      entryIneligibilityReason,
      eligibleForExit,
      exitIneligibilityReason,
      availableActions,
      booking: {
        bookingId: (booking._id as mongoose.Types.ObjectId).toString(),
        bookingReference: booking.bookingReference,
        bookingType: booking.bookingType as 'ONLINE' | 'WALK_IN',
        bookingStatus: booking.bookingStatus,
        customer: {
          id: (customer as any)?._id ? ((customer as any)._id as mongoose.Types.ObjectId).toString() : '',
          fullName: customer ? customer.fullName : 'Guest Driver',
          email: customer ? customer.email : '',
          mobileNumber: customer ? customer.mobileNumber : '',
        },
        vehicle: {
          id: (vehicle as any)?._id ? ((vehicle as any)._id as mongoose.Types.ObjectId).toString() : '',
          vehicleNumber: vehicle ? vehicle.vehicleNumber : 'UNKNOWN',
          vehicleType: vehicle ? vehicle.vehicleType : 'Car',
          vehicleBrand: vehicle ? vehicle.vehicleBrand : '',
          vehicleModel: vehicle ? vehicle.vehicleModel : '',
        },
        facility: {
          parkingLotId: (lot as any)?._id ? ((lot as any)._id as mongoose.Types.ObjectId).toString() : '',
          parkingName: lot?.parkingName || '',
          address: lot?.address || '',
          city: lot?.city || '',
          state: lot?.state || '',
          isOpen24Hours: Boolean(lot?.isOpen24Hours),
          openingTime: lot?.openingTime || null,
          closingTime: lot?.closingTime || null,
        },
        hierarchy: {
          floorId: (floor as any)?._id ? ((floor as any)._id as mongoose.Types.ObjectId).toString() : '',
          floorName: floor ? floor.floorName : 'Floor',
          floorNumber: floor ? floor.floorNumber : 1,
          zoneId: (zone as any)?._id ? ((zone as any)._id as mongoose.Types.ObjectId).toString() : '',
          zoneName: zone ? zone.zoneName : 'Zone',
          zoneCode: zone ? zone.zoneCode : 'Z',
          slotId: (slot as any)?._id ? ((slot as any)._id as mongoose.Types.ObjectId).toString() : '',
          slotNumber: slot ? slot.slotNumber : '',
          slotLabel: slot ? slot.slotLabel : '',
          slotType: slot ? slot.slotType : 'Standard',
          slotStatus: slot ? slot.slotStatus : 'Available',
        },
        timing: {
          scheduledEntryTime: booking.scheduledEntryTime,
          scheduledExitTime: booking.scheduledExitTime,
          actualEntryTime: booking.actualEntryTime || null,
          actualExitTime: booking.actualExitTime || null,
          gracePeriodMinutes: booking.gracePeriodMinutes || 15,
          bookingDurationMinutes: booking.bookingDurationMinutes || 60,
        },
        payment: {
          baseAmount: booking.baseAmount || 0,
          additionalCharges: booking.additionalCharges || 0,
          totalAmount: booking.totalAmount || 0,
          primaryPaymentStatus: primaryPayment?.paymentStatus || 'PENDING',
          paymentMethod: primaryPayment?.paymentMethod || 'RAZORPAY',
        },
        cancellation: {
          isCancelled: booking.bookingStatus === 'Cancelled',
          cancellationType: (booking as any).cancellationType || null,
          cancellationReason: (booking as any).cancellationReason || null,
          cancelledAt: (booking as any).cancelledAt || null,
        },
      },
      overstay: {
        overstayDetected,
        overstayDurationMinutes,
        overstayCharge,
        additionalChargePaymentStatus,
      },
    };
  }

  /**
   * Executes atomic physical vehicle entry verification at the gate.
   * Transitions slot to Occupied, booking to Active, writes VehicleMovementLog,
   * records BookingTimeline, logs AuditLog, and emits Socket.IO updates.
   */
  public async recordVehicleEntry(params: {
    staffUserId: string;
    parkingLotId: string;
    bookingId: string;
    entryMethod?: 'QR Code' | 'Manual Verification';
    notes?: string;
  }): Promise<EntryVerificationResult> {
    const { staffUserId, parkingLotId, bookingId, entryMethod = 'QR Code' } = params;

    if (!mongoose.isValidObjectId(bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const session = await mongoose.startSession();
    let resultBooking: any = null;
    let resultSlot: any = null;
    let resultFloor: any = null;
    let resultZone: any = null;
    let movementLogId = '';

    try {
      await session.withTransaction(async () => {
        const booking = await (BookingModel as mongoose.Model<Booking>)
          .findById(bookingId)
          .session(session)
          .exec();

        if (!booking) {
          throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
        }

        if (booking.parkingLotId.toString() !== parkingLotId) {
          throw new AppError('This booking is not assigned to this facility.', 403, 'WRONG_PARKING_LOT');
        }

        if (booking.bookingStatus === 'Cancelled') {
          throw new AppError('Cannot check in a cancelled booking.', 409, 'BOOKING_CANCELLED');
        }

        if (booking.bookingStatus === 'No Show') {
          throw new AppError('Cannot check in a No Show booking.', 409, 'BOOKING_NO_SHOW');
        }

        if (booking.actualEntryTime) {
          throw new AppError('Vehicle has already entered (Double Entry prevented).', 409, 'DOUBLE_ENTRY_PREVENTED');
        }

        if (booking.bookingStatus !== 'Confirmed') {
          throw new AppError(
            `Cannot record entry: booking status is '${booking.bookingStatus}' (must be 'Confirmed').`,
            409,
            'INVALID_BOOKING_STATE_FOR_ENTRY',
          );
        }

        const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
          .findById(booking.currentSlotId)
          .session(session)
          .exec();

        if (!slot || slot.slotStatus === 'Under Maintenance') {
          throw new AppError('Assigned bay is currently unavailable or under maintenance.', 409, 'SLOT_UNAVAILABLE_FOR_ENTRY');
        }

        if (
          slot.slotStatus === 'Occupied' &&
          slot.currentBookingId &&
          slot.currentBookingId.toString() !== booking._id.toString()
        ) {
          throw new AppError(`Slot ${slot.slotNumber} is currently occupied by another vehicle.`, 409, 'SLOT_OCCUPIED_CONFLICT');
        }

        const actualEntry = new Date();
        booking.bookingStatus = 'Active';
        booking.actualEntryTime = actualEntry;
        await booking.save({ session });

        slot.slotStatus = 'Occupied';
        slot.currentBookingId = booking._id as mongoose.Types.ObjectId;
        await slot.save({ session });

        await customerBookingService.reconcileHierarchyCounters({
          parkingLotId: booking.parkingLotId as mongoose.Types.ObjectId,
          floorId: booking.floorId as mongoose.Types.ObjectId,
          zoneId: booking.zoneId as mongoose.Types.ObjectId,
          session,
        });

        // Upsert / Write VehicleMovementLog
        let mLog = await (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>)
          .findOne({ bookingId: booking._id })
          .session(session);

        const graceEnds =
          booking.gracePeriodEndsAt ||
          new Date(booking.scheduledExitTime.getTime() + (booking.gracePeriodMinutes || 15) * 60 * 1000);

        if (mLog) {
          mLog.entryMethod = entryMethod;
          mLog.entryTime = actualEntry;
          mLog.verifiedBy = new mongoose.Types.ObjectId(staffUserId);
          mLog.movementStatus = 'Vehicle Inside';
          mLog.slotId = slot._id as mongoose.Types.ObjectId;
          mLog.gracePeriodEndsAt = graceEnds;
          if (params.notes) mLog.remarks = params.notes;
          await mLog.save({ session });
        } else {
          const createdLogs = await (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>).create(
            [
              {
                bookingId: booking._id,
                customerId: booking.customerId,
                vehicleId: booking.vehicleId,
                parkingLotId: booking.parkingLotId,
                floorId: booking.floorId,
                zoneId: booking.zoneId,
                slotId: slot._id,
                verifiedBy: new mongoose.Types.ObjectId(staffUserId),
                entryMethod,
                entryTime: actualEntry,
                gracePeriodEndsAt: graceEnds,
                stayDurationMinutes: 0,
                overstayMinutes: 0,
                movementStatus: 'Vehicle Inside',
                remarks: params.notes || 'Vehicle gate entry verified.',
              },
            ],
            { session },
          );
          mLog = createdLogs[0] || null;
        }
        movementLogId = mLog ? ((mLog as any)._id as mongoose.Types.ObjectId).toString() : '';

        // Booking Timeline Event
        await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create(
          [
            {
              bookingId: booking._id,
              performedBy: new mongoose.Types.ObjectId(staffUserId),
              eventCode: 'VEHICLE_ENTERED',
              eventType: 'Vehicle Entered',
              eventTitle: 'Vehicle Checked In',
              eventDescription: `Vehicle entered through gate. Bay ${slot.slotNumber} marked Occupied. Method: ${entryMethod}.`,
              eventSource: 'Security Staff',
              eventTime: actualEntry,
              metadata: {
                slotNumber: slot.slotNumber,
                entryMethod,
                movementLogId,
              },
            },
          ],
          { session, ordered: true },
        );

        // Audit Log Entry
        await (AuditLogModel as any).create(
          [
            {
              userId: new mongoose.Types.ObjectId(staffUserId),
              actionCode: 'VEHICLE_ENTRY_VERIFIED',
              module: 'Security',
              actionTitle: 'Vehicle Gate Entry Verified',
              description: `Security officer verified gate entry for booking ${booking.bookingReference} (Bay ${slot.slotNumber}).`,
              targetCollection: 'bookings',
              targetDocumentId: booking._id,
              actionStatus: 'Success',
            },
          ],
          { session, ordered: true },
        );

        resultBooking = booking;
        resultSlot = slot;

        resultFloor = (await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
          .findById(booking.floorId)
          .session(session)
          .lean()) as ParkingFloor | null;
        resultZone = (await (ParkingZoneModel as mongoose.Model<ParkingZone>)
          .findById(booking.zoneId)
          .session(session)
          .lean()) as ParkingZone | null;
      });
    } finally {
      await session.endSession();
    }

    // Post-commit Socket.IO Broadcasts
    emitSlotStatusUpdate({
      parkingLotId,
      floorId: (resultBooking!.floorId as mongoose.Types.ObjectId).toString(),
      zoneId: (resultBooking!.zoneId as mongoose.Types.ObjectId).toString(),
      slotId: (resultSlot!._id as mongoose.Types.ObjectId).toString(),
      slotNumber: resultSlot!.slotNumber,
      slotStatus: 'Occupied',
      timestamp: resultBooking!.actualEntryTime!.toISOString(),
    });

    emitBookingStatusUpdate({
      bookingId: (resultBooking!._id as mongoose.Types.ObjectId).toString(),
      bookingReference: resultBooking!.bookingReference,
      parkingLotId,
      customerId: (resultBooking!.customerId as mongoose.Types.ObjectId).toString(),
      bookingStatus: 'Active',
      timestamp: resultBooking!.actualEntryTime!.toISOString(),
    });

    return {
      success: true,
      message: `Vehicle entry verified successfully. Bay ${resultSlot!.slotNumber} is now Occupied.`,
      bookingId: (resultBooking!._id as mongoose.Types.ObjectId).toString(),
      bookingReference: resultBooking!.bookingReference,
      bookingStatus: 'Active',
      actualEntryTime: resultBooking!.actualEntryTime!,
      slot: {
        slotId: (resultSlot!._id as mongoose.Types.ObjectId).toString(),
        slotNumber: resultSlot!.slotNumber,
        slotLabel: resultSlot!.slotLabel,
        slotStatus: 'Occupied',
        floorName: resultFloor?.floorName || 'Ground Floor',
        zoneName: resultZone?.zoneName || 'Zone A',
        zoneCode: resultZone?.zoneCode || 'A',
      },
      movementLogId,
    };
  }

  /**
   * Executes atomic physical vehicle exit verification at the gate.
   * Enforces mandatory overstay payment settlement before completion,
   * marks booking Completed, releases slot to Available (or immediate hand-off),
   * updates VehicleMovementLog, records BookingTimeline, logs AuditLog,
   * and broadcasts Socket.IO events.
   */
  public async completeVehicleExit(params: {
    staffUserId: string;
    parkingLotId: string;
    bookingId: string;
    exitMethod?: 'QR Code' | 'Manual Verification';
    notes?: string;
  }): Promise<ExitVerificationResult> {
    const { staffUserId, parkingLotId, bookingId, exitMethod = 'QR Code' } = params;

    if (!mongoose.isValidObjectId(bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const session = await mongoose.startSession();
    let resultBooking: any = null;
    let resultSlot: any = null;
    let computedDurationMinutes = 0;
    let movementLogId = '';
    let overstaySettled = false;

    try {
      await session.withTransaction(async () => {
        const booking = await (BookingModel as mongoose.Model<Booking>)
          .findById(bookingId)
          .session(session)
          .exec();

        if (!booking) {
          throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
        }

        if (booking.parkingLotId.toString() !== parkingLotId) {
          throw new AppError('This booking is not assigned to this facility.', 403, 'WRONG_PARKING_LOT');
        }

        if (booking.actualExitTime || booking.bookingStatus === 'Completed') {
          throw new AppError('Vehicle has already exited (Double Exit prevented).', 409, 'DOUBLE_EXIT_PREVENTED');
        }

        if (booking.bookingStatus !== 'Active' && booking.bookingStatus !== 'Overstay') {
          throw new AppError(
            `Cannot complete exit: booking status is '${booking.bookingStatus}' (must be 'Active' or 'Overstay').`,
            409,
            'INVALID_BOOKING_STATE_FOR_EXIT',
          );
        }

        // MANDATORY OVERSTAY PAYMENT ENFORCEMENT:
        if (booking.bookingStatus === 'Overstay' || (booking.overstayCharge && booking.overstayCharge > 0)) {
          const overstayPayment = await (PaymentModel as mongoose.Model<Payment>)
            .findOne({
              bookingId: booking._id,
              paymentTypeCode: 'OVERSTAY',
              paymentStatus: 'SUCCESSFUL',
            })
            .session(session)
            .exec();

          if (!overstayPayment) {
            throw new AppError(
              `Cannot complete exit: Outstanding overstay charge of ₹${booking.overstayCharge || 0} must be settled before vehicle can leave.`,
              409,
              'OVERSTAY_PAYMENT_PENDING',
            );
          }
          overstaySettled = true;
        }

        const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
          .findById(booking.currentSlotId)
          .session(session)
          .exec();

        if (!slot) {
          throw new AppError('Assigned parking slot not found.', 404, 'SLOT_NOT_FOUND');
        }

        const actualExit = new Date();
        const entryRef = booking.actualEntryTime ?? booking.scheduledEntryTime;
        computedDurationMinutes = Math.max(1, Math.ceil((actualExit.getTime() - entryRef.getTime()) / (60 * 1000)));

        booking.bookingStatus = 'Completed';
        booking.actualExitTime = actualExit;
        await booking.save({ session });

        // Release physical slot (transitions to Available or hands off to next immediate Confirmed booking)
        await customerBookingService.releaseOrHandOffPhysicalSlot({
          slot,
          releasedBookingId: booking._id as mongoose.Types.ObjectId,
          gracePeriodMinutes: booking.gracePeriodMinutes || 15,
          session,
        });

        // Update VehicleMovementLog
        let mLog = await (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>)
          .findOne({ bookingId: booking._id })
          .session(session);

        const graceEnds =
          booking.gracePeriodEndsAt ||
          new Date(booking.scheduledExitTime.getTime() + (booking.gracePeriodMinutes || 15) * 60 * 1000);

        if (mLog) {
          mLog.exitMethod = exitMethod;
          mLog.exitTime = actualExit;
          mLog.exitVerifiedBy = new mongoose.Types.ObjectId(staffUserId);
          mLog.stayDurationMinutes = computedDurationMinutes;
          mLog.overstayMinutes = booking.overstayDurationMinutes || 0;
          mLog.movementStatus = 'Vehicle Exited';
          if (params.notes) mLog.remarks = params.notes;
          await mLog.save({ session });
        } else {
          const createdLogs = await (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>).create(
            [
              {
                bookingId: booking._id,
                customerId: booking.customerId,
                vehicleId: booking.vehicleId,
                parkingLotId: booking.parkingLotId,
                floorId: booking.floorId,
                zoneId: booking.zoneId,
                slotId: slot._id,
                verifiedBy: booking.actualEntryTime ? new mongoose.Types.ObjectId(staffUserId) : null,
                exitVerifiedBy: new mongoose.Types.ObjectId(staffUserId),
                entryMethod: 'QR Code',
                exitMethod,
                entryTime: booking.actualEntryTime || booking.scheduledEntryTime,
                exitTime: actualExit,
                gracePeriodEndsAt: graceEnds,
                stayDurationMinutes: computedDurationMinutes,
                overstayMinutes: booking.overstayDurationMinutes || 0,
                movementStatus: 'Vehicle Exited',
                remarks: params.notes || 'Vehicle gate exit verified.',
              },
            ],
            { session },
          );
          mLog = createdLogs[0] || null;
        }
        movementLogId = mLog ? ((mLog as any)._id as mongoose.Types.ObjectId).toString() : '';

        // Booking Timeline Events
        await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create(
          [
            {
              bookingId: booking._id,
              performedBy: new mongoose.Types.ObjectId(staffUserId),
              eventCode: 'VEHICLE_EXITED',
              eventType: 'Vehicle Exited',
              eventTitle: 'Vehicle Checked Out',
              eventDescription: `Vehicle exited gate via QR verification. Bay ${slot.slotNumber} released (Status: ${slot.slotStatus}).`,
              eventSource: 'Security Staff',
              eventTime: actualExit,
              metadata: {
                slotNumber: slot.slotNumber,
                exitMethod,
                stayDurationMinutes: computedDurationMinutes,
                movementLogId,
              },
            },
            {
              bookingId: booking._id,
              performedBy: null,
              eventCode: 'BOOKING_COMPLETED',
              eventType: 'Booking Completed',
              eventTitle: 'Booking Completed',
              eventDescription: `Booking ${booking.bookingReference} completed after ${computedDurationMinutes} minute(s).`,
              eventSource: 'System',
              eventTime: actualExit,
            },
          ],
          { session, ordered: true },
        );

        // Audit Log Entry
        await (AuditLogModel as any).create(
          [
            {
              userId: new mongoose.Types.ObjectId(staffUserId),
              actionCode: 'VEHICLE_EXIT_VERIFIED',
              module: 'Security',
              actionTitle: 'Vehicle Gate Exit Verified',
              description: `Security officer verified gate exit for booking ${booking.bookingReference}. Duration: ${computedDurationMinutes} mins.`,
              targetCollection: 'bookings',
              targetDocumentId: booking._id,
              actionStatus: 'Success',
            },
          ],
          { session, ordered: true },
        );

        resultBooking = booking;
        resultSlot = slot;
      });
    } finally {
      await session.endSession();
    }

    // Post-commit Socket.IO Broadcasts
    emitSlotStatusUpdate({
      parkingLotId,
      floorId: (resultBooking!.floorId as mongoose.Types.ObjectId).toString(),
      zoneId: (resultBooking!.zoneId as mongoose.Types.ObjectId).toString(),
      slotId: (resultSlot!._id as mongoose.Types.ObjectId).toString(),
      slotNumber: resultSlot!.slotNumber,
      slotStatus: resultSlot!.slotStatus,
      timestamp: resultBooking!.actualExitTime!.toISOString(),
    });

    emitBookingStatusUpdate({
      bookingId: (resultBooking!._id as mongoose.Types.ObjectId).toString(),
      bookingReference: resultBooking!.bookingReference,
      parkingLotId,
      customerId: (resultBooking!.customerId as mongoose.Types.ObjectId).toString(),
      bookingStatus: 'Completed',
      timestamp: resultBooking!.actualExitTime!.toISOString(),
    });

    return {
      success: true,
      message: `Vehicle exit verified successfully. Booking ${resultBooking!.bookingReference} completed.`,
      bookingId: (resultBooking!._id as mongoose.Types.ObjectId).toString(),
      bookingReference: resultBooking!.bookingReference,
      bookingStatus: 'Completed',
      actualExitTime: resultBooking!.actualExitTime!,
      stayDurationMinutes: computedDurationMinutes,
      slot: {
        slotId: (resultSlot!._id as mongoose.Types.ObjectId).toString(),
        slotNumber: resultSlot!.slotNumber,
        slotStatus: resultSlot!.slotStatus,
      },
      overstaySettled,
      movementLogId,
    };
  }

  /**
   * Collects cash for overstay charges at the gate.
   * Supports both:
   * 1. Walk-in bookings (cash by specification)
   * 2. Online bookings where online payment could not be completed (Cash Fallback at exit)
   */
  public async collectOverstayCash(params: {
    staffUserId: string;
    parkingLotId: string;
    bookingId: string;
    amount: number;
    notes?: string;
  }): Promise<CollectOverstayCashResult> {
    const { staffUserId, parkingLotId, bookingId, amount } = params;

    if (!mongoose.isValidObjectId(bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const booking = await (BookingModel as mongoose.Model<Booking>).findById(bookingId);
    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.parkingLotId.toString() !== parkingLotId) {
      throw new AppError('This booking is not assigned to this facility.', 403, 'WRONG_PARKING_LOT');
    }

    if (booking.bookingStatus !== 'Overstay' && (!booking.overstayCharge || booking.overstayCharge <= 0)) {
      throw new AppError('This booking is not in an Overstay state requiring payment.', 400, 'NOT_IN_OVERSTAY');
    }

    // Exact backend calculated amount enforcement
    const requiredAmount = booking.overstayCharge || 0;
    if (amount !== requiredAmount) {
      throw new AppError(
        `Staff cannot modify charge: Exact outstanding amount of ₹${requiredAmount} must be collected.`,
        400,
        'AMOUNT_MISMATCH',
      );
    }

    // Prevent duplicate cash collection
    const existingPayment = await (PaymentModel as mongoose.Model<Payment>).findOne({
      bookingId: booking._id,
      paymentTypeCode: 'OVERSTAY',
      paymentStatus: 'SUCCESSFUL',
    });

    if (existingPayment) {
      throw new AppError('Overstay charges for this booking have already been settled.', 409, 'OVERSTAY_ALREADY_PAID');
    }

    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>).findById(booking.parkingLotId).lean();
    const paymentReference = this.generatePaymentReference();

    const payment = await (PaymentModel as mongoose.Model<Payment>).create({
      paymentReference,
      bookingId: booking._id,
      customerId: booking.customerId,
      ownerId: lot?.ownerId || null,
      parkingLotId: booking.parkingLotId,
      paymentType: 'Overstay Charges',
      paymentTypeCode: 'OVERSTAY',
      paymentMethod: 'CASH',
      paymentStatus: 'SUCCESSFUL',
      amount: requiredAmount,
      additionalCharges: 0,
      refundAmount: 0,
      paymentDate: new Date(),
      remarks:
        booking.bookingType === 'ONLINE'
          ? 'Overstay cash collected at gate (Online Payment Fallback).'
          : 'Overstay cash collected at gate (Walk-in Booking).',
    });

    // Update Booking amounts
    booking.additionalCharges = requiredAmount;
    booking.totalAmount = (booking.baseAmount || 0) + requiredAmount;
    await booking.save();

    // Timeline Record
    await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create({
      bookingId: booking._id,
      performedBy: new mongoose.Types.ObjectId(staffUserId),
      eventCode: 'OVERSTAY_CASH_COLLECTED',
      eventType: 'Overstay Cash Collected',
      eventTitle: 'Overstay Payment Collected (Cash)',
      eventDescription: `Security staff collected ₹${requiredAmount} cash at exit gate (${booking.bookingType === 'ONLINE' ? 'Online Fallback' : 'Walk-in'}).`,
      eventSource: 'Security Staff',
      eventTime: new Date(),
      metadata: {
        paymentReference,
        amount: requiredAmount,
        paymentMethod: 'CASH',
      },
    });

    // Audit Log Record
    await (AuditLogModel as any).create({
      userId: new mongoose.Types.ObjectId(staffUserId),
      actionCode: 'OVERSTAY_CASH_COLLECTED',
      module: 'Payment Management',
      actionTitle: 'Overstay Cash Collected at Exit Gate',
      description: `Security officer collected ₹${requiredAmount} cash for overstay on booking ${booking.bookingReference}.`,
      targetCollection: 'payments',
      targetDocumentId: payment._id,
      actionStatus: 'Success',
    });

    // In-app Notification for Customer
    const notif = await (NotificationModel as any).create({
      notificationReference: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      userId: booking.customerId,
      bookingId: booking._id,
      paymentId: payment._id,
      notificationType: 'Payment',
      eventType: 'Overstay Cash Collected',
      title: 'Overstay Payment Received (Cash)',
      message: `Cash payment of ₹${requiredAmount} for overstay parking was collected at the exit gate.`,
      priority: 'Normal',
      deliveryChannel: 'In-App',
      deliveryStatus: 'Delivered',
      isRead: false,
    });
    emitNewNotification(booking.customerId.toString(), notif);

    // Socket.IO event for dashboard update
    emitBookingStatusUpdate({
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      parkingLotId: booking.parkingLotId.toString(),
      customerId: booking.customerId.toString(),
      bookingStatus: booking.bookingStatus,
      paymentStatus: 'SUCCESSFUL',
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: `Overstay cash payment of ₹${requiredAmount} recorded successfully.`,
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      paymentId: (payment._id as mongoose.Types.ObjectId).toString(),
      paymentReference,
      amount: requiredAmount,
      paymentMethod: 'CASH',
      paymentStatus: 'SUCCESSFUL',
      additionalChargePaymentStatus: 'PAID',
    };
  }

  /**
   * Initiates online Razorpay payment order for customer overstay charges.
   */
  public async initiateCustomerOverstayPayment(params: {
    customerId: string;
    bookingId: string;
  }): Promise<{
    orderId: string;
    amount: number;
    amountPaise: number;
    currency: string;
    keyId: string;
    bookingReference: string;
    paymentReference: string;
  }> {
    const { customerId, bookingId } = params;

    const booking = await (BookingModel as mongoose.Model<Booking>).findById(bookingId);
    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.customerId.toString() !== customerId) {
      throw new AppError('Unauthorized access to booking payment.', 403, 'FORBIDDEN');
    }

    if (booking.bookingStatus !== 'Overstay' && (!booking.overstayCharge || booking.overstayCharge <= 0)) {
      throw new AppError('Booking does not currently have pending overstay charges.', 400, 'NO_PENDING_OVERSTAY');
    }

    // Check if already paid
    const existing = await (PaymentModel as mongoose.Model<Payment>).findOne({
      bookingId: booking._id,
      paymentTypeCode: 'OVERSTAY',
      paymentStatus: 'SUCCESSFUL',
    });
    if (existing) {
      throw new AppError('Overstay charges have already been paid.', 409, 'OVERSTAY_ALREADY_PAID');
    }

    const amount = booking.overstayCharge;
    const amountPaise = Math.round(amount * 100);
    const receipt = `OVR-${booking.bookingReference.slice(-8)}-${Date.now().toString().slice(-4)}`;

    const order = await razorpayService.createOrder({
      amountPaise,
      receipt,
      notes: {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        type: 'OVERSTAY_CHARGE',
      },
    });

    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>).findById(booking.parkingLotId).lean();
    const paymentReference = this.generatePaymentReference();

    await (PaymentModel as mongoose.Model<Payment>).create({
      paymentReference,
      bookingId: booking._id,
      customerId: booking.customerId,
      ownerId: lot?.ownerId || null,
      parkingLotId: booking.parkingLotId,
      paymentType: 'Overstay Charges',
      paymentTypeCode: 'OVERSTAY',
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'PENDING',
      gatewayOrderId: order.id,
      amount,
      additionalCharges: 0,
      refundAmount: 0,
      remarks: `Online overstay payment for booking ${booking.bookingReference}`,
    });

    return {
      orderId: order.id,
      amount,
      amountPaise,
      currency: order.currency || 'INR',
      keyId: env.RAZORPAY_KEY_ID,
      bookingReference: booking.bookingReference,
      paymentReference,
    };
  }

  /**
   * Verifies customer online Razorpay signature for overstay charges.
   */
  public async verifyCustomerOverstayPayment(params: {
    customerId: string;
    bookingId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<{
    success: boolean;
    message: string;
    paymentReference: string;
    amount: number;
    paymentStatus: 'SUCCESSFUL';
  }> {
    const { customerId, bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;

    const booking = await (BookingModel as mongoose.Model<Booking>).findById(bookingId);
    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.customerId.toString() !== customerId) {
      throw new AppError('Unauthorized access to booking payment.', 403, 'FORBIDDEN');
    }

    const payment = await (PaymentModel as mongoose.Model<Payment>).findOne({
      bookingId: booking._id,
      gatewayOrderId: razorpay_order_id,
      paymentTypeCode: 'OVERSTAY',
    });

    if (!payment) {
      throw new AppError('Matching payment record not found.', 404, 'PAYMENT_NOT_FOUND');
    }

    const isValid = razorpayService.verifySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      payment.paymentStatus = 'FAILED';
      payment.remarks = 'Razorpay signature verification failed for overstay charge.';
      await payment.save();

      await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create({
        bookingId: booking._id,
        performedBy: new mongoose.Types.ObjectId(customerId),
        eventCode: 'PAYMENT_FAILED',
        eventType: 'Payment Failed',
        eventTitle: 'Overstay Payment Failed',
        eventDescription: 'Cryptographic signature verification failed for Razorpay overstay transaction.',
        eventSource: 'Customer',
      });

      throw new AppError('Payment signature verification failed.', 400, 'PAYMENT_SIGNATURE_INVALID');
    }

    payment.paymentStatus = 'SUCCESSFUL';
    payment.gatewayPaymentId = razorpay_payment_id;
    payment.gatewaySignature = razorpay_signature;
    payment.paymentDate = new Date();
    await payment.save();

    booking.additionalCharges = payment.amount;
    booking.totalAmount = (booking.baseAmount || 0) + payment.amount;
    await booking.save();

    // Timeline Event
    await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create({
      bookingId: booking._id,
      performedBy: new mongoose.Types.ObjectId(customerId),
      eventCode: 'OVERSTAY_PAYMENT_SUCCESSFUL',
      eventType: 'Overstay Payment Successful',
      eventTitle: 'Overstay Charges Paid Online',
      eventDescription: `Customer paid ₹${payment.amount} for overstay charges via Razorpay.`,
      eventSource: 'Customer',
      eventTime: new Date(),
    });

    // Audit Log Event
    await (AuditLogModel as any).create({
      userId: new mongoose.Types.ObjectId(customerId),
      actionCode: 'OVERSTAY_PAYMENT_SUCCESSFUL',
      module: 'Payment Management',
      actionTitle: 'Overstay Online Payment Verified',
      description: `Online Razorpay payment of ₹${payment.amount} verified for booking ${booking.bookingReference}.`,
      targetCollection: 'payments',
      targetDocumentId: payment._id,
      actionStatus: 'Success',
    });

    emitBookingStatusUpdate({
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      parkingLotId: booking.parkingLotId.toString(),
      customerId: booking.customerId.toString(),
      bookingStatus: booking.bookingStatus,
      paymentStatus: 'SUCCESSFUL',
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Overstay payment verified successfully.',
      paymentReference: payment.paymentReference,
      amount: payment.amount,
      paymentStatus: 'SUCCESSFUL',
    };
  }

  /**
   * Helper to verify that staff is assigned to the target parking lot, or is Admin.
   */
  private async assertStaffLotAssignment(staffUserId: string, parkingLotId: string): Promise<void> {
    if (!mongoose.isValidObjectId(parkingLotId)) {
      throw new AppError('Invalid parking lot ID.', 400, 'INVALID_LOT_ID');
    }

    if (!mongoose.isValidObjectId(staffUserId)) {
      throw new AppError('Invalid staff user ID.', 400, 'INVALID_USER_ID');
    }

    const assignment = await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>)
      .findOne({
        securityStaffId: new mongoose.Types.ObjectId(staffUserId),
        parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
        assignmentStatus: 'Active',
      })
      .lean()
      .exec();

    if (!assignment) {
      const user = await (UserModel as mongoose.Model<User>)
        .findById(staffUserId)
        .populate('roleId')
        .lean()
        .exec();
      const roleCode = (user?.roleId as any)?.roleCode;
      if (roleCode !== 'ADMIN') {
        throw new AppError(
          'Access denied: You are not actively assigned to this parking facility.',
          403,
          'FORBIDDEN_LOT_ACCESS',
        );
      }
    }
  }

  /**
   * Searches and retrieves bookings for manual gate verification fallback.
   * Scoped strictly to the authenticated staff member's active facility.
   * Multi-criteria search supports: Vehicle Number, Booking Reference, Customer Name, Mobile Number.
   */
  public async searchManualBookings(params: {
    staffUserId: string;
    parkingLotId: string;
    query?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ManualSearchBookingsResult> {
    const { staffUserId, parkingLotId, query, status, page = 1, limit = 10 } = params;

    await this.assertStaffLotAssignment(staffUserId, parkingLotId);

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const baseFilter: Record<string, any> = {
      parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
    };

    if (query && query.trim().length > 0) {
      const q = query.trim();
      const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedQuery, 'i');

      const matchingUsers = await (UserModel as mongoose.Model<User>)
        .find({
          $or: [{ fullName: regex }, { mobileNumber: regex }, { email: regex }],
        })
        .select('_id')
        .lean()
        .exec();
      const userIds = matchingUsers.map((u) => u._id);

      const matchingVehicles = await (VehicleModel as mongoose.Model<Vehicle>)
        .find({ vehicleNumber: regex })
        .select('_id')
        .lean()
        .exec();
      const vehicleIds = matchingVehicles.map((v) => v._id);

      baseFilter.$or = [
        { bookingReference: regex },
        ...(userIds.length > 0 ? [{ customerId: { $in: userIds } }] : []),
        ...(vehicleIds.length > 0 ? [{ vehicleId: { $in: vehicleIds } }] : []),
      ];
    }

    const statusFilter: Record<string, any> = { ...baseFilter };
    if (status && status !== 'All') {
      if (status === 'Overstay') {
        statusFilter.bookingStatus = 'Overstay';
      } else {
        statusFilter.bookingStatus = status as any;
      }
    }

    const [totalCount, bookings, totalSummary] = await Promise.all([
      (BookingModel as mongoose.Model<Booking>).countDocuments(statusFilter),
      (BookingModel as mongoose.Model<Booking>)
        .find(statusFilter)
        .sort({ updatedAt: -1, scheduledEntryTime: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('customerId', 'fullName email mobileNumber')
        .populate('vehicleId', 'vehicleNumber vehicleType make model color vehicleModel')
        .populate('currentSlotId', 'slotNumber slotLabel slotType slotStatus qrIdentifier')
        .populate('floorId', 'floorName floorNumber')
        .populate('zoneId', 'zoneName zoneCode')
        .populate('parkingLotId', 'parkingName address city state postalCode isOpen24Hours')
        .lean()
        .exec(),
      (BookingModel as mongoose.Model<Booking>).aggregate([
        { $match: { parkingLotId: new mongoose.Types.ObjectId(parkingLotId) } },
        {
          $group: {
            _id: '$bookingStatus',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summaryMap: Record<string, number> = {};
    for (const item of totalSummary) {
      if (item._id) summaryMap[item._id] = item.count;
    }

    const totalPages = Math.ceil(totalCount / safeLimit) || 1;

    const bookingIds = bookings.map((b) => b._id);
    const payments = await (PaymentModel as mongoose.Model<Payment>)
      .find({
        bookingId: { $in: bookingIds },
        paymentStatus: 'SUCCESSFUL',
      })
      .lean()
      .exec();

    const paymentMap = new Map<string, any[]>();
    for (const p of payments) {
      if (p.bookingId) {
        const bId = p.bookingId.toString();
        if (!paymentMap.has(bId)) paymentMap.set(bId, []);
        paymentMap.get(bId)!.push(p);
      }
    }

    const now = new Date();
    const mappedBookings: ManualBookingItem[] = bookings.map((b: any) => {
      const customer = b.customerId || {};
      const vehicle = b.vehicleId || {};
      const slot = b.currentSlotId || {};
      const floor = b.floorId || {};
      const zone = b.zoneId || {};
      const lot = b.parkingLotId || {};

      const scheduledExit = new Date(b.scheduledExitTime);
      const isOverstayStatus = b.bookingStatus === 'Overstay';
      const isPotentialOverstay =
        b.bookingStatus === 'Active' &&
        now.getTime() > scheduledExit.getTime() + (b.gracePeriodMinutes || 15) * 60 * 1000;
      const isOverstay = isOverstayStatus || isPotentialOverstay;

      let overstayDurationMinutes = 0;
      let overstayCharge = 0;
      if (isOverstay) {
        overstayDurationMinutes = Math.max(
          1,
          Math.ceil((now.getTime() - scheduledExit.getTime()) / (60 * 1000)),
        );
        const billableHours = Math.max(1, Math.ceil(overstayDurationMinutes / 60));
        const ratePerHour = b.overstayRateAtBooking || b.parkingRateAtBooking || 0;
        overstayCharge = b.overstayCharge || Math.round(billableHours * ratePerHour);
      }

      const bookingPayments = paymentMap.get(b._id.toString()) || [];
      const primaryPayment = bookingPayments.find(
        (p) => p.paymentTypeCode === 'BOOKING' || p.paymentType === 'Parking Booking',
      );
      const overstayPayment = bookingPayments.find(
        (p) => p.paymentTypeCode === 'OVERSTAY' || p.paymentType === 'Overstay Charges',
      );

      let overstayPaymentStatus: 'NOT_APPLICABLE' | 'UNPAID' | 'PAID' = 'NOT_APPLICABLE';
      if (isOverstay || overstayCharge > 0) {
        overstayPaymentStatus = overstayPayment ? 'PAID' : 'UNPAID';
      }

      const hasQr = Boolean(b.qrCodePayload || b.qrCode);
      const qrStatus = b.actualEntryTime ? (b.actualExitTime ? 'EXPIRED' : 'ACTIVE') : 'READY';

      const canAllowEntry = b.bookingStatus === 'Confirmed' && !b.actualEntryTime;
      const canRejectEntry = b.bookingStatus === 'Confirmed';
      const canCompleteExit =
        (b.bookingStatus === 'Active' || b.bookingStatus === 'Overstay') &&
        !b.actualExitTime &&
        overstayPaymentStatus !== 'UNPAID';
      const canRejectExit =
        (b.bookingStatus === 'Active' || b.bookingStatus === 'Overstay') && !b.actualExitTime;
      const canCollectCash =
        (b.bookingStatus === 'Active' || b.bookingStatus === 'Overstay') &&
        overstayPaymentStatus === 'UNPAID' &&
        overstayCharge > 0;

      return {
        bookingId: b._id.toString(),
        bookingReference: b.bookingReference,
        bookingType: b.bookingType || 'ONLINE',
        bookingStatus: b.bookingStatus,
        customer: {
          customerId: customer._id ? customer._id.toString() : '',
          fullName: customer.fullName || 'Guest Customer',
          email: customer.email || '',
          mobileNumber: customer.mobileNumber || '',
        },
        vehicle: {
          vehicleId: vehicle._id ? vehicle._id.toString() : '',
          vehicleNumber: vehicle.vehicleNumber || '',
          vehicleType: vehicle.vehicleType || 'Car',
          make: vehicle.make || vehicle.vehicleModel || null,
          model: vehicle.model || vehicle.vehicleModel || null,
          color: vehicle.color || null,
        },
        facility: {
          parkingLotId: lot._id ? lot._id.toString() : parkingLotId,
          parkingName: lot.parkingName || 'Facility',
          floorName: floor.floorName || 'Floor',
          zoneName: zone.zoneName || 'Zone',
          slotNumber: slot.slotNumber || '',
          slotIdentifier: slot.qrIdentifier || slot.slotLabel || '',
        },
        timing: {
          scheduledEntryTime: b.scheduledEntryTime,
          scheduledExitTime: b.scheduledExitTime,
          actualEntryTime: b.actualEntryTime || null,
          actualExitTime: b.actualExitTime || null,
          durationMinutes: b.bookingDurationMinutes || 60,
          stayDurationMinutes: b.stayDurationMinutes || null,
        },
        payment: {
          baseAmount: b.baseAmount || 0,
          totalAmount: b.totalAmount || 0,
          paymentStatus: primaryPayment?.paymentStatus || 'SUCCESSFUL',
          paymentMethod: primaryPayment?.paymentMethod || 'RAZORPAY',
        },
        overstay: {
          isOverstay,
          overstayDurationMinutes,
          overstayCharge,
          overstayPaymentStatus,
        },
        qrStatus: {
          hasQr,
          qrStatus,
        },
        allowedActions: {
          canAllowEntry,
          canRejectEntry,
          canCompleteExit,
          canRejectExit,
          canCollectCash,
        },
      };
    });

    return {
      bookings: mappedBookings,
      pagination: {
        totalCount,
        totalPages,
        currentPage: safePage,
        limit: safeLimit,
      },
      summary: {
        total: Object.values(summaryMap).reduce((a, b) => a + b, 0),
        confirmed: summaryMap['Confirmed'] || 0,
        active: summaryMap['Active'] || 0,
        overstay: summaryMap['Overstay'] || 0,
        completed: summaryMap['Completed'] || 0,
      },
    };
  }

  /**
   * Retrieves full details, history, timeline, and movement logs for a single booking under manual review.
   */
  public async getManualBookingDetails(params: {
    staffUserId: string;
    parkingLotId: string;
    bookingId: string;
  }): Promise<ManualBookingDetailData> {
    const { staffUserId, parkingLotId, bookingId } = params;

    await this.assertStaffLotAssignment(staffUserId, parkingLotId);

    if (!mongoose.isValidObjectId(bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const booking = await (BookingModel as mongoose.Model<Booking>)
      .findById(bookingId)
      .populate('customerId', 'fullName email mobileNumber')
      .populate('vehicleId', 'vehicleNumber vehicleType make model color vehicleModel')
      .populate('currentSlotId', 'slotNumber slotLabel slotType slotStatus qrIdentifier')
      .populate('floorId', 'floorName floorNumber')
      .populate('zoneId', 'zoneName zoneCode')
      .populate('parkingLotId', 'parkingName address city state postalCode isOpen24Hours')
      .lean()
      .exec();

    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    const bLotId = (booking.parkingLotId as any)?._id
      ? (booking.parkingLotId as any)._id.toString()
      : booking.parkingLotId.toString();

    if (bLotId !== parkingLotId) {
      throw new AppError('Booking does not belong to your assigned facility.', 403, 'WRONG_PARKING_LOT');
    }

    const [timeline, movementLogs, payments] = await Promise.all([
      (BookingTimelineModel as mongoose.Model<BookingTimeline>)
        .find({ bookingId: booking._id })
        .sort({ eventTime: -1 })
        .populate('performedBy', 'fullName')
        .lean()
        .exec(),
      (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>)
        .find({ bookingId: booking._id })
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      (PaymentModel as mongoose.Model<Payment>)
        .find({ bookingId: booking._id })
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
    ]);

    const searchRes = await this.searchManualBookings({
      staffUserId,
      parkingLotId,
      query: booking.bookingReference,
      limit: 1,
    });

    const item = searchRes.bookings.find((b) => b.bookingId === bookingId) || searchRes.bookings[0];
    if (!item) {
      throw new AppError('Booking details could not be retrieved.', 404, 'BOOKING_NOT_FOUND');
    }

    return {
      ...item,
      timeline: timeline.map((t: any) => ({
        _id: t._id.toString(),
        eventCode: t.eventCode,
        eventType: t.eventType,
        eventTitle: t.eventTitle,
        eventDescription: t.eventDescription,
        eventSource: t.eventSource,
        eventTime: t.eventTime,
        performedByName: t.performedBy?.fullName || null,
      })),
      movementLogs: movementLogs.map((m: any) => ({
        _id: m._id.toString(),
        entryTime: m.entryTime,
        exitTime: m.exitTime,
        entryMethod: m.entryMethod,
        exitMethod: m.exitMethod,
        stayDurationMinutes: m.stayDurationMinutes,
        vehicleNumberSnapshot: m.vehicleNumberSnapshot,
      })),
      payments: payments.map((p: any) => ({
        _id: p._id.toString(),
        paymentReference: p.paymentReference,
        paymentType: p.paymentType,
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
        amount: p.amount,
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Approves vehicle entry manually when QR code is damaged, unreadable, or device battery dead.
   */
  public async recordManualEntry(params: {
    staffUserId: string;
    parkingLotId: string;
    bookingId: string;
    reason: string;
    notes?: string;
  }): Promise<EntryVerificationResult> {
    const { staffUserId, parkingLotId, bookingId, reason, notes } = params;

    if (!reason || reason.trim().length === 0) {
      throw new AppError('Reason for manual entry is required.', 400, 'REASON_REQUIRED');
    }

    const combinedNotes = notes ? `${reason} — ${notes}` : reason;

    const entryResult = await this.recordVehicleEntry({
      staffUserId,
      parkingLotId,
      bookingId,
      entryMethod: 'Manual Verification',
      ...(notes !== undefined ? { notes: combinedNotes } : { notes: reason }),
    });

    await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create({
      bookingId: new mongoose.Types.ObjectId(bookingId),
      performedBy: new mongoose.Types.ObjectId(staffUserId),
      eventCode: 'MANUAL_ENTRY_APPROVED',
      eventType: 'Manual Entry Approved',
      eventTitle: 'Manual Gate Entry Approved',
      eventDescription: `Vehicle entry approved manually by Security Staff. Reason: ${reason}.${notes ? ` Notes: ${notes}` : ''}`,
      eventSource: 'Security Staff',
      eventTime: new Date(),
    });

    return entryResult;
  }

  /**
   * Approves vehicle exit manually when QR code is unavailable or manual exit required.
   */
  public async completeManualExit(params: {
    staffUserId: string;
    parkingLotId: string;
    bookingId: string;
    reason: string;
    notes?: string;
  }): Promise<ExitVerificationResult> {
    const { staffUserId, parkingLotId, bookingId, reason, notes } = params;

    if (!reason || reason.trim().length === 0) {
      throw new AppError('Reason for manual exit is required.', 400, 'REASON_REQUIRED');
    }

    const combinedNotes = notes ? `${reason} — ${notes}` : reason;

    const exitResult = await this.completeVehicleExit({
      staffUserId,
      parkingLotId,
      bookingId,
      exitMethod: 'Manual Verification',
      ...(notes !== undefined ? { notes: combinedNotes } : { notes: reason }),
    });

    return exitResult;
  }

  /**
   * Records operational rejection of manual entry or exit attempt.
   */
  public async recordManualRejection(params: {
    staffUserId: string;
    parkingLotId: string;
    bookingId: string;
    actionType: 'ENTRY' | 'EXIT';
    reason: string;
    notes?: string;
  }) {
    const { staffUserId, parkingLotId, bookingId, actionType, reason, notes } = params;

    await this.assertStaffLotAssignment(staffUserId, parkingLotId);

    if (!reason || reason.trim().length === 0) {
      throw new AppError('Rejection reason is required.', 400, 'REASON_REQUIRED');
    }

    if (!mongoose.isValidObjectId(bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const booking = await (BookingModel as mongoose.Model<Booking>).findById(bookingId).exec();
    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.parkingLotId.toString() !== parkingLotId) {
      throw new AppError('Booking does not belong to your assigned facility.', 403, 'WRONG_PARKING_LOT');
    }

    await (AuditLogModel as any).create({
      userId: new mongoose.Types.ObjectId(staffUserId),
      actionCode: actionType === 'ENTRY' ? 'MANUAL_ENTRY_REJECTED' : 'MANUAL_EXIT_REJECTED',
      module: 'Security',
      actionTitle: actionType === 'ENTRY' ? 'Manual Entry Verification Rejected' : 'Manual Exit Verification Rejected',
      description: `Security officer rejected manual ${actionType.toLowerCase()} for booking ${booking.bookingReference}. Reason: ${reason}.${notes ? ` Notes: ${notes}` : ''}`,
      targetCollection: 'bookings',
      targetDocumentId: booking._id,
      actionStatus: 'Success',
    });

    // Record / Update VehicleMovementLog for Denied attempt
    const graceEnds =
      booking.gracePeriodEndsAt ||
      new Date(booking.scheduledExitTime.getTime() + (booking.gracePeriodMinutes || 15) * 60 * 1000);

    if (actionType === 'ENTRY') {
      const mLog = await (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>).findOne({ bookingId: booking._id });
      if (mLog) {
        mLog.movementStatus = 'Cancelled';
        mLog.remarks = `Entry Denied: ${reason}${notes ? ` - ${notes}` : ''}`;
        mLog.verifiedBy = new mongoose.Types.ObjectId(staffUserId);
        await mLog.save();
      } else {
        await (VehicleMovementLogModel as any).create({
          bookingId: booking._id,
          customerId: booking.customerId,
          vehicleId: booking.vehicleId,
          parkingLotId: booking.parkingLotId,
          floorId: booking.floorId,
          zoneId: booking.zoneId,
          slotId: booking.currentSlotId,
          verifiedBy: new mongoose.Types.ObjectId(staffUserId),
          entryMethod: 'Manual Verification',
          entryTime: new Date(),
          gracePeriodEndsAt: graceEnds,
          stayDurationMinutes: 0,
          overstayMinutes: 0,
          movementStatus: 'Cancelled',
          remarks: `Entry Denied: ${reason}${notes ? ` - ${notes}` : ''}`,
        });
      }
    } else {
      const mLog = await (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>).findOne({ bookingId: booking._id });
      if (mLog) {
        mLog.exitVerifiedBy = new mongoose.Types.ObjectId(staffUserId);
        mLog.remarks = `Exit Denied: ${reason}${notes ? ` - ${notes}` : ''}`;
        await mLog.save();
      }
    }

    return {
      success: true,
      message: `Manual ${actionType.toLowerCase()} rejection successfully logged.`,
      bookingReference: booking.bookingReference,
      actionType,
      reason,
    };
  }

  /**
   * Retrieves real-time non-conflicting available slots for a walk-in booking request.
   */
  public async getWalkInAvailableSlots(params: {
    staffUserId: string;
    parkingLotId: string;
    vehicleType: string;
    durationHours?: number | undefined;
    entryTime?: string | undefined;
    exitTime?: string | undefined;
  }): Promise<WalkInAvailableSlotsResult> {
    const { staffUserId, parkingLotId, vehicleType } = params;
    await this.assertStaffLotAssignment(staffUserId, parkingLotId);

    let entryDate: Date;
    let exitDate: Date;
    let duration: number;

    if (params.entryTime && params.exitTime) {
      entryDate = new Date(params.entryTime);
      exitDate = new Date(params.exitTime);
      if (isNaN(entryDate.getTime()) || isNaN(exitDate.getTime()) || exitDate.getTime() <= entryDate.getTime()) {
        throw new AppError('Exit time must be later than entry time.', 400, 'INVALID_TIME_RANGE');
      }
      duration = Math.max(0.5, Math.round(((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60)) * 10) / 10);
    } else {
      duration = Math.min(72, Math.max(0.5, Number(params.durationHours) || 1));
      entryDate = new Date();
      exitDate = new Date(entryDate.getTime() + duration * 60 * 60 * 1000);
    }

    const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);

    // Normalize vehicle type
    const normalizedType = vehicleType.trim();
    const allowedTypes = [normalizedType];
    if (normalizedType.toLowerCase() === 'car') {
      allowedTypes.push('Car', 'SUV');
    }

    // Query active floors & zones
    const floors = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
      .find({ parkingLotId: lotObjectId, floorStatus: 'Active' })
      .sort({ floorNumber: 1 })
      .lean()
      .exec();

    const zones = await (ParkingZoneModel as mongoose.Model<ParkingZone>)
      .find({ parkingLotId: lotObjectId, zoneStatus: 'Active' })
      .sort({ zoneCode: 1 })
      .lean()
      .exec();

    // Query eligible slots
    const slots = await (ParkingSlotModel as any)
      .find({
        parkingLotId: lotObjectId,
        slotStatus: { $ne: 'Under Maintenance' },
        supportedVehicleType: { $in: allowedTypes },
      })
      .sort({ slotNumber: 1 })
      .lean()
      .exec();

    const slotIds = slots.map((s: any) => s._id as mongoose.Types.ObjectId);

    // Conflict check with existing bookings
    const overlappingBookings = await (BookingModel as mongoose.Model<Booking>)
      .find(
        {
          parkingLotId: lotObjectId,
          currentSlotId: { $in: slotIds },
          bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
          scheduledEntryTime: { $lt: exitDate },
          scheduledExitTime: { $gt: entryDate },
        },
        'currentSlotId',
      )
      .lean()
      .exec();

    const conflictSlotIdSet = new Set(
      overlappingBookings.map((b) => b.currentSlotId.toString()),
    );

    const floorMap = new Map<string, { floorName: string; floorNumber: number }>();
    for (const f of floors) {
      floorMap.set(f._id.toString(), {
        floorName: f.floorName,
        floorNumber: f.floorNumber,
      });
    }

    const zoneMap = new Map<string, { zoneCode: string; zoneName: string }>();
    for (const z of zones) {
      zoneMap.set(z._id.toString(), {
        zoneCode: z.zoneCode,
        zoneName: z.zoneName,
      });
    }

    const availableSlots: WalkInSlotInfo[] = [];

    for (const slot of slots) {
      const slotIdStr = (slot._id as mongoose.Types.ObjectId).toString();
      if (conflictSlotIdSet.has(slotIdStr)) continue;

      const floorInfo = floorMap.get(slot.floorId.toString()) || {
        floorName: 'Ground Floor',
        floorNumber: 0,
      };
      const zoneInfo = zoneMap.get(slot.zoneId.toString()) || {
        zoneCode: 'A',
        zoneName: 'Zone A',
      };

      availableSlots.push({
        slotId: slotIdStr,
        slotNumber: slot.slotNumber,
        slotLabel: slot.slotLabel,
        floorId: slot.floorId.toString(),
        floorName: floorInfo.floorName,
        floorNumber: floorInfo.floorNumber,
        zoneId: slot.zoneId.toString(),
        zoneCode: zoneInfo.zoneCode,
        zoneName: zoneInfo.zoneName,
        supportedVehicleType: slot.supportedVehicleType,
        isAvailable: true,
      });
    }

    // Group available slots by Floor and Zone
    const groupedFloorMap = new Map<
      string,
      {
        floorId: string;
        floorName: string;
        floorNumber: number;
        zonesMap: Map<
          string,
          {
            zoneId: string;
            zoneCode: string;
            zoneName: string;
            slots: WalkInSlotInfo[];
          }
        >;
      }
    >();

    for (const s of availableSlots) {
      if (!groupedFloorMap.has(s.floorId)) {
        groupedFloorMap.set(s.floorId, {
          floorId: s.floorId,
          floorName: s.floorName,
          floorNumber: s.floorNumber,
          zonesMap: new Map(),
        });
      }
      const floorEntry = groupedFloorMap.get(s.floorId)!;
      if (!floorEntry.zonesMap.has(s.zoneId)) {
        floorEntry.zonesMap.set(s.zoneId, {
          zoneId: s.zoneId,
          zoneCode: s.zoneCode,
          zoneName: s.zoneName,
          slots: [],
        });
      }
      floorEntry.zonesMap.get(s.zoneId)!.slots.push(s);
    }

    const groupedByFloor: WalkInGroupedFloor[] = Array.from(groupedFloorMap.values()).map(
      (f) => ({
        floorId: f.floorId,
        floorName: f.floorName,
        floorNumber: f.floorNumber,
        zones: Array.from(f.zonesMap.values()),
      }),
    );

    return {
      parkingLotId,
      vehicleType: normalizedType,
      durationHours: duration,
      scheduledEntryTime: entryDate.toISOString(),
      scheduledExitTime: exitDate.toISOString(),
      totalAvailableCount: availableSlots.length,
      recommendedSlot: availableSlots[0] || null,
      availableSlots,
      groupedByFloor,
    };
  }

  /**
   * Computes parking tariff for walk-in booking based on vehicle type and duration.
   */
  public async calculateWalkInTariff(params: {
    staffUserId: string;
    parkingLotId: string;
    vehicleType: string;
    durationHours?: number | undefined;
    entryTime?: string | undefined;
    exitTime?: string | undefined;
  }): Promise<WalkInTariffResult> {
    const { staffUserId, parkingLotId, vehicleType } = params;
    await this.assertStaffLotAssignment(staffUserId, parkingLotId);

    let scheduledEntryTime: Date;
    let scheduledExitTime: Date;
    let duration: number;

    if (params.entryTime && params.exitTime) {
      scheduledEntryTime = new Date(params.entryTime);
      scheduledExitTime = new Date(params.exitTime);
      if (
        isNaN(scheduledEntryTime.getTime()) ||
        isNaN(scheduledExitTime.getTime()) ||
        scheduledExitTime.getTime() <= scheduledEntryTime.getTime()
      ) {
        throw new AppError('Exit time must be later than entry time.', 400, 'INVALID_TIME_RANGE');
      }
      duration = Math.max(0.5, Math.round(((scheduledExitTime.getTime() - scheduledEntryTime.getTime()) / (1000 * 60 * 60)) * 10) / 10);
    } else {
      duration = Math.min(72, Math.max(0.5, Number(params.durationHours) || 1));
      scheduledEntryTime = new Date();
      scheduledExitTime = new Date(scheduledEntryTime.getTime() + duration * 60 * 60 * 1000);
    }

    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>).findById(parkingLotId).lean().exec();
    if (!lot) {
      throw new AppError('Parking facility not found.', 404, 'FACILITY_NOT_FOUND');
    }

    const baseCarRate = lot.hourlyRate || 50;
    let hourlyRate = baseCarRate;
    const vType = vehicleType.trim().toLowerCase();

    if (vType === 'bike') {
      hourlyRate = Math.max(10, Math.round(baseCarRate * 0.5));
    } else if (vType === 'ev') {
      const evSlotsCount = await (ParkingSlotModel as any).countDocuments({
        parkingLotId: lot._id,
        slotStatus: { $ne: 'Under Maintenance' },
        $or: [{ supportedVehicleType: 'EV' }, { slotType: 'EV Charging' }],
      });
      if (evSlotsCount === 0) {
        throw new AppError(
          'Electric vehicle bays are not available at this facility.',
          400,
          'EV_BAYS_NOT_AVAILABLE',
        );
      }
      hourlyRate = baseCarRate;
    } else if (vType === 'suv' || vType === 'truck') {
      hourlyRate = Math.round(baseCarRate * 1.2);
    }

    const baseAmount = Math.ceil(hourlyRate * duration);
    const additionalCharges = 0;
    const totalAmount = baseAmount + additionalCharges;

    return {
      parkingLotId,
      vehicleType,
      durationHours: duration,
      hourlyRate,
      baseAmount,
      additionalCharges,
      totalAmount,
      scheduledEntryTime: scheduledEntryTime.toISOString(),
      scheduledExitTime: scheduledExitTime.toISOString(),
      gracePeriodMinutes: lot.gracePeriodMinutes ?? 15,
    };
  }

  /**
   * Mandatory Cash-First Walk-in Booking creation:
   * Validates explicit physical cash collection, allocates eligible slot,
   * marks slot Reserved, confirms booking, generates QR and printable receipt payload.
   */
  public async createWalkInBooking(params: CreateWalkInBookingInput): Promise<WalkInBookingConfirmation> {
    const {
      staffUserId,
      parkingLotId,
      customerName,
      customerMobile,
      customerEmail,
      vehicleNumber,
      vehicleType,
      durationHours,
      entryTime,
      exitTime,
      slotSelectionMode,
      slotId,
      cashCollected,
      cashAmountCollected,
      staffNotes,
    } = params;

    // 1. Mandatory assignment verification
    await this.assertStaffLotAssignment(staffUserId, parkingLotId);

    const staffUser = await (UserModel as mongoose.Model<User>).findById(staffUserId).lean().exec();
    if (!staffUser) {
      throw new AppError('Authenticated staff user not found.', 401, 'STAFF_NOT_FOUND');
    }

    // 2. Mandatory cash-first enforcement per SRS
    if (!cashCollected) {
      throw new AppError(
        'Physical cash collection must be explicitly confirmed before allocating a parking slot and confirming the booking.',
        400,
        'CASH_NOT_CONFIRMED',
      );
    }

    // 3. Tariff validation
    const tariff = await this.calculateWalkInTariff({
      staffUserId,
      parkingLotId,
      vehicleType,
      durationHours,
      entryTime,
      exitTime,
    });

    if (Number(cashAmountCollected) !== tariff.totalAmount) {
      throw new AppError(
        `Collected cash amount (₹${cashAmountCollected}) does not match the required booking tariff (₹${tariff.totalAmount}).`,
        400,
        'CASH_AMOUNT_MISMATCH',
      );
    }

    // 4. Input validation
    const trimmedName = (customerName || '').trim();
    if (trimmedName.length < 2) {
      throw new AppError('Customer name must be at least 2 characters.', 400, 'INVALID_NAME');
    }

    const cleanMobile = (customerMobile || '').replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      throw new AppError('A valid 10-digit Indian mobile number is required.', 400, 'INVALID_MOBILE');
    }
    const formattedMobile = `+91${cleanMobile}`;

    const cleanVehicleNumber = (vehicleNumber || '').replace(/[\s-]/g, '').toUpperCase();
    if (!cleanVehicleNumber || cleanVehicleNumber.length < 5) {
      throw new AppError('A valid vehicle registration number is required.', 400, 'INVALID_VEHICLE_NUMBER');
    }

    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>).findById(parkingLotId).exec();
    if (!lot) {
      throw new AppError('Parking facility not found.', 404, 'FACILITY_NOT_FOUND');
    }

    // 5. Customer resolution (Find or create Customer User)
    let customerUser = await (UserModel as mongoose.Model<User>).findOne({
      mobileNumber: formattedMobile,
    }).exec();

    if (!customerUser) {
      const customerRole = await (RoleModel as any).findOne({ roleCode: 'CUSTOMER' }).exec();
      if (!customerRole) {
        throw new AppError('Customer role master record not found.', 500, 'ROLE_NOT_FOUND');
      }

      const generatedEmail = customerEmail?.trim().toLowerCase() || `walkin.${cleanMobile}@customer.parkease.in`;

      customerUser = await (UserModel as mongoose.Model<User>).create({
        fullName: trimmedName,
        email: generatedEmail,
        mobileNumber: formattedMobile,
        roleId: customerRole._id,
        accountStatus: 'Active',
        mobileVerified: true,
        emailVerified: Boolean(customerEmail),
      });
    }

    // 6. Vehicle resolution (Find or create Vehicle)
    let vehicle = await (VehicleModel as mongoose.Model<Vehicle>).findOne({
      vehicleNumber: cleanVehicleNumber,
    }).exec();

    if (vehicle) {
      if (vehicle.customerId.toString() !== customerUser._id.toString()) {
        throw new AppError(
          `Vehicle registration number ${cleanVehicleNumber} is already registered to another user account. Each vehicle registration number must be uniquely assigned.`,
          409,
          'VEHICLE_ALREADY_EXISTS',
        );
      }

      const activeBooking = await (BookingModel as mongoose.Model<Booking>).findOne({
        vehicleId: vehicle._id,
        bookingStatus: { $in: ['Active', 'Overstay'] },
      }).exec();

      if (activeBooking) {
        throw new AppError(
          `Vehicle ${cleanVehicleNumber} is already inside a parking facility (Booking: ${activeBooking.bookingReference}). Double entry is prevented.`,
          409,
          'VEHICLE_ALREADY_INSIDE',
        );
      }
    }

    const mappedVehicleType = (['Bike', 'Car', 'SUV', 'EV'].includes(vehicleType)
      ? vehicleType
      : 'Car') as 'Bike' | 'Car' | 'SUV' | 'EV';

    if (!vehicle) {
      vehicle = await (VehicleModel as any).create({
        customerId: customerUser._id,
        vehicleNumber: cleanVehicleNumber,
        vehicleType: mappedVehicleType,
        vehicleBrand: 'Walk-in',
        vehicleModel: 'Customer Vehicle',
        vehicleStatus: 'Active',
      });
    }

    // 7. Slot allocation resolution
    let targetSlot: any = null;
    const entryDate = new Date(tariff.scheduledEntryTime);
    const exitDate = new Date(tariff.scheduledExitTime);

    if (slotSelectionMode === 'MANUAL') {
      if (!slotId || !mongoose.isValidObjectId(slotId)) {
        throw new AppError('Valid slot selection is required in manual selection mode.', 400, 'SLOT_REQUIRED');
      }

      const requestedSlot = await (ParkingSlotModel as any).findById(slotId).exec();
      if (!requestedSlot || requestedSlot.parkingLotId.toString() !== parkingLotId) {
        throw new AppError('Selected slot does not belong to this parking facility.', 400, 'INVALID_SLOT');
      }
      if (requestedSlot.slotStatus === 'Under Maintenance') {
        throw new AppError('Selected slot is currently under maintenance.', 409, 'SLOT_UNDER_MAINTENANCE');
      }

      // Conflict check
      const conflict = await (BookingModel as mongoose.Model<Booking>).findOne({
        parkingLotId: lot._id,
        currentSlotId: requestedSlot._id,
        bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
        scheduledEntryTime: { $lt: exitDate },
        scheduledExitTime: { $gt: entryDate },
      }).exec();

      if (conflict) {
        throw new AppError('Selected slot is already reserved or occupied for this time window.', 409, 'SLOT_UNAVAILABLE');
      }

      targetSlot = requestedSlot;
    } else {
      // Auto Assign Slot
      const available = await this.getWalkInAvailableSlots({
        staffUserId,
        parkingLotId,
        vehicleType,
        durationHours: tariff.durationHours,
        entryTime: tariff.scheduledEntryTime,
        exitTime: tariff.scheduledExitTime,
      });

      if (!available.recommendedSlot) {
        throw new AppError('No eligible parking bays are currently available for this vehicle type.', 409, 'NO_SLOTS_AVAILABLE');
      }

      targetSlot = await (ParkingSlotModel as any).findById(available.recommendedSlot.slotId).exec();
      if (!targetSlot) {
        throw new AppError('Failed to allocate recommended parking slot.', 500, 'ALLOCATION_FAILED');
      }
    }

    // Fetch Floor and Zone
    const floor = await (ParkingFloorModel as any).findById(targetSlot.floorId).exec();
    const zone = await (ParkingZoneModel as any).findById(targetSlot.zoneId).exec();

    if (!floor || !zone) {
      throw new AppError('Floor or Zone structure not found for allocated slot.', 500, 'HIERARCHY_ERROR');
    }

    // 8. Generate Booking & Payment References
    const bookingReference = `BK-WI-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const qrPayload = `PE-PASS|${bookingReference}|${targetSlot.slotNumber}|${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const paymentReference = `PAY-CASH-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 9. Atomic Transaction
    const session = await mongoose.startSession();
    let savedBooking: any = null;
    let savedPayment: any = null;

    try {
      await session.withTransaction(async () => {
        // Double-check conflict inside transaction
        const slotConflict = await (BookingModel as mongoose.Model<Booking>).findOne({
          parkingLotId: lot._id,
          currentSlotId: targetSlot!._id,
          bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
          scheduledEntryTime: { $lt: exitDate },
          scheduledExitTime: { $gt: entryDate },
        }).session(session).exec();

        if (slotConflict) {
          throw new AppError('Slot conflict detected during atomic allocation. Please retry.', 409, 'SLOT_CONFLICT');
        }

        // Record Cash Payment as SUCCESSFUL
        const [paymentDoc] = await (PaymentModel as any).create(
          [
            {
              paymentReference,
              customerId: customerUser!._id,
              parkingLotId: lot._id,
              paymentType: 'Parking Booking',
              paymentTypeCode: 'BOOKING',
              paymentMethod: 'CASH',
              paymentStatus: 'SUCCESSFUL',
              amount: tariff.totalAmount,
              paymentDate: new Date(),
              remarks: `Walk-in cash collected by Security Staff ${staffUser.fullName} (${staffUser._id}). Notes: ${staffNotes || 'None'}`,
            },
          ],
          { session, ordered: true },
        );
        savedPayment = paymentDoc;

        // Create Booking as Active directly (Vehicle checked in directly at barrier)
        const checkInTime = new Date();
        const [bookingDoc] = await (BookingModel as any).create(
          [
            {
              bookingReference,
              customerId: customerUser!._id,
              vehicleId: vehicle!._id,
              parkingLotId: lot._id,
              floorId: floor._id,
              zoneId: zone._id,
              originalSlotId: targetSlot!._id,
              currentSlotId: targetSlot!._id,
              bookingType: 'WALK_IN',
              bookingStatus: 'Active',
              scheduledEntryTime: entryDate,
              scheduledExitTime: exitDate,
              actualEntryTime: checkInTime,
              entryMethod: 'Walk-in Direct Entry',
              entryVerifiedBy: staffUser._id,
              gracePeriodMinutes: lot.gracePeriodMinutes ?? 15,
              bookingDurationMinutes: tariff.durationHours * 60,
              parkingRateAtBooking: tariff.hourlyRate,
              overstayRateAtBooking: Math.round(tariff.hourlyRate * 1.5),
              baseAmount: tariff.baseAmount,
              additionalCharges: tariff.additionalCharges,
              totalAmount: tariff.totalAmount,
              qrCode: qrPayload,
            },
          ],
          { session, ordered: true },
        );
        savedBooking = bookingDoc;

        // Link bookingId to payment
        savedPayment.bookingId = bookingDoc._id as mongoose.Types.ObjectId;
        await savedPayment.save({ session });

        // Update slot status directly to Occupied (vehicle is checked in directly)
        targetSlot!.slotStatus = 'Occupied';
        targetSlot!.currentBookingId = bookingDoc._id as mongoose.Types.ObjectId;
        await targetSlot!.save({ session });

        // Update ParkingLot counters
        if (lot.availableSlots !== undefined && lot.availableSlots > 0) {
          lot.availableSlots -= 1;
        }
        lot.occupiedSlots = (lot.occupiedSlots || 0) + 1;
        await lot.save({ session });

        // Create VehicleMovementLog record directly for this active entry
        const graceEnds =
          new Date(exitDate.getTime() + (lot.gracePeriodMinutes ?? 15) * 60 * 1000);

        await (VehicleMovementLogModel as any).create(
          [
            {
              bookingId: bookingDoc._id,
              customerId: customerUser!._id,
              vehicleId: vehicle!._id,
              parkingLotId: lot._id,
              floorId: floor._id,
              zoneId: zone._id,
              slotId: targetSlot!._id,
              verifiedBy: staffUser._id,
              entryMethod: 'Walk-in',
              entryTime: checkInTime,
              gracePeriodEndsAt: graceEnds,
              stayDurationMinutes: 0,
              overstayMinutes: 0,
              movementStatus: 'Vehicle Inside',
              vehicleNumberSnapshot: cleanVehicleNumber,
              remarks: `Walk-in customer registered and vehicle checked in directly by ${staffUser.fullName}. Cash ₹${tariff.totalAmount} collected. Barrier cleared.`,
            },
          ],
          { session, ordered: true },
        );

        // Create Timeline events: 1) Created, 2) Direct Entry Check-in
        await (BookingTimelineModel as any).create(
          [
            {
              bookingId: bookingDoc._id,
              eventSource: 'Security Staff',
              eventType: 'Walk-in Booking Created',
              eventCode: 'WALK_IN_BOOKING_CREATED',
              eventTitle: 'Walk-in Booking Registered & Cash Collected',
              eventDescription: `Security Staff ${staffUser.fullName} registered walk-in booking ${bookingReference} with Cash payment ₹${tariff.totalAmount}. Bay ${targetSlot!.slotNumber} allocated.`,
              performedBy: staffUser._id,
              eventTime: checkInTime,
            },
            {
              bookingId: bookingDoc._id,
              eventSource: 'Security Staff',
              eventType: 'Vehicle Entered',
              eventCode: 'VEHICLE_ENTERED',
              eventTitle: 'Vehicle Checked In Directly at Gate',
              eventDescription: `Vehicle ${cleanVehicleNumber} checked in directly at gate barrier by ${staffUser.fullName} without QR re-verification. Slot ${targetSlot!.slotNumber} marked Occupied.`,
              performedBy: staffUser._id,
              eventTime: checkInTime,
            },
          ],
          { session, ordered: true },
        );

        // Audit Log
        await (AuditLogModel as any).create(
          [
            {
              userId: staffUser._id,
              actionCode: 'WALK_IN_BOOKING_CHECKED_IN',
              module: 'Security',
              actionTitle: 'Walk-in Booking Registered & Checked In Directly',
              description: `Walk-in vehicle ${cleanVehicleNumber} checked in directly at bay ${targetSlot!.slotNumber} with cash payment ₹${tariff.totalAmount}.`,
              targetCollection: 'bookings',
              targetDocumentId: bookingDoc._id,
              actionStatus: 'Success',
            },
          ],
          { session, ordered: true },
        );
      });
    } finally {
      await session.endSession();
    }

    // 10. Generate scannable QR Code Data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'H',
    });

    // 11. Real-time updates via Socket.IO
    emitSlotStatusUpdate({
      parkingLotId,
      floorId: floor._id.toString(),
      zoneId: zone._id.toString(),
      slotId: targetSlot!._id.toString(),
      slotNumber: targetSlot!.slotNumber,
      slotStatus: 'Occupied',
      timestamp: new Date().toISOString(),
    });

    emitBookingStatusUpdate({
      bookingId: savedBooking!._id.toString(),
      bookingReference: savedBooking!.bookingReference,
      parkingLotId,
      customerId: customerUser._id.toString(),
      bookingStatus: 'Active',
      paymentStatus: 'SUCCESSFUL',
      timestamp: new Date().toISOString(),
    });

    // 12. Asynchronous email receipt if customer provided email
    if (customerEmail && customerEmail.includes('@') && !customerEmail.includes('customer.parkease.in')) {
      emailService
        .sendBookingConfirmationEmail({
          to: customerEmail.trim().toLowerCase(),
          customerName: customerUser.fullName,
          customerEmail: customerEmail.trim().toLowerCase(),
          customerMobile: customerUser.mobileNumber,
          bookingId: savedBooking!._id as mongoose.Types.ObjectId,
          parkingLotId: lot._id as mongoose.Types.ObjectId,
          bookingReference,
          parkingName: lot.parkingName,
          parkingAddress: `${lot.address}, ${lot.city}, ${lot.state} - ${lot.postalCode}`,
          floorName: floor.floorName,
          zoneCode: zone.zoneCode,
          slotNumber: targetSlot!.slotNumber,
          vehicleNumber: cleanVehicleNumber,
          vehicleType: mappedVehicleType,
          bookingType: 'WALK_IN',
          scheduledEntryTime: entryDate,
          scheduledExitTime: exitDate,
          bookingDurationMinutes: tariff.durationHours * 60,
          paymentReference,
          paymentMethod: 'Cash',
          paymentStatus: 'SUCCESSFUL',
          paymentDate: new Date(),
          baseAmount: tariff.baseAmount,
          additionalCharges: tariff.additionalCharges,
          totalAmount: tariff.totalAmount,
          qrCode: qrPayload,
        })
        .catch((err) => {
          console.warn('Failed to send walk-in confirmation email:', err);
        });
    }

    return {
      success: true,
      message: 'Walk-in cash booking registered and vehicle checked in directly. Barrier cleared and bay occupied.',
      receiptNumber: `REC-${bookingReference}`,
      booking: {
        bookingId: savedBooking!._id.toString(),
        bookingReference: savedBooking!.bookingReference,
        bookingType: 'WALK_IN',
        bookingStatus: 'Active',
        scheduledEntryTime: entryDate.toISOString(),
        scheduledExitTime: exitDate.toISOString(),
        actualEntryTime: (savedBooking as any).actualEntryTime?.toISOString() || new Date().toISOString(),
        durationHours: tariff.durationHours,
        durationMinutes: tariff.durationHours * 60,
        hourlyRate: tariff.hourlyRate,
        totalAmount: tariff.totalAmount,
        gracePeriodMinutes: lot.gracePeriodMinutes ?? 15,
        createdAt: (savedBooking as any).createdAt ? (savedBooking as any).createdAt.toISOString() : new Date().toISOString(),
      },
      customer: {
        customerId: customerUser._id.toString(),
        fullName: customerUser.fullName,
        mobileNumber: customerUser.mobileNumber,
        email: customerUser.email,
      },
      vehicle: {
        vehicleId: vehicle!._id.toString(),
        vehicleNumber: vehicle!.vehicleNumber,
        vehicleType: vehicle!.vehicleType,
      },
      parkingLot: {
        parkingLotId: lot._id.toString(),
        parkingName: lot.parkingName,
        address: lot.address,
        city: lot.city,
        state: lot.state,
      },
      slot: {
        slotId: targetSlot!._id.toString(),
        slotNumber: targetSlot!.slotNumber,
        floorId: floor._id.toString(),
        floorName: floor.floorName,
        floorNumber: floor.floorNumber,
        zoneId: zone._id.toString(),
        zoneCode: zone.zoneCode,
        zoneName: zone.zoneName,
      },
      payment: {
        paymentId: savedPayment!._id.toString(),
        paymentReference: savedPayment!.paymentReference,
        paymentMethod: 'CASH',
        paymentStatus: 'SUCCESSFUL',
        paymentType: 'Parking Booking',
        amount: tariff.totalAmount,
        paymentDate: new Date().toISOString(),
      },
      qrPayload,
      qrCodeDataUrl,
    };
  }

  /**
   * Retrieves paginated incidents for a specific parking facility assigned to the staff member,
   * with server-side filters, search, and KPI summary counters.
   */
  public async getIncidents(params: {
    staffUserId: string;
    parkingLotId: string;
    status?: string | undefined;
    severity?: string | undefined;
    incidentType?: string | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  }): Promise<SecurityIncidentListResult> {
    const { staffUserId, parkingLotId, status, severity, incidentType, search } = params;
    await this.assertStaffLotAssignment(staffUserId, parkingLotId);

    const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);
    const filter: Record<string, any> = { parkingLotId: lotObjectId };

    if (status && status !== 'ALL') {
      filter.incidentStatus = status;
    }

    if (severity && severity !== 'ALL') {
      filter.severity = severity;
    }

    if (incidentType && incidentType !== 'ALL') {
      filter.incidentType = incidentType;
    }

    if (search && search.trim().length > 0) {
      const cleanSearch = search.trim();
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      const [matchingBookings, matchingVehicles] = await Promise.all([
        (BookingModel as mongoose.Model<Booking>)
          .find({ parkingLotId: lotObjectId, bookingReference: searchRegex })
          .distinct('_id')
          .exec(),
        (VehicleModel as mongoose.Model<Vehicle>)
          .find({ vehicleNumber: searchRegex })
          .distinct('_id')
          .exec(),
      ]);

      const orClauses: Array<Record<string, any>> = [
        { incidentReference: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
      ];

      if (matchingBookings.length > 0) {
        orClauses.push({ bookingId: { $in: matchingBookings } });
      }
      if (matchingVehicles.length > 0) {
        orClauses.push({ vehicleId: { $in: matchingVehicles } });
      }

      filter.$or = orClauses;
    }

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const [rawIncidents, filteredTotal, totalCount, openCount, underInvestigationCount, resolvedCount, closedCount, criticalCount] =
      await Promise.all([
        (IncidentModel as mongoose.Model<Incident>)
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('reportedBy', 'fullName email')
          .populate('parkingLotId', 'parkingName address')
          .populate('bookingId', 'bookingReference scheduledEntryTime scheduledExitTime bookingStatus')
          .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel')
          .populate('customerId', 'fullName mobileNumber email')
          .lean()
          .exec(),
        (IncidentModel as mongoose.Model<Incident>).countDocuments(filter).exec(),
        (IncidentModel as mongoose.Model<Incident>).countDocuments({ parkingLotId: lotObjectId }).exec(),
        (IncidentModel as mongoose.Model<Incident>).countDocuments({ parkingLotId: lotObjectId, incidentStatus: 'Open' }).exec(),
        (IncidentModel as mongoose.Model<Incident>).countDocuments({ parkingLotId: lotObjectId, incidentStatus: 'Under Investigation' }).exec(),
        (IncidentModel as mongoose.Model<Incident>).countDocuments({ parkingLotId: lotObjectId, incidentStatus: 'Resolved' }).exec(),
        (IncidentModel as mongoose.Model<Incident>).countDocuments({ parkingLotId: lotObjectId, incidentStatus: 'Closed' }).exec(),
        (IncidentModel as mongoose.Model<Incident>).countDocuments({
          parkingLotId: lotObjectId,
          severity: 'Critical',
          incidentStatus: { $in: ['Open', 'Under Investigation'] },
        }).exec(),
      ]);

    const incidents: SecurityIncidentItem[] = rawIncidents.map((inc: any) => ({
      _id: inc._id.toString(),
      incidentReference: inc.incidentReference,
      parkingLotId: inc.parkingLotId?._id ? inc.parkingLotId._id.toString() : inc.parkingLotId?.toString() || parkingLotId,
      parkingName: inc.parkingLotId?.parkingName || 'Assigned Parking Facility',
      bookingId: inc.bookingId?._id ? inc.bookingId._id.toString() : inc.bookingId ? inc.bookingId.toString() : null,
      bookingReference: inc.bookingId?.bookingReference || null,
      vehicleId: inc.vehicleId?._id ? inc.vehicleId._id.toString() : inc.vehicleId ? inc.vehicleId.toString() : null,
      vehicleNumber: inc.vehicleId?.vehicleNumber || null,
      vehicleType: inc.vehicleId?.vehicleType || null,
      customerId: inc.customerId?._id ? inc.customerId._id.toString() : inc.customerId ? inc.customerId.toString() : null,
      customerName: inc.customerId?.fullName || null,
      customerMobile: inc.customerId?.mobileNumber || null,
      reportedBy: {
        userId: inc.reportedBy?._id ? inc.reportedBy._id.toString() : (inc.reportedBy?.toString() || staffUserId),
        fullName: inc.reportedBy?.fullName || 'Security Staff',
        role: 'SECURITY',
      },
      incidentSource: inc.incidentSource || 'Security Staff Report',
      incidentType: inc.incidentType,
      severity: inc.severity,
      incidentStatus: inc.incidentStatus,
      title: inc.title,
      description: inc.description,
      attachments: Array.isArray(inc.attachments) ? inc.attachments : [],
      location: inc.location || null,
      resolvedAt: inc.resolvedAt || null,
      resolutionNotes: inc.resolutionNotes || null,
      closedAt: inc.closedAt || null,
      createdAt: inc.createdAt,
      updatedAt: inc.updatedAt,
    }));

    return {
      incidents,
      pagination: {
        totalCount: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit) || 1,
        currentPage: page,
        limit,
      },
      summary: {
        total: totalCount,
        open: openCount,
        underInvestigation: underInvestigationCount,
        resolved: resolvedCount,
        closed: closedCount,
        critical: criticalCount,
      },
    };
  }

  /**
   * Retrieves single incident details with populated references and permission check.
   */
  public async getIncidentDetail(params: {
    staffUserId: string;
    incidentId: string;
  }): Promise<SecurityIncidentItem> {
    const { staffUserId, incidentId } = params;

    if (!incidentId || !mongoose.isValidObjectId(incidentId)) {
      throw new AppError('Valid incident ID is required.', 400, 'INVALID_INCIDENT_ID');
    }

    const inc: any = await (IncidentModel as mongoose.Model<Incident>)
      .findById(incidentId)
      .populate('reportedBy', 'fullName email')
      .populate('parkingLotId', 'parkingName address city state')
      .populate('bookingId', 'bookingReference scheduledEntryTime scheduledExitTime bookingStatus')
      .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel')
      .populate('customerId', 'fullName mobileNumber email')
      .lean()
      .exec();

    if (!inc) {
      throw new AppError('Incident report not found.', 404, 'INCIDENT_NOT_FOUND');
    }

    const lotId = inc.parkingLotId?._id ? inc.parkingLotId._id.toString() : inc.parkingLotId.toString();
    await this.assertStaffLotAssignment(staffUserId, lotId);

    return {
      _id: inc._id.toString(),
      incidentReference: inc.incidentReference,
      parkingLotId: lotId,
      parkingName: inc.parkingLotId?.parkingName || 'Assigned Parking Facility',
      bookingId: inc.bookingId?._id ? inc.bookingId._id.toString() : inc.bookingId ? inc.bookingId.toString() : null,
      bookingReference: inc.bookingId?.bookingReference || null,
      vehicleId: inc.vehicleId?._id ? inc.vehicleId._id.toString() : inc.vehicleId ? inc.vehicleId.toString() : null,
      vehicleNumber: inc.vehicleId?.vehicleNumber || null,
      vehicleType: inc.vehicleId?.vehicleType || null,
      customerId: inc.customerId?._id ? inc.customerId._id.toString() : inc.customerId ? inc.customerId.toString() : null,
      customerName: inc.customerId?.fullName || null,
      customerMobile: inc.customerId?.mobileNumber || null,
      reportedBy: {
        userId: inc.reportedBy?._id ? inc.reportedBy._id.toString() : (inc.reportedBy?.toString() || staffUserId),
        fullName: inc.reportedBy?.fullName || 'Security Staff',
        role: 'SECURITY',
      },
      incidentSource: inc.incidentSource || 'Security Staff Report',
      incidentType: inc.incidentType,
      severity: inc.severity,
      incidentStatus: inc.incidentStatus,
      title: inc.title,
      description: inc.description,
      attachments: Array.isArray(inc.attachments) ? inc.attachments : [],
      location: inc.location || null,
      resolvedAt: inc.resolvedAt || null,
      resolutionNotes: inc.resolutionNotes || null,
      closedAt: inc.closedAt || null,
      createdAt: inc.createdAt,
      updatedAt: inc.updatedAt,
    };
  }

  /**
   * Creates a new incident report for the active assigned parking facility.
   */
  public async createIncident(params: CreateIncidentInput): Promise<SecurityIncidentItem> {
    const { staffUserId, parkingLotId, title, description, incidentType, severity, vehicleNumber, bookingReference, attachments, location } = params;

    await this.assertStaffLotAssignment(staffUserId, parkingLotId);

    const staffUser = await (UserModel as mongoose.Model<User>).findById(staffUserId).lean().exec();
    if (!staffUser) {
      throw new AppError('Authenticated staff user not found.', 401, 'STAFF_NOT_FOUND');
    }

    const cleanTitle = (title || '').trim();
    if (cleanTitle.length < 3 || cleanTitle.length > 100) {
      throw new AppError('Incident title must be between 3 and 100 characters.', 400, 'INVALID_TITLE');
    }

    const cleanDescription = (description || '').trim();
    if (cleanDescription.length < 5 || cleanDescription.length > 2000) {
      throw new AppError('Incident description must be between 5 and 2000 characters.', 400, 'INVALID_DESCRIPTION');
    }

    const allowedTypes = [
      'Invalid QR',
      'Wrong Vehicle',
      'Overstay',
      'Lost Ticket',
      'Lost Ticket / QR',
      'Vehicle Damage',
      'Parking Dispute',
      'Unauthorized Entry',
      'Unauthorized Exit',
      'Vehicle Breakdown',
      'Incorrect Parking',
      'Security Concern',
      'Emergency',
      'Other',
    ];

    if (!allowedTypes.includes(incidentType)) {
      throw new AppError(`Invalid incident type. Must be one of: ${allowedTypes.join(', ')}`, 400, 'INVALID_INCIDENT_TYPE');
    }

    const allowedSeverities = ['Low', 'Medium', 'High', 'Critical'];
    const chosenSeverity = (severity && allowedSeverities.includes(severity)) ? severity : 'Medium';

    let matchedVehicle: any = null;
    let matchedBooking: any = null;
    let matchedCustomer: any = null;

    if (vehicleNumber && vehicleNumber.trim().length > 0) {
      const cleanVNum = vehicleNumber.replace(/[\s-]/g, '').toUpperCase();
      matchedVehicle = await (VehicleModel as mongoose.Model<Vehicle>).findOne({ vehicleNumber: cleanVNum }).exec();
      if (matchedVehicle && matchedVehicle.customerId) {
        matchedCustomer = await (UserModel as mongoose.Model<User>).findById(matchedVehicle.customerId).exec();
      }
    }

    if (bookingReference && bookingReference.trim().length > 0) {
      const cleanBRef = bookingReference.trim().toUpperCase();
      matchedBooking = await (BookingModel as mongoose.Model<Booking>).findOne({
        parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
        bookingReference: cleanBRef,
      }).exec();

      if (matchedBooking) {
        if (!matchedCustomer && matchedBooking.customerId) {
          matchedCustomer = await (UserModel as mongoose.Model<User>).findById(matchedBooking.customerId).exec();
        }
        if (!matchedVehicle && matchedBooking.vehicleId) {
          matchedVehicle = await (VehicleModel as mongoose.Model<Vehicle>).findById(matchedBooking.vehicleId).exec();
        }
      }
    }

    const incidentReference = `INC-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const createdDoc: any = await (IncidentModel as any).create({
      incidentReference,
      parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
      bookingId: matchedBooking ? matchedBooking._id : null,
      customerId: matchedCustomer ? matchedCustomer._id : null,
      vehicleId: matchedVehicle ? matchedVehicle._id : null,
      reportedBy: staffUser._id,
      incidentSource: 'Security Staff Report',
      incidentType: incidentType as any,
      severity: chosenSeverity,
      incidentStatus: 'Open',
      title: cleanTitle,
      description: cleanDescription,
      attachments: Array.isArray(attachments) ? attachments : [],
      location: location?.trim() || null,
    });

    // Audit log
    await (AuditLogModel as any).create({
      userId: staffUser._id,
      actionCode: 'INCIDENT_REPORTED',
      module: 'Security',
      actionTitle: `Security Incident Reported: ${cleanTitle}`,
      description: `Security staff ${staffUser.fullName} reported incident ${incidentReference} (${incidentType}, Severity: ${chosenSeverity}).`,
      targetCollection: 'incidents',
      targetDocumentId: createdDoc._id,
      actionStatus: 'Success',
    });

    // Emit Socket.IO event
    emitIncidentUpdate({
      incidentId: createdDoc._id.toString(),
      incidentReference,
      parkingLotId,
      action: 'CREATED',
      incidentType,
      severity: chosenSeverity,
      incidentStatus: 'Open',
      title: cleanTitle,
      timestamp: new Date().toISOString(),
    });

    return this.getIncidentDetail({
      staffUserId,
      incidentId: createdDoc._id.toString(),
    });
  }

  /**
   * Updates an incident status (e.g. Open -> Resolved -> Closed), adds resolution notes,
   * records audit log, and emits socket notification.
   */
  public async updateIncidentStatus(params: UpdateIncidentStatusInput): Promise<SecurityIncidentItem> {
    const { staffUserId, incidentId, status, resolutionNotes } = params;

    if (!incidentId || !mongoose.isValidObjectId(incidentId)) {
      throw new AppError('Valid incident ID is required.', 400, 'INVALID_INCIDENT_ID');
    }

    const allowedStatuses = ['Open', 'Under Investigation', 'Resolved', 'Closed'];
    if (!allowedStatuses.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`, 400, 'INVALID_STATUS');
    }

    const inc = await (IncidentModel as mongoose.Model<Incident>).findById(incidentId).exec();
    if (!inc) {
      throw new AppError('Incident report not found.', 404, 'INCIDENT_NOT_FOUND');
    }

    const lotId = inc.parkingLotId.toString();
    await this.assertStaffLotAssignment(staffUserId, lotId);

    const staffUser = await (UserModel as mongoose.Model<User>).findById(staffUserId).lean().exec();
    if (!staffUser) {
      throw new AppError('Authenticated staff user not found.', 401, 'STAFF_NOT_FOUND');
    }

    const prevStatus = inc.incidentStatus;
    inc.incidentStatus = status as any;

    if (resolutionNotes !== undefined && resolutionNotes.trim().length > 0) {
      inc.resolutionNotes = resolutionNotes.trim();
    }

    if (status === 'Resolved') {
      inc.resolvedAt = new Date();
    } else if (status === 'Closed') {
      if (!inc.resolvedAt) inc.resolvedAt = new Date();
      inc.closedAt = new Date();
    } else {
      // Reopening incident
      inc.closedAt = null;
    }

    await inc.save();

    // Audit log
    await (AuditLogModel as any).create({
      userId: staffUser._id,
      actionCode: 'INCIDENT_STATUS_UPDATED',
      module: 'Security',
      actionTitle: `Incident Status Updated to ${status}`,
      description: `Staff ${staffUser.fullName} updated incident ${inc.incidentReference} status from ${prevStatus} to ${status}. Notes: ${resolutionNotes || 'None'}`,
      targetCollection: 'incidents',
      targetDocumentId: inc._id,
      actionStatus: 'Success',
    });

    // Socket notification
    const actionKey: 'RESOLVED' | 'CLOSED' | 'UPDATED' =
      status === 'Resolved' ? 'RESOLVED' : status === 'Closed' ? 'CLOSED' : 'UPDATED';

    emitIncidentUpdate({
      incidentId: inc._id.toString(),
      incidentReference: inc.incidentReference,
      parkingLotId: lotId,
      action: actionKey,
      incidentType: inc.incidentType,
      severity: inc.severity,
      incidentStatus: status,
      title: inc.title,
      timestamp: new Date().toISOString(),
    });

    return this.getIncidentDetail({
      staffUserId,
      incidentId: inc._id.toString(),
    });
  }

  /**
   * Retrieves paginated vehicle movement history with server-side filters, plate/customer search, and facility metrics.
   */
  public async getMovementLogs(params: MovementLogsQueryParams): Promise<MovementLogsListResult> {
    const {
      staffUserId,
      parkingLotId,
      startDate,
      endDate,
      movementType,
      vehicleNumber,
      customerName,
      staffId,
      search,
      page = 1,
      limit = 15,
    } = params;

    // Enforce facility assignment access
    await this.assertStaffLotAssignment(staffUserId, parkingLotId);

    const lotObjectId = new mongoose.Types.ObjectId(parkingLotId);
    const filterQuery: any = { parkingLotId: lotObjectId };

    // Date range filter (entryTime)
    if (startDate && endDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      filterQuery.entryTime = { $gte: s, $lte: e };
    } else if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      filterQuery.entryTime = { $gte: s };
    } else if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      filterQuery.entryTime = { $lte: e };
    }

    // Movement Type filter
    if (movementType && movementType !== 'ALL') {
      if (movementType === 'Entry Denied') {
        filterQuery.$and = filterQuery.$and || [];
        filterQuery.$and.push({
          $or: [
            { remarks: { $regex: /entry denied/i } },
            { movementStatus: 'Cancelled', remarks: { $regex: /denied/i } },
          ],
        });
      } else if (movementType === 'Exit Denied') {
        filterQuery.$and = filterQuery.$and || [];
        filterQuery.$and.push({ remarks: { $regex: /exit denied/i } });
      } else if (movementType === 'Exit') {
        filterQuery.exitTime = { $ne: null };
        filterQuery.remarks = { $not: { $regex: /exit denied/i } };
      } else if (movementType === 'Entry') {
        filterQuery.exitTime = null;
        filterQuery.remarks = { $not: { $regex: /entry denied/i } };
        filterQuery.movementStatus = { $ne: 'Cancelled' };
      }
    }

    // Security Staff filter
    if (staffId && mongoose.isValidObjectId(staffId)) {
      const sObjectId = new mongoose.Types.ObjectId(staffId);
      filterQuery.$and = filterQuery.$and || [];
      filterQuery.$and.push({
        $or: [{ verifiedBy: sObjectId }, { exitVerifiedBy: sObjectId }],
      });
    }

    // Vehicle Number filter
    if (vehicleNumber && vehicleNumber.trim()) {
      const vVehicles = await (VehicleModel as mongoose.Model<Vehicle>)
        .find({ vehicleNumber: { $regex: vehicleNumber.trim(), $options: 'i' } })
        .distinct('_id');
      filterQuery.vehicleId = { $in: vVehicles };
    }

    // Customer Name filter
    if (customerName && customerName.trim()) {
      const cUsers = await (UserModel as mongoose.Model<User>)
        .find({ fullName: { $regex: customerName.trim(), $options: 'i' } })
        .distinct('_id');
      filterQuery.customerId = { $in: cUsers };
    }

    // Multi-field search
    if (search && search.trim()) {
      const sTerm = search.trim();
      const sRegex = { $regex: sTerm, $options: 'i' };

      const [searchVehicles, searchUsers, searchBookings] = await Promise.all([
        (VehicleModel as mongoose.Model<Vehicle>).find({ vehicleNumber: sRegex }).distinct('_id'),
        (UserModel as mongoose.Model<User>)
          .find({ $or: [{ fullName: sRegex }, { mobileNumber: sRegex }] })
          .distinct('_id'),
        (BookingModel as mongoose.Model<Booking>).find({ bookingReference: sRegex }).distinct('_id'),
      ]);

      const searchConditions: any[] = [
        { vehicleId: { $in: searchVehicles } },
        { customerId: { $in: searchUsers } },
        { bookingId: { $in: searchBookings } },
        { remarks: sRegex },
      ];

      if (mongoose.isValidObjectId(sTerm)) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(sTerm) });
      }

      filterQuery.$and = filterQuery.$and || [];
      filterQuery.$and.push({ $or: searchConditions });
    }

    // Execute paginated query
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 15));
    const skip = (pageNum - 1) * limitNum;

    const [logs, totalFilteredCount, totalFacilityRecords, vehiclesInsideCount, completedExitsCount, deniedAttemptsCount] =
      await Promise.all([
        (VehicleMovementLogModel as any)
          .find(filterQuery)
          .populate('bookingId', 'bookingReference bookingStatus bookingType scheduledEntryTime scheduledExitTime actualEntryTime actualExitTime')
          .populate('customerId', 'fullName email mobileNumber')
          .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel vehicleColor')
          .populate('parkingLotId', 'parkingName')
          .populate('floorId', 'floorName floorNumber')
          .populate('zoneId', 'zoneCode zoneName')
          .populate('slotId', 'slotNumber slotLabel slotType')
          .populate('verifiedBy', 'fullName email employeeId')
          .populate('exitVerifiedBy', 'fullName email employeeId')
          .sort({ entryTime: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean()
          .exec(),
        (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>).countDocuments(filterQuery),
        (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>).countDocuments({ parkingLotId: lotObjectId }),
        (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>).countDocuments({
          parkingLotId: lotObjectId,
          movementStatus: { $in: ['Vehicle Inside', 'Overstayed'] },
          exitTime: null,
        }),
        (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>).countDocuments({
          parkingLotId: lotObjectId,
          exitTime: { $ne: null },
        }),
        (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>).countDocuments({
          parkingLotId: lotObjectId,
          $or: [{ movementStatus: 'Cancelled' }, { remarks: { $regex: /denied/i } }],
        }),
      ]);

    // Distinct staff list for dropdown filter
    const [distinctEntryStaff, distinctExitStaff] = await Promise.all([
      (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>)
        .find({ parkingLotId: lotObjectId })
        .distinct('verifiedBy'),
      (VehicleMovementLogModel as mongoose.Model<VehicleMovementLog>)
        .find({ parkingLotId: lotObjectId })
        .distinct('exitVerifiedBy'),
    ]);

    const staffIdSet = new Set<string>();
    distinctEntryStaff.forEach((id) => id && staffIdSet.add(id.toString()));
    distinctExitStaff.forEach((id) => id && staffIdSet.add(id.toString()));

    const staffDocs =
      staffIdSet.size > 0
        ? await (UserModel as mongoose.Model<User>)
            .find({ _id: { $in: Array.from(staffIdSet).map((id) => new mongoose.Types.ObjectId(id)) } })
            .select('fullName employeeId email')
            .lean()
            .exec()
        : [];

    const facilityStaffList = staffDocs.map((s: any) => ({
      staffId: s._id.toString(),
      staffName: s.fullName,
      employeeId: s.employeeId || null,
    }));

    // Helper functions for mapping
    const resolveMovementType = (log: any): MovementType => {
      const remarks = (log.remarks || '').toLowerCase();
      if (remarks.includes('entry denied') || (log.movementStatus === 'Cancelled' && remarks.includes('denied'))) {
        return 'Entry Denied';
      }
      if (remarks.includes('exit denied')) {
        return 'Exit Denied';
      }
      if (log.exitTime || log.movementStatus === 'Vehicle Exited') {
        return 'Exit';
      }
      return 'Entry';
    };

    const formatDuration = (stayMins: number, isInside: boolean, entryTime: Date): string => {
      if (isInside) {
        const elapsedMins = Math.max(0, Math.floor((Date.now() - new Date(entryTime).getTime()) / (60 * 1000)));
        const h = Math.floor(elapsedMins / 60);
        const m = elapsedMins % 60;
        return `${h}h ${m}m (Inside)`;
      }
      const h = Math.floor(stayMins / 60);
      const m = stayMins % 60;
      return `${h}h ${m}m`;
    };

    const mappedLogs: MovementLogItem[] = logs.map((log: any) => {
      const mType = resolveMovementType(log);
      const isInside = mType === 'Entry' && !log.exitTime && log.movementStatus !== 'Cancelled';
      const fDuration = formatDuration(log.stayDurationMinutes || 0, isInside, log.entryTime);
      const mRef = `MV-${log._id.toString().slice(-6).toUpperCase()}`;

      const cust = log.customerId as any;
      const veh = log.vehicleId as any;
      const lot = log.parkingLotId as any;
      const flr = log.floorId as any;
      const zn = log.zoneId as any;
      const slt = log.slotId as any;
      const bk = log.bookingId as any;
      const vb = log.verifiedBy as any;
      const evb = log.exitVerifiedBy as any;

      return {
        _id: log._id.toString(),
        movementReference: mRef,
        bookingId: bk?._id ? bk._id.toString() : log.bookingId?.toString() || '',
        bookingReference: bk?.bookingReference || 'N/A',
        bookingStatus: bk?.bookingStatus || 'N/A',
        bookingType: bk?.bookingType || 'ONLINE',
        customerId: cust?._id ? cust._id.toString() : log.customerId?.toString() || '',
        customerName: cust?.fullName || 'Guest Driver',
        customerMobile: cust?.mobileNumber || 'N/A',
        customerEmail: cust?.email || 'N/A',
        vehicleId: veh?._id ? veh._id.toString() : log.vehicleId?.toString() || '',
        vehicleNumber: veh?.vehicleNumber || log.vehicleNumberSnapshot || 'N/A',
        vehicleType: veh?.vehicleType || 'Car',
        vehicleBrand: veh?.vehicleBrand || undefined,
        vehicleModel: veh?.vehicleModel || undefined,
        parkingLotId: lot?._id ? lot._id.toString() : log.parkingLotId?.toString() || '',
        parkingName: lot?.parkingName || 'Parking Facility',
        floorId: flr?._id ? flr._id.toString() : log.floorId?.toString() || '',
        floorName: flr?.floorName || 'Ground Floor',
        floorNumber: flr?.floorNumber ?? 0,
        zoneId: zn?._id ? zn._id.toString() : log.zoneId?.toString() || '',
        zoneCode: zn?.zoneCode || 'A',
        zoneName: zn?.zoneName || 'Zone A',
        slotId: slt?._id ? slt._id.toString() : log.slotId?.toString() || '',
        slotNumber: slt?.slotNumber || 'Bay',
        slotLabel: slt?.slotLabel || undefined,
        movementType: mType,
        movementStatus: log.movementStatus,
        entryMethod: log.entryMethod,
        entryTime: log.entryTime,
        verifiedByName: vb?.fullName || null,
        verifiedById: vb?._id ? vb._id.toString() : null,
        exitMethod: log.exitMethod || null,
        exitTime: log.exitTime || null,
        exitVerifiedByName: evb?.fullName || null,
        exitVerifiedById: evb?._id ? evb._id.toString() : null,
        stayDurationMinutes: log.stayDurationMinutes || 0,
        formattedDuration: fDuration,
        overstayMinutes: log.overstayMinutes || 0,
        remarks: log.remarks || null,
        createdAt: log.createdAt,
      };
    });

    return {
      logs: mappedLogs,
      pagination: {
        totalCount: totalFilteredCount,
        totalPages: Math.ceil(totalFilteredCount / limitNum) || 1,
        currentPage: pageNum,
        limit: limitNum,
      },
      summary: {
        total: totalFacilityRecords,
        entries: vehiclesInsideCount,
        exits: completedExitsCount,
        denied: deniedAttemptsCount,
        vehiclesInside: vehiclesInsideCount,
      },
      facilityStaffList,
    };
  }

  /**
   * Retrieves full details for a single vehicle movement log, including linked booking, payments, and timeline.
   */
  public async getMovementLogDetail(params: {
    staffUserId: string;
    movementLogId: string;
  }): Promise<MovementLogDetailResult> {
    const { staffUserId, movementLogId } = params;

    if (!mongoose.isValidObjectId(movementLogId)) {
      throw new AppError('Invalid movement log ID.', 400, 'INVALID_LOG_ID');
    }

    const log: any = await (VehicleMovementLogModel as any)
      .findById(movementLogId)
      .populate('bookingId')
      .populate('customerId', 'fullName email mobileNumber')
      .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel vehicleColor fuelType')
      .populate('parkingLotId', 'parkingName address city state postalCode')
      .populate('floorId', 'floorName floorNumber')
      .populate('zoneId', 'zoneCode zoneName')
      .populate('slotId', 'slotNumber slotLabel slotType')
      .populate('verifiedBy', 'fullName email employeeId')
      .populate('exitVerifiedBy', 'fullName email employeeId')
      .lean()
      .exec();

    if (!log) {
      throw new AppError('Movement log record not found.', 404, 'LOG_NOT_FOUND');
    }

    // Enforce facility assignment access
    const lotId = log.parkingLotId?._id ? log.parkingLotId._id.toString() : log.parkingLotId.toString();
    await this.assertStaffLotAssignment(staffUserId, lotId);

    // Fetch linked timeline & payments
    const booking = log.bookingId as any;
    const [timelineDocs, paymentDocs] = await Promise.all([
      booking?._id
        ? (BookingTimelineModel as any)
            .find({ bookingId: booking._id })
            .populate('performedBy', 'fullName email')
            .sort({ eventTime: 1 })
            .lean()
            .exec()
        : [],
      booking?._id
        ? (PaymentModel as any)
            .find({ bookingId: booking._id })
            .sort({ createdAt: 1 })
            .lean()
            .exec()
        : [],
    ]);

    const resolveMovementType = (l: any): MovementType => {
      const remarks = (l.remarks || '').toLowerCase();
      if (remarks.includes('entry denied') || (l.movementStatus === 'Cancelled' && remarks.includes('denied'))) {
        return 'Entry Denied';
      }
      if (remarks.includes('exit denied')) {
        return 'Exit Denied';
      }
      if (l.exitTime || l.movementStatus === 'Vehicle Exited') {
        return 'Exit';
      }
      return 'Entry';
    };

    const formatDuration = (stayMins: number, isInside: boolean, entryTime: Date): string => {
      if (isInside) {
        const elapsedMins = Math.max(0, Math.floor((Date.now() - new Date(entryTime).getTime()) / (60 * 1000)));
        const h = Math.floor(elapsedMins / 60);
        const m = elapsedMins % 60;
        return `${h}h ${m}m (Inside)`;
      }
      const h = Math.floor(stayMins / 60);
      const m = stayMins % 60;
      return `${h}h ${m}m`;
    };

    const mType = resolveMovementType(log);
    const isInside = mType === 'Entry' && !log.exitTime && log.movementStatus !== 'Cancelled';
    const fDuration = formatDuration(log.stayDurationMinutes || 0, isInside, log.entryTime);
    const mRef = `MV-${log._id.toString().slice(-6).toUpperCase()}`;

    const cust = log.customerId as any;
    const veh = log.vehicleId as any;
    const lot = log.parkingLotId as any;
    const flr = log.floorId as any;
    const zn = log.zoneId as any;
    const slt = log.slotId as any;
    const vb = log.verifiedBy as any;
    const evb = log.exitVerifiedBy as any;

    return {
      _id: log._id.toString(),
      movementReference: mRef,
      bookingId: booking?._id ? booking._id.toString() : '',
      bookingReference: booking?.bookingReference || 'N/A',
      bookingStatus: booking?.bookingStatus || 'N/A',
      bookingType: booking?.bookingType || 'ONLINE',
      customerId: cust?._id ? cust._id.toString() : '',
      customerName: cust?.fullName || 'Guest Driver',
      customerMobile: cust?.mobileNumber || 'N/A',
      customerEmail: cust?.email || 'N/A',
      vehicleId: veh?._id ? veh._id.toString() : '',
      vehicleNumber: veh?.vehicleNumber || log.vehicleNumberSnapshot || 'N/A',
      vehicleType: veh?.vehicleType || 'Car',
      vehicleBrand: veh?.vehicleBrand || undefined,
      vehicleModel: veh?.vehicleModel || undefined,
      parkingLotId: lot?._id ? lot._id.toString() : '',
      parkingName: lot?.parkingName || 'Parking Facility',
      floorId: flr?._id ? flr._id.toString() : '',
      floorName: flr?.floorName || 'Ground Floor',
      floorNumber: flr?.floorNumber ?? 0,
      zoneId: zn?._id ? zn._id.toString() : '',
      zoneCode: zn?.zoneCode || 'A',
      zoneName: zn?.zoneName || 'Zone A',
      slotId: slt?._id ? slt._id.toString() : '',
      slotNumber: slt?.slotNumber || 'Bay',
      slotLabel: slt?.slotLabel || undefined,
      movementType: mType,
      movementStatus: log.movementStatus,
      entryMethod: log.entryMethod,
      entryTime: log.entryTime,
      verifiedByName: vb?.fullName || null,
      verifiedById: vb?._id ? vb._id.toString() : null,
      exitMethod: log.exitMethod || null,
      exitTime: log.exitTime || null,
      exitVerifiedByName: evb?.fullName || null,
      exitVerifiedById: evb?._id ? evb._id.toString() : null,
      stayDurationMinutes: log.stayDurationMinutes || 0,
      formattedDuration: fDuration,
      overstayMinutes: log.overstayMinutes || 0,
      remarks: log.remarks || null,
      createdAt: log.createdAt,
      booking: {
        bookingId: booking?._id ? booking._id.toString() : '',
        bookingReference: booking?.bookingReference || 'N/A',
        bookingStatus: booking?.bookingStatus || 'N/A',
        bookingType: booking?.bookingType || 'ONLINE',
        scheduledEntryTime: booking?.scheduledEntryTime || log.entryTime,
        scheduledExitTime: booking?.scheduledExitTime || log.gracePeriodEndsAt,
        actualEntryTime: booking?.actualEntryTime || log.entryTime,
        actualExitTime: booking?.actualExitTime || log.exitTime || null,
        gracePeriodMinutes: booking?.gracePeriodMinutes || 15,
        baseAmount: booking?.baseAmount || 0,
        additionalCharges: booking?.additionalCharges || 0,
        totalAmount: booking?.totalAmount || 0,
        overstayCharge: booking?.overstayCharge || 0,
        overstayDetected: booking?.overstayDetected || false,
      },
      timeline: timelineDocs.map((t: any) => ({
        _id: t._id.toString(),
        eventCode: t.eventCode,
        eventType: t.eventType,
        eventTitle: t.eventTitle,
        eventDescription: t.eventDescription,
        eventSource: t.eventSource,
        eventTime: t.eventTime,
        performedByName: t.performedBy?.fullName || null,
      })),
      payments: paymentDocs.map((p: any) => ({
        _id: p._id.toString(),
        paymentReference: p.paymentReference,
        paymentType: p.paymentTypeCode || p.paymentType || 'BOOKING',
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
        amount: p.amount,
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Generates formatted CSV string for vehicle movements matching the query parameters.
   */
  public async exportMovementLogsCsv(params: MovementLogsQueryParams): Promise<string> {
    const listResult = await this.getMovementLogs({
      ...params,
      page: 1,
      limit: 5000,
    });

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'Movement ID',
      'Booking Reference',
      'Vehicle Number',
      'Vehicle Type',
      'Customer Name',
      'Customer Mobile',
      'Customer Email',
      'Parking Facility',
      'Floor',
      'Zone',
      'Slot',
      'Movement Type',
      'Movement Status',
      'Entry Method',
      'Entry Time',
      'Exit Method',
      'Exit Time',
      'Duration (Mins)',
      'Overstay (Mins)',
      'Verified By (Entry)',
      'Verified By (Exit)',
      'Remarks',
    ];

    const formatDateTime = (iso?: string | Date | null): string => {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
      } catch {
        return '';
      }
    };

    const rows: string[] = [headers.join(',')];

    for (const log of listResult.logs) {
      const entryTimeFormatted = formatDateTime(log.entryTime);
      const exitTimeFormatted = log.exitTime
        ? formatDateTime(log.exitTime)
        : log.movementType === 'Entry'
          ? 'Currently Inside'
          : '';

      const row = [
        escapeCsv(log.movementReference),
        escapeCsv(log.bookingReference),
        escapeCsv(log.vehicleNumber),
        escapeCsv(log.vehicleType),
        escapeCsv(log.customerName),
        escapeCsv(log.customerMobile),
        escapeCsv(log.customerEmail),
        escapeCsv(log.parkingName),
        escapeCsv(log.floorName),
        escapeCsv(log.zoneCode),
        escapeCsv(log.slotNumber),
        escapeCsv(log.movementType),
        escapeCsv(log.movementStatus),
        escapeCsv(log.entryMethod),
        escapeCsv(entryTimeFormatted),
        escapeCsv(log.exitMethod || ''),
        escapeCsv(exitTimeFormatted),
        escapeCsv(log.stayDurationMinutes),
        escapeCsv(log.overstayMinutes),
        escapeCsv(log.verifiedByName || ''),
        escapeCsv(log.exitVerifiedByName || ''),
        escapeCsv(log.remarks || ''),
      ];

      rows.push(row.join(','));
    }

    return rows.join('\r\n');
  }
}

export const securityService = new SecurityService();

