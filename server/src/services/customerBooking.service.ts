import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { BookingModel, type Booking } from '../models/Booking.js';
import { BookingTimelineModel, type BookingTimeline } from '../models/BookingTimeline.js';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { ParkingFloorModel, type ParkingFloor } from '../models/ParkingFloor.js';
import { ParkingZoneModel, type ParkingZone } from '../models/ParkingZone.js';
import { ParkingLayoutModel, type ParkingLayout } from '../models/ParkingLayout.js';
import { ParkingSlotModel, type ParkingSlot } from '../models/ParkingSlot.js';
import {
  ParkingFacilitySubmissionModel,
  type ParkingFacilitySubmission,
} from '../models/ParkingFacilitySubmission.js';
import { PaymentModel, type Payment } from '../models/Payment.js';
import { NotificationModel, type Notification } from '../models/Notification.js';
import { VehicleModel, type Vehicle } from '../models/Vehicle.js';
import { UserModel, type User } from '../models/User.js';
import { VehicleMovementLogModel } from '../models/VehicleMovementLog.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { razorpayService } from './razorpay.service.js';
import { notificationService } from './notification.service.js';
import { auditService } from './audit.service.js';
import { emailService } from './email.service.js';
import { adminSettingsService } from './adminSettings.service.js';
import { emitSlotStatusUpdate, emitBookingStatusUpdate, emitNewNotification } from '../socket.js';
import {
  customerParkingService,
  type CustomerParkingLotResult,
} from './customerParking.service.js';

export type SupportedVehicleType = 'Bike' | 'Car' | 'SUV' | 'EV';

export type EffectiveSlotStatus =
  | 'Available'
  | 'Reserved'
  | 'Occupied'
  | 'Under Maintenance';

export interface CustomerBookingSlotInfo {
  _id: string;
  slotNumber: string;
  slotLabel: string;
  slotType: string;
  supportedVehicleType: SupportedVehicleType;
  floorId: string;
  floorName: string;
  floorNumber: number;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  physicalStatus: string;
  effectiveStatus: EffectiveSlotStatus;
  isVehicleCompatible: boolean;
  isEligible: boolean;
  isOverflow?: boolean;
  ineligibilityReason: string | null;
  expectedAvailableAt?: string | null;
  expectedAvailableMinutes?: number | null;
}

export interface PriceBreakdownResult {
  vehicleType: SupportedVehicleType;
  scheduledEntryTime: string;
  scheduledExitTime: string;
  bookingDurationMinutes: number;
  billableHours: number;
  hourlyRate: number;
  overstayRateAtBooking: number;
  gracePeriodMinutes: number;
  baseAmount: number;
  platformBookingFee: number;
  additionalCharges: number;
  totalAmount: number;
  appliedPricingTier: string;
}

export interface BookingFloorContext {
  floor: {
    _id: string;
    floorName: string;
    floorNumber: number;
    floorStatus: string;
    totalSlots: number;
  };
  zones: Array<{
    _id: string;
    zoneCode: string;
    zoneName: string;
    vehicleType: string | null;
    zoneStatus: string;
    totalSlots: number;
  }>;
  layout: {
    _id: string;
    version: number;
    canvasConfig: {
      width: number;
      height: number;
      gridSize: number;
      snapToGrid: boolean;
      backgroundColor: string;
    };
    elements: Array<Record<string, unknown>>;
  };
  slots: CustomerBookingSlotInfo[];
  slotSummary: {
    totalSlots: number;
    availableCount: number;
    reservedCount: number;
    occupiedCount: number;
    maintenanceCount: number;
    compatibleAvailableCount: number;
  };
}

export interface BookingContextResponse {
  facility: {
    _id: string;
    parkingName: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    hourlyRate: number;
    gracePeriodMinutes: number;
    openingTime: string;
    closingTime: string;
    isOpen24Hours: boolean;
    pricing: {
      carHourlyRate: number;
      suvHourlyRate: number;
      bikeHourlyRate: number;
      dailyRate: number;
      overnightRate: number;
      evChargingRatePerHour: number;
      gracePeriodMinutes: number;
      minParkingDurationHours: number;
      maxParkingDurationHours: number;
    };
    vehicleCapacityByType: Record<
      SupportedVehicleType,
      { totalSlots: number; operationalSlots: number; isOffered: boolean }
    >;
  };
  floors: Array<{
    _id: string;
    floorName: string;
    floorNumber: number;
    floorStatus: string;
    totalSlots: number;
  }>;
  activeFloor: BookingFloorContext;
  priceBreakdown: PriceBreakdownResult;
}

export interface InitiateBookingPaymentInput {
  userId: string;
  parkingLotId: string;
  slotId: string;
  vehicleId: string;
  scheduledEntryTime: string;
  scheduledExitTime: string;
}

export interface InitiateBookingPaymentResponse {
  bookingId: string;
  bookingReference: string;
  paymentReference: string;
  orderId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  keyId: string;
  customer: {
    name: string;
    email: string;
    contact: string;
  };
  summary: {
    facilityName: string;
    floorName: string;
    zoneCode: string;
    slotNumber: string;
    vehicleNumber: string;
    vehicleType: string;
    scheduledEntryTime: string;
    scheduledExitTime: string;
    bookingDurationMinutes: number;
    totalAmount: number;
  };
}

export interface VerifyBookingPaymentInput {
  userId: string;
  bookingId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyBookingPaymentResponse {
  bookingStatus: 'Confirmed' | 'Cancelled';
  bookingReference: string;
  bookingId: string;
  qrCode: string | null;
  paymentReference: string;
  paymentStatus: 'SUCCESSFUL' | 'REFUNDED' | 'FAILED';
  transactionId: string | null;
  conflictRefundInitiated?: boolean;
  message: string;
  customerDetails: {
    fullName: string;
    email: string;
    mobileNumber: string;
  };
  paymentDetails: {
    paymentReference: string;
    paymentMethod: string;
    paymentStatus: 'SUCCESSFUL' | 'REFUNDED' | 'FAILED';
    paymentDate: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    paymentVerificationReference: string;
  };
  bookingDetails: {
    facilityName: string;
    address: string;
    floorName: string;
    zoneName: string;
    zoneCode: string;
    slotNumber: string;
    slotLabel: string;
    vehicleNumber: string;
    vehicleType: string;
    vehicleBrand?: string | null;
    vehicleModel?: string | null;
    bookingType: string;
    scheduledEntryTime: string;
    scheduledExitTime: string;
    gracePeriodMinutes: number;
    bookingDurationMinutes: number;
    parkingRateAtBooking?: number;
    baseAmount: number;
    platformBookingFee?: number;
    taxes: number;
    discountAmount: number;
    additionalCharges: number;
    totalAmount: number;
  };
}

export type CustomerBookingCategory =
  | 'Upcoming'
  | 'Active'
  | 'Completed'
  | 'Cancelled'
  | 'No Show'
  | 'Overstay'
  | 'All';

export type CanonicalBookingStatus =
  | 'Pending Payment'
  | 'Confirmed'
  | 'Active'
  | 'Completed'
  | 'Cancelled'
  | 'No Show'
  | 'Overstay';

export interface CustomerBookingItem {
  bookingId: string;
  bookingReference: string;
  parkingLotId: string;
  parkingName: string;
  parkingAddress: string;
  parkingCity: string;
  parkingImages: string[];
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
  currentSlot: {
    _id: string;
    slotNumber: string;
    slotLabel: string;
    slotType: string;
    supportedVehicleType: string;
  };
  originalSlot: {
    _id: string;
    slotNumber: string;
    slotLabel: string;
  } | null;
  vehicle: {
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    vehicleBrand: string | null;
    vehicleModel: string | null;
    vehicleColor: string | null;
    fuelType: string | null;
  };
  bookingType: 'ONLINE' | 'WALK_IN';
  bookingStatus: CanonicalBookingStatus;
  scheduledEntryTime: string;
  scheduledExitTime: string;
  actualEntryTime: string | null;
  actualExitTime: string | null;
  gracePeriodMinutes: number;
  gracePeriodEndsAt: string;
  bookingDurationMinutes: number;
  remainingMinutes: number | null;
  parkingRateAtBooking: number;
  overstayRateAtBooking: number;
  baseAmount: number;
  platformBookingFee: number;
  additionalCharges: number;
  totalAmount: number;
  canViewQr: boolean;
  qrCode: string | null;
  canDownloadReceipt: boolean;
  payment: {
    paymentReference: string;
    paymentMethod: string;
    paymentStatus: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED' | 'CASH_REVERSAL_PENDING';
    paymentDate: string | null;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    transactionId: string | null;
    amount: number;
    refundAmount: number;
    refundStatus: string | null;
    refundReason: string | null;
    refundPercentage: number | null;
    refundCompletedAt: string | null;
  } | null;
  overstay: {
    overstayDetected: boolean;
    overstayStartedAt: string | null;
    overstayDurationMinutes: number;
    overstayCharge: number;
    additionalChargePaymentStatus: 'PAID' | 'UNPAID' | 'NOT_APPLICABLE';
  };
  reassignment: {
    slotReassignmentStatus:
    | 'NOT_REQUIRED'
    | 'PENDING'
    | 'REASSIGNED'
    | 'FAILED'
    | 'CANCELLED_REFUNDED';
    slotReassignmentReason: string | null;
    slotReassignedAt: string | null;
    originalSlotNumber: string | null;
    currentSlotNumber: string;
  };
  cancellation: {
    cancellationReason: string | null;
    cancellationBy: string | null;
    cancelledAt: string | null;
    refundAmount: number;
    refundPercentage: number | null;
    refundStatus: string | null;
  } | null;
  noShowDetected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerBookingTimelineItem {
  _id: string;
  bookingId: string;
  bookingReference: string;
  parkingName: string;
  eventCode: string;
  eventType: string;
  eventTitle: string;
  eventDescription: string | null;
  eventSource: string;
  eventTime: string;
}

export interface CustomerActivityChartPoint {
  monthKey: string;
  label: string;
  totalBookings: number;
  completedBookings: number;
  activeOrUpcomingBookings: number;
  cancelledOrNoShowBookings: number;
  amountSpent: number;
}

export interface CustomerDashboardOverviewResponse {
  stats: {
    activeBookingsCount: number;
    upcomingBookingsCount: number;
    completedBookingsCount: number;
    cancelledBookingsCount: number;
    noShowBookingsCount: number;
    overstayBookingsCount: number;
    totalBookingsCount: number;
    registeredVehiclesCount: number;
    digitalReceiptsCount: number;
    totalSpentAmount: number;
  };
  activeBooking: CustomerBookingItem | null;
  upcomingBooking: CustomerBookingItem | null;
  recentActivity: CustomerBookingTimelineItem[];
  activityChart: {
    hasActivityData: boolean;
    points: CustomerActivityChartPoint[];
  };
  favouriteLocations: Array<CustomerParkingLotResult & { favouritedAt: string }>;
  unreadNotifications: Array<{
    _id: string;
    notificationReference: string;
    bookingId: string | null;
    notificationType: string;
    eventType: string;
    title: string;
    message: string;
    priority: string;
    isRead: boolean;
    actionUrl: string | null;
    createdAt: string;
  }>;
  unreadNotificationCount: number;
}

export interface PaginatedCustomerBookingsResponse {
  bookings: CustomerBookingItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  categoryCounts: {
    Upcoming: number;
    Active: number;
    Completed: number;
    Cancelled: number;
    'No Show': number;
    Overstay: number;
    All: number;
  };
  facilities: Array<{
    _id: string;
    parkingName: string;
  }>;
}

export interface CustomerBookingDetailsResponse {
  booking: CustomerBookingItem;
  customerDetails: {
    fullName: string;
    email: string;
    mobileNumber: string;
  };
  timeline: CustomerBookingTimelineItem[];
  receiptData: VerifyBookingPaymentResponse | null;
}

export class CustomerBookingService {
  /**
   * Generates a unique canonical booking reference (e.g. PB-20261112-A1B2C3)
   */
  private generateBookingReference(): string {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `PB-${datePart}-${rand}`;
  }

  /**
   * Generates a unique payment reference
   */
  private generatePaymentReference(): string {
    return `PAY-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  }

  /**
   * Generates a unique cryptographic QR pass token for a confirmed booking
   */
  private generateBookingQrCode(bookingReference: string, slotQrIdentifier: string): string {
    const token = crypto.randomBytes(6).toString('hex').toUpperCase();
    return `PE-PASS|${bookingReference}|${slotQrIdentifier}|${token}`;
  }

  /**
   * Resolves facility pricing configuration from ParkingLot and its approved Submission
   */
  private async resolveFacilityPricing(lot: ParkingLot) {
    const baseCarRate = lot.hourlyRate;
    let globalGracePeriod: number | undefined;
    try {
      const sysSettings = await adminSettingsService.getSettings();
      if (typeof sysSettings?.bookingGracePeriodMinutes === 'number') {
        globalGracePeriod = sysSettings.bookingGracePeriodMinutes;
      }
    } catch {
      // Fallback to facility defaults
    }

    let pricing = {
      carHourlyRate: baseCarRate,
      suvHourlyRate: baseCarRate,
      bikeHourlyRate: Math.max(0, Math.round(baseCarRate * 0.5)),
      dailyRate: baseCarRate * 8,
      overnightRate: baseCarRate * 10,
      evChargingRatePerHour: baseCarRate,
      gracePeriodMinutes: globalGracePeriod ?? lot.gracePeriodMinutes ?? 15,
      minParkingDurationHours: 1,
      maxParkingDurationHours: 24,
    };

    let operating = {
      isOpen24x7: Boolean(lot.isOpen24Hours),
      openingTime: lot.openingTime || '00:00',
      closingTime: lot.closingTime || '23:59',
    };

    if (lot.submissionId) {
      try {
        const sub = await (
          ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
        )
          .findById(lot.submissionId)
          .lean()
          .exec();

        if (sub?.pricing) {
          const resolvedCarRate =
            typeof sub.pricing.carHourlyRate === 'number' && sub.pricing.carHourlyRate > 0
              ? sub.pricing.carHourlyRate
              : baseCarRate;
          const rawEvRate =
            typeof sub.pricing.evChargingRatePerHour === 'number'
              ? sub.pricing.evChargingRatePerHour
              : 0;
          const effectiveEvRate = rawEvRate > 0 ? rawEvRate : resolvedCarRate;

          pricing = {
            carHourlyRate: resolvedCarRate,
            suvHourlyRate:
              typeof sub.pricing.suvHourlyRate === 'number' && sub.pricing.suvHourlyRate > 0
                ? sub.pricing.suvHourlyRate
                : resolvedCarRate,
            bikeHourlyRate:
              typeof sub.pricing.bikeHourlyRate === 'number' && sub.pricing.bikeHourlyRate > 0
                ? sub.pricing.bikeHourlyRate
                : Math.max(0, Math.round(resolvedCarRate * 0.5)),
            dailyRate: sub.pricing.dailyRate || resolvedCarRate * 8,
            overnightRate: sub.pricing.overnightRate || resolvedCarRate * 10,
            evChargingRatePerHour: effectiveEvRate,
            gracePeriodMinutes:
              globalGracePeriod ?? sub.pricing.gracePeriodMinutes ?? lot.gracePeriodMinutes ?? 15,
            minParkingDurationHours: sub.pricing.minParkingDurationHours || 1,
            maxParkingDurationHours: sub.pricing.maxParkingDurationHours || 24,
          };
        }
        if (sub?.operatingInfo) {
          operating = {
            isOpen24x7: sub.operatingInfo.isOpen24x7 ?? Boolean(lot.isOpen24Hours),
            openingTime: sub.operatingInfo.openingTime || lot.openingTime || '00:00',
            closingTime: sub.operatingInfo.closingTime || lot.closingTime || '23:59',
          };
        }
      } catch {
        // Fallback to lot defaults
      }
    }

    return { pricing, operating };
  }

  /**
   * Validates that a requested booking interval [entryDate, exitDate] falls continuously
   * within the facility's configured operating hours when not open 24x7.
   */
  public validateOperatingHoursWindow(
    entryDate: Date,
    exitDate: Date,
    operating: {
      isOpen24x7: boolean;
      openingTime: string;
      closingTime: string;
    },
  ): void {
    if (operating.isOpen24x7) {
      return;
    }

    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const rawOpen = (operating.openingTime || '').trim();
    const rawClose = (operating.closingTime || '').trim();

    const openMatch = timePattern.exec(rawOpen);
    const closeMatch = timePattern.exec(rawClose);

    if (!openMatch || !closeMatch) {
      throw new AppError(
        'Facility operating hours schedule is invalid or not configured.',
        400,
        'INVALID_OPERATING_SCHEDULE',
      );
    }

    const openH = Number(openMatch[1]);
    const openM = Number(openMatch[2]);
    const closeH = Number(closeMatch[1]);
    const closeM = Number(closeMatch[2]);

    const openMins = openH * 60 + openM;
    const closeMins = closeH * 60 + closeM;

    if (openMins === closeMins) {
      throw new AppError(
        'Facility operating hours schedule is invalid (opening and closing times cannot be identical when not open 24×7).',
        400,
        'INVALID_OPERATING_SCHEDULE',
      );
    }

    if (openMins < closeMins) {
      // Standard daytime operating window on a single calendar day (e.g. 08:00 – 22:00)
      const windowStart = new Date(entryDate);
      windowStart.setHours(openH, openM, 0, 0);

      const windowEnd = new Date(entryDate);
      windowEnd.setHours(closeH, closeM, 0, 0);

      if (
        entryDate.getTime() < windowStart.getTime() ||
        exitDate.getTime() > windowEnd.getTime()
      ) {
        throw new AppError(
          `Requested time falls outside facility operating hours (${rawOpen} – ${rawClose}). Bookings cannot cross closed overnight hours.`,
          400,
          'OUTSIDE_OPERATING_HOURS',
        );
      }
      return;
    }

    // Overnight operating window crossing midnight (e.g. 18:00 – 06:00)
    const entryDayOpen = new Date(entryDate);
    entryDayOpen.setHours(openH, openM, 0, 0);

    const entryDayClose = new Date(entryDate);
    entryDayClose.setHours(closeH, closeM, 0, 0);

    let windowStart: Date;
    let windowEnd: Date;

    if (entryDate.getTime() >= entryDayOpen.getTime()) {
      windowStart = entryDayOpen;
      windowEnd = new Date(entryDayClose);
      windowEnd.setDate(windowEnd.getDate() + 1);
    } else if (entryDate.getTime() <= entryDayClose.getTime()) {
      windowStart = new Date(entryDayOpen);
      windowStart.setDate(windowStart.getDate() - 1);
      windowEnd = entryDayClose;
    } else {
      throw new AppError(
        `Requested time falls outside facility operating hours (${rawOpen} – ${rawClose}).`,
        400,
        'OUTSIDE_OPERATING_HOURS',
      );
    }

    if (
      entryDate.getTime() < windowStart.getTime() ||
      exitDate.getTime() > windowEnd.getTime()
    ) {
      throw new AppError(
        `Requested time falls outside facility operating hours (${rawOpen} – ${rawClose}).`,
        400,
        'OUTSIDE_OPERATING_HOURS',
      );
    }
  }

  /**
   * Validates requested booking start/end window and calculates accurate price breakdown
   */
  public calculatePriceAndValidatePeriod(params: {
    vehicleType: SupportedVehicleType;
    scheduledEntryTime: string | Date;
    scheduledExitTime: string | Date;
    pricing: {
      carHourlyRate: number;
      suvHourlyRate: number;
      bikeHourlyRate: number;
      dailyRate: number;
      overnightRate: number;
      evChargingRatePerHour: number;
      gracePeriodMinutes: number;
      minParkingDurationHours: number;
      maxParkingDurationHours: number;
    };
    operating: {
      isOpen24x7: boolean;
      openingTime: string;
      closingTime: string;
    };
    platformBookingFee?: number;
    allowNearPresentBuffer?: boolean;
  }): {
    entryDate: Date;
    exitDate: Date;
    breakdown: PriceBreakdownResult;
  } {
    const entryDate = new Date(params.scheduledEntryTime);
    const exitDate = new Date(params.scheduledExitTime);

    if (isNaN(entryDate.getTime()) || isNaN(exitDate.getTime())) {
      throw new AppError(
        'Invalid booking start or end date/time format.',
        400,
        'INVALID_BOOKING_TIME',
      );
    }

    // Allow a 10-minute grace tolerance for 'now' selections on the client clock
    const nowToleranceMs = params.allowNearPresentBuffer !== false ? 10 * 60 * 1000 : 2 * 60 * 1000;
    if (entryDate.getTime() < Date.now() - nowToleranceMs) {
      throw new AppError(
        'Booking start time cannot be in the past. Please choose a current or upcoming arrival time.',
        400,
        'PAST_ENTRY_TIME',
      );
    }

    if (exitDate.getTime() <= entryDate.getTime()) {
      throw new AppError(
        'Booking end time must be after the start time.',
        400,
        'INVALID_TIME_RANGE',
      );
    }

    const durationMinutes = Math.round((exitDate.getTime() - entryDate.getTime()) / (60 * 1000));
    const minMinutes = Math.max(30, (params.pricing.minParkingDurationHours || 1) * 60);
    const maxMinutes = Math.max(60, (params.pricing.maxParkingDurationHours || 24) * 60);

    if (durationMinutes < minMinutes) {
      throw new AppError(
        `Minimum booking duration for this facility is ${params.pricing.minParkingDurationHours || 1} hour(s).`,
        400,
        'DURATION_TOO_SHORT',
      );
    }

    if (durationMinutes > maxMinutes) {
      throw new AppError(
        `Maximum single booking duration for this facility is ${params.pricing.maxParkingDurationHours || 24} hours.`,
        400,
        'DURATION_TOO_LONG',
      );
    }

    // Operating hours check when not open 24x7
    this.validateOperatingHoursWindow(entryDate, exitDate, params.operating);

    const billableHours = Math.max(1, Math.ceil(durationMinutes / 60));

    let hourlyRate: number;
    let appliedPricingTier: string;

    switch (params.vehicleType) {
      case 'Bike':
        hourlyRate = params.pricing.bikeHourlyRate;
        appliedPricingTier = 'Two-Wheeler Hourly Rate';
        break;
      case 'SUV':
        hourlyRate = params.pricing.suvHourlyRate;
        appliedPricingTier = 'SUV / Large Vehicle Hourly Rate';
        break;
      case 'EV':
        hourlyRate =
          params.pricing.evChargingRatePerHour > 0
            ? params.pricing.evChargingRatePerHour
            : params.pricing.carHourlyRate;
        appliedPricingTier = 'EV Hourly Rate';
        break;
      case 'Car':
      default:
        hourlyRate = params.pricing.carHourlyRate;
        appliedPricingTier = 'Four-Wheeler Hourly Rate';
        break;
    }

    const platformBookingFee = Math.max(0, Number(params.platformBookingFee) || 0);
    const baseAmount = Math.round(billableHours * hourlyRate);
    const additionalCharges = 0;
    const totalAmount = baseAmount + additionalCharges + platformBookingFee;

    return {
      entryDate,
      exitDate,
      breakdown: {
        vehicleType: params.vehicleType,
        scheduledEntryTime: entryDate.toISOString(),
        scheduledExitTime: exitDate.toISOString(),
        bookingDurationMinutes: durationMinutes,
        billableHours,
        hourlyRate,
        overstayRateAtBooking: hourlyRate,
        gracePeriodMinutes: params.pricing.gracePeriodMinutes,
        baseAmount,
        platformBookingFee,
        additionalCharges,
        totalAmount,
        appliedPricingTier,
      },
    };
  }

  /**
   * Verifies that a facility is eligible for customer booking (Rule 9)
   */
  private async verifyEligibleFacility(parkingLotId: string) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking facility ID.', 400, 'INVALID_FACILITY_ID');
    }

    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(parkingLotId)
      .lean()
      .exec();

    if (
      !lot ||
      lot.parkingStatus !== 'Active' ||
      !lot.isVerified ||
      lot.layoutReviewStatus !== 'Owner Confirmed'
    ) {
      throw new AppError(
        'This parking facility is not currently active or available for reservations.',
        404,
        'FACILITY_NOT_ELIGIBLE',
      );
    }

    // Verify published layouts exist
    const publishedLayoutsCount = await (
      ParkingLayoutModel as mongoose.Model<ParkingLayout>
    ).countDocuments({
      parkingLotId: lot._id,
      isPublished: true,
      status: 'Published',
    });

    if (publishedLayoutsCount === 0) {
      throw new AppError(
        'No published 2D parking layout is available for this facility.',
        404,
        'NO_PUBLISHED_LAYOUT',
      );
    }

    return lot;
  }

  /**
   * Finds all conflicting bookings for a set of slots in a requested time window.
   * Two intervals [A_start, A_end] and [B_start, B_end] overlap iff A_start < B_end AND A_end > B_start.
   */
  private async findConflictingSlotMap(params: {
    parkingLotId: mongoose.Types.ObjectId;
    slotIds: mongoose.Types.ObjectId[];
    entryDate: Date;
    exitDate: Date;
    excludeBookingId?: mongoose.Types.ObjectId | undefined;
  }): Promise<Map<string, 'Occupied' | 'Reserved'>> {
    const conflictMap = new Map<string, 'Occupied' | 'Reserved'>();
    if (params.slotIds.length === 0) return conflictMap;

    const filter: Record<string, unknown> = {
      parkingLotId: params.parkingLotId,
      currentSlotId: { $in: params.slotIds },
      bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
      scheduledEntryTime: { $lt: params.exitDate },
      scheduledExitTime: { $gt: params.entryDate },
    };

    if (params.excludeBookingId) {
      filter._id = { $ne: params.excludeBookingId };
    }

    const overlappingBookings = await (BookingModel as mongoose.Model<Booking>)
      .find(filter, 'currentSlotId bookingStatus')
      .lean()
      .exec();

    for (const b of overlappingBookings) {
      const sId = b.currentSlotId.toString();
      if (b.bookingStatus === 'Active' || b.bookingStatus === 'Overstay') {
        conflictMap.set(sId, 'Occupied');
      } else if (!conflictMap.has(sId)) {
        conflictMap.set(sId, 'Reserved');
      }
    }

    return conflictMap;
  }

  /**
   * Determines whether a booking's scheduled time window falls within the immediate physical reservation window.
   * Future-dated bookings outside the immediate arrival window remain tracked via BookingModel time-overlap queries
   * without prematurely marking the physical ParkingSlot as Reserved.
   */
  private isBookingInImmediatePhysicalWindow(
    scheduledEntryTime: Date,
    scheduledExitTime: Date,
    gracePeriodMinutes = 15,
    refNow = new Date(),
  ): boolean {
    const windowLeadMs = Math.max(15, gracePeriodMinutes) * 60 * 1000;
    return (
      scheduledEntryTime.getTime() <= refNow.getTime() + windowLeadMs &&
      scheduledExitTime.getTime() > refNow.getTime()
    );
  }

  /**
   * Reconciles cached availableSlots, reservedSlots, occupiedSlots, and occupancyPercentage counters
   * on ParkingZone, ParkingFloor, and ParkingLot directly from authoritative ParkingSlot physical states.
   */
  public async reconcileHierarchyCounters(params: {
    parkingLotId: mongoose.Types.ObjectId;
    floorId: mongoose.Types.ObjectId;
    zoneId: mongoose.Types.ObjectId;
    session?: mongoose.ClientSession | undefined;
  }): Promise<void> {
    const session = params.session ?? null;

    const [lotSlots, freshZone, freshFloor, freshLot] = await Promise.all([
      (ParkingSlotModel as mongoose.Model<ParkingSlot>)
        .find({ parkingLotId: params.parkingLotId }, 'floorId zoneId slotStatus')
        .session(session)
        .lean()
        .exec(),
      (ParkingZoneModel as mongoose.Model<ParkingZone>)
        .findById(params.zoneId)
        .session(session)
        .exec(),
      (ParkingFloorModel as mongoose.Model<ParkingFloor>)
        .findById(params.floorId)
        .session(session)
        .exec(),
      (ParkingLotModel as mongoose.Model<ParkingLot>)
        .findById(params.parkingLotId)
        .session(session)
        .exec(),
    ]);

    const zoneIdStr = params.zoneId.toString();
    const floorIdStr = params.floorId.toString();

    const zoneSlots = lotSlots.filter((s) => s.zoneId.toString() === zoneIdStr);
    const floorSlots = lotSlots.filter((s) => s.floorId.toString() === floorIdStr);

    if (freshZone) {
      const zAvail = zoneSlots.filter((s) => s.slotStatus === 'Available').length;
      const zReserved = zoneSlots.filter((s) => s.slotStatus === 'Reserved').length;
      const zOccupied = zoneSlots.filter((s) => s.slotStatus === 'Occupied').length;
      const zTotal = Math.max(freshZone.totalSlots || 0, zoneSlots.length);
      freshZone.totalSlots = zTotal;
      freshZone.availableSlots = zAvail;
      freshZone.reservedSlots = zReserved;
      freshZone.occupiedSlots = zOccupied;
      freshZone.occupancyPercentage =
        zTotal > 0 ? Math.min(100, Math.round(((zOccupied + zReserved) / zTotal) * 100)) : 0;
      await freshZone.save({ session });
    }

    if (freshFloor) {
      const fAvail = floorSlots.filter((s) => s.slotStatus === 'Available').length;
      const fReserved = floorSlots.filter((s) => s.slotStatus === 'Reserved').length;
      const fOccupied = floorSlots.filter((s) => s.slotStatus === 'Occupied').length;
      const fTotal = Math.max(freshFloor.totalSlots || 0, floorSlots.length);
      freshFloor.totalSlots = fTotal;
      freshFloor.availableSlots = fAvail;
      freshFloor.reservedSlots = fReserved;
      freshFloor.occupiedSlots = fOccupied;
      freshFloor.occupancyPercentage =
        fTotal > 0 ? Math.min(100, Math.round(((fOccupied + fReserved) / fTotal) * 100)) : 0;
      await freshFloor.save({ session });
    }

    if (freshLot) {
      const lAvail = lotSlots.filter((s) => s.slotStatus === 'Available').length;
      const lReserved = lotSlots.filter((s) => s.slotStatus === 'Reserved').length;
      const lOccupied = lotSlots.filter((s) => s.slotStatus === 'Occupied').length;
      const lTotal = Math.max(freshLot.totalSlots || 0, lotSlots.length);
      freshLot.totalSlots = lTotal;
      freshLot.availableSlots = lAvail;
      freshLot.reservedSlots = lReserved;
      freshLot.occupiedSlots = lOccupied;
      freshLot.occupancyPercentage =
        lTotal > 0 ? Math.min(100, Math.round(((lOccupied + lReserved) / lTotal) * 100)) : 0;
      await freshLot.save({ session });
    }
  }

  /**
   * Releases a physical slot back to Available (or hands it off to Reserved if another Confirmed booking
   * is currently within its immediate arrival window) and reconciles Zone, Floor, and Lot counters.
   */
  public async releaseOrHandOffPhysicalSlot(params: {
    slot: mongoose.HydratedDocument<ParkingSlot>;
    releasedBookingId: mongoose.Types.ObjectId;
    gracePeriodMinutes?: number | undefined;
    session?: mongoose.ClientSession | undefined;
  }): Promise<void> {
    const session = params.session ?? null;
    const { slot } = params;

    if (slot.slotStatus !== 'Under Maintenance') {
      const now = new Date();
      const graceMins = params.gracePeriodMinutes ?? 15;
      const windowLeadEnd = new Date(now.getTime() + Math.max(15, graceMins) * 60 * 1000);

      const nextImmediateBooking = await (BookingModel as mongoose.Model<Booking>)
        .findOne({
          _id: { $ne: params.releasedBookingId },
          parkingLotId: slot.parkingLotId,
          currentSlotId: slot._id,
          bookingStatus: 'Confirmed',
          scheduledEntryTime: { $lte: windowLeadEnd },
          scheduledExitTime: { $gt: now },
        })
        .sort({ scheduledEntryTime: 1 })
        .session(session)
        .exec();

      if (nextImmediateBooking) {
        slot.slotStatus = 'Reserved';
        slot.currentBookingId = nextImmediateBooking._id as mongoose.Types.ObjectId;
      } else {
        slot.slotStatus = 'Available';
        slot.currentBookingId = null;
      }

      await slot.save({ session });
    }

    await this.reconcileHierarchyCounters({
      parkingLotId: slot.parkingLotId as mongoose.Types.ObjectId,
      floorId: slot.floorId as mongoose.Types.ObjectId,
      zoneId: slot.zoneId as mongoose.Types.ObjectId,
      session: params.session,
    });
  }

  /**
   * Evaluates whether a physical slot is compatible with the customer's selected vehicle type.
   * Overflow slots provide universal vehicle compatibility (accept Bike, Car, SUV, EV).
   */
  private isSlotCompatibleWithVehicle(
    slotSupportedType: string,
    requestedVehicleType: SupportedVehicleType,
    isOverflow?: boolean,
  ): boolean {
    if (isOverflow) {
      return true;
    }
    return slotSupportedType === requestedVehicleType;
  }

  /**
   * Retrieves the complete booking context for a facility:
   * - Facility info & pricing
   * - Operational floors with published layouts
   * - Active floor's published 2D layout elements, zones, and time-window evaluated slot statuses
   * - Calculated price breakdown
   */
  public async getBookingContext(params: {
    parkingLotId: string;
    floorId?: string | undefined;
    vehicleType?: SupportedVehicleType | undefined;
    scheduledEntryTime?: string | undefined;
    scheduledExitTime?: string | undefined;
  }): Promise<BookingContextResponse> {
    const lot = await this.verifyEligibleFacility(params.parkingLotId);
    const { pricing, operating } = await this.resolveFacilityPricing(lot);

    const lotObjectId = new mongoose.Types.ObjectId(params.parkingLotId);

    // Fetch active floors that have a published layout
    const publishedLayouts = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .find({
        parkingLotId: lotObjectId,
        isPublished: true,
        status: 'Published',
      })
      .lean()
      .exec();

    const publishedFloorIdSet = new Set(publishedLayouts.map((l) => l.floorId.toString()));

    const allFloors = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
      .find({
        parkingLotId: lotObjectId,
        floorStatus: 'Active',
      })
      .sort({ floorNumber: 1 })
      .lean()
      .exec();

    const eligibleFloors = allFloors.filter((f) => publishedFloorIdSet.has(f._id.toString()));

    if (eligibleFloors.length === 0) {
      throw new AppError(
        'No active floors with published 2D layouts are available for booking.',
        404,
        'NO_ELIGIBLE_FLOORS',
      );
    }

    // Aggregate official slot counts by supportedVehicleType across all eligible floors
    const eligibleFloorIds = eligibleFloors.map((f) => f._id as mongoose.Types.ObjectId);
    const vehicleTypeAgg = await (ParkingSlotModel as mongoose.Model<ParkingSlot>).aggregate<{
      _id: string;
      totalSlots: number;
      operationalSlots: number;
    }>([
      {
        $match: {
          parkingLotId: lotObjectId,
          floorId: { $in: eligibleFloorIds },
        },
      },
      {
        $group: {
          _id: '$supportedVehicleType',
          totalSlots: { $sum: 1 },
          operationalSlots: {
            $sum: { $cond: [{ $ne: ['$slotStatus', 'Under Maintenance'] }, 1, 0] },
          },
        },
      },
    ]);

    const vehicleCapacityByType: Record<
      SupportedVehicleType,
      { totalSlots: number; operationalSlots: number; isOffered: boolean }
    > = {
      Car: { totalSlots: 0, operationalSlots: 0, isOffered: false },
      SUV: { totalSlots: 0, operationalSlots: 0, isOffered: false },
      Bike: { totalSlots: 0, operationalSlots: 0, isOffered: false },
      EV: { totalSlots: 0, operationalSlots: 0, isOffered: false },
    };

    for (const item of vehicleTypeAgg) {
      const vt = item._id as SupportedVehicleType;
      if (vt in vehicleCapacityByType) {
        vehicleCapacityByType[vt] = {
          totalSlots: item.totalSlots,
          operationalSlots: item.operationalSlots,
          isOffered: item.operationalSlots > 0,
        };
      }
    }

    // Default time window if not provided: starting in 15 mins (rounded to next 15 min mark), duration 2 hours
    const now = new Date();
    let defaultStart = new Date(
      Math.ceil((now.getTime() + 15 * 60 * 1000) / (15 * 60 * 1000)) * (15 * 60 * 1000),
    );
    const minHours = pricing.minParkingDurationHours || 1;
    const defaultDurationMs = Math.max(2, minHours) * 60 * 60 * 1000;

    if (!operating.isOpen24x7 && /^([01]\d|2[0-3]):([0-5]\d)$/.test(operating.openingTime) && /^([01]\d|2[0-3]):([0-5]\d)$/.test(operating.closingTime)) {
      const [oH, oM] = operating.openingTime.split(':').map(Number);
      const [cH, cM] = operating.closingTime.split(':').map(Number);
      const oMins = (oH || 0) * 60 + (oM || 0);
      const cMins = (cH || 0) * 60 + (cM || 0);
      if (oMins < cMins) {
        const todayOpen = new Date(defaultStart);
        todayOpen.setHours(oH || 0, oM || 0, 0, 0);
        const todayClose = new Date(defaultStart);
        todayClose.setHours(cH || 0, cM || 0, 0, 0);
        if (defaultStart.getTime() < todayOpen.getTime()) {
          defaultStart = todayOpen;
        } else if (defaultStart.getTime() + defaultDurationMs > todayClose.getTime()) {
          const tomorrowOpen = new Date(todayOpen);
          tomorrowOpen.setDate(tomorrowOpen.getDate() + 1);
          defaultStart = tomorrowOpen;
        }
      }
    }

    const defaultEnd = new Date(defaultStart.getTime() + defaultDurationMs);

    let requestedVehicleType: SupportedVehicleType = params.vehicleType || 'Car';
    if (!params.vehicleType && !vehicleCapacityByType[requestedVehicleType].isOffered) {
      const firstOffered = (['Car', 'SUV', 'Bike', 'EV'] as const).find(
        (vt) => vehicleCapacityByType[vt].isOffered,
      );
      if (firstOffered) {
        requestedVehicleType = firstOffered;
      }
    }
    const rawEntry = params.scheduledEntryTime || defaultStart.toISOString();
    const rawExit = params.scheduledExitTime || defaultEnd.toISOString();

    const platformBookingFee = await adminSettingsService.getPlatformBookingFee();
    const { entryDate, exitDate, breakdown } = this.calculatePriceAndValidatePeriod({
      vehicleType: requestedVehicleType,
      scheduledEntryTime: rawEntry,
      scheduledExitTime: rawExit,
      pricing,
      operating,
      platformBookingFee,
      allowNearPresentBuffer: true,
    });

    // Determine target floor
    const targetFloor =
      (params.floorId && eligibleFloors.find((f) => f._id.toString() === params.floorId)) ||
      eligibleFloors[0]!;

    const targetLayout = publishedLayouts.find(
      (l) => l.floorId.toString() === targetFloor._id.toString(),
    );

    if (!targetLayout) {
      throw new AppError('Published layout for the selected floor was not found.', 404, 'LAYOUT_NOT_FOUND');
    }

    // Fetch official zones for this floor
    const zones = await (ParkingZoneModel as mongoose.Model<ParkingZone>)
      .find({
        parkingLotId: lotObjectId,
        floorId: targetFloor._id,
      })
      .sort({ zoneCode: 1 })
      .lean()
      .exec();

    const zoneMap = new Map(zones.map((z) => [z._id.toString(), z]));

    // Fetch official slots for this floor
    const floorSlots = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .find({
        parkingLotId: lotObjectId,
        floorId: targetFloor._id,
      })
      .sort({ slotNumber: 1 })
      .lean()
      .exec();

    const slotObjectIds = floorSlots.map((s) => s._id as mongoose.Types.ObjectId);
    const [conflictMap, activeFloorBookings] = await Promise.all([
      this.findConflictingSlotMap({
        parkingLotId: lotObjectId,
        slotIds: slotObjectIds,
        entryDate,
        exitDate,
      }),
      (BookingModel as mongoose.Model<Booking>)
        .find({
          parkingLotId: lotObjectId,
          currentSlotId: { $in: slotObjectIds },
          bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
        })
        .select('currentSlotId scheduledExitTime actualEntryTime bookingStatus')
        .sort({ scheduledExitTime: -1 })
        .lean()
        .exec(),
    ]);

    const slotBookingMap = new Map<string, { scheduledExitTime: Date; bookingStatus: string }>();
    for (const b of activeFloorBookings) {
      const sId = b.currentSlotId.toString();
      if (!slotBookingMap.has(sId) || b.bookingStatus === 'Active' || b.bookingStatus === 'Overstay') {
        slotBookingMap.set(sId, { scheduledExitTime: b.scheduledExitTime, bookingStatus: b.bookingStatus });
      }
    }

    // Evaluate overlaps with present moment to know if physical Occupied/Reserved status applies
    const isNearPresentWindow = entryDate.getTime() <= Date.now() + 30 * 60 * 1000;

    let availableCount = 0;
    let reservedCount = 0;
    let occupiedCount = 0;
    let maintenanceCount = 0;
    let compatibleAvailableCount = 0;

    // Count regular compatible available slots across the floor to evaluate Rule 1 (regular first) vs Rule 2 (overflow fallback)
    const regularCompatibleAvailableCountOnFloor = floorSlots.filter((slot) => {
      const isSlotOverflow = Boolean(slot.isOverflow);
      if (isSlotOverflow) return false;
      const slotIdStr = slot._id.toString();
      const zone = zoneMap.get(slot.zoneId.toString());
      const zoneClosed = zone && zone.zoneStatus !== 'Active';
      if (slot.slotStatus === 'Under Maintenance' || zoneClosed) return false;
      if (conflictMap.has(slotIdStr)) return false;
      if (
        isNearPresentWindow &&
        (slot.slotStatus === 'Occupied' ||
          (slot.slotStatus === 'Reserved' && !slot.currentBookingId))
      ) {
        return false;
      }
      return slot.supportedVehicleType === requestedVehicleType;
    }).length;

    const evaluatedSlots: CustomerBookingSlotInfo[] = floorSlots.map((slot) => {
      const slotIdStr = slot._id.toString();
      const zone = zoneMap.get(slot.zoneId.toString());
      const zoneClosed = zone && zone.zoneStatus !== 'Active';
      const isSlotOverflow = Boolean(slot.isOverflow);

      let effectiveStatus: EffectiveSlotStatus = 'Available';
      let ineligibilityReason: string | null = null;

      if (slot.slotStatus === 'Under Maintenance' || zoneClosed) {
        effectiveStatus = 'Under Maintenance';
        ineligibilityReason = zoneClosed
          ? `Zone ${zone?.zoneCode || ''} is currently under maintenance or closed.`
          : 'This slot is currently under maintenance.';
      } else if (conflictMap.has(slotIdStr)) {
        const conflictStatus = conflictMap.get(slotIdStr)!;
        effectiveStatus = conflictStatus;
        ineligibilityReason =
          conflictStatus === 'Occupied'
            ? 'Currently occupied by an active vehicle during your requested time.'
            : 'Already reserved by another customer for this time window.';
      } else if (isNearPresentWindow && slot.slotStatus === 'Occupied') {
        effectiveStatus = 'Occupied';
        ineligibilityReason = 'Currently occupied by a vehicle on-site.';
      } else if (isNearPresentWindow && slot.slotStatus === 'Reserved' && !slot.currentBookingId) {
        effectiveStatus = 'Reserved';
        ineligibilityReason = 'Reserved for an upcoming arrival.';
      }

      // Calculate expected availability countdown for occupied and reserved bays
      let expectedAvailableAt: string | null = null;
      let expectedAvailableMinutes: number | null = null;
      const slotBooking = slotBookingMap.get(slotIdStr);

      if (
        (effectiveStatus === 'Occupied' || effectiveStatus === 'Reserved') &&
        slotBooking?.scheduledExitTime
      ) {
        // Expected availability = scheduledExitTime + 15m grace period
        const targetExit = new Date(
          new Date(slotBooking.scheduledExitTime).getTime() + 15 * 60 * 1000,
        );
        expectedAvailableAt = targetExit.toISOString();
        const diffMs = targetExit.getTime() - Date.now();
        expectedAvailableMinutes = Math.max(1, Math.ceil(diffMs / (60 * 1000)));
      }

      const isVehicleCompatible = this.isSlotCompatibleWithVehicle(
        slot.supportedVehicleType,
        requestedVehicleType,
        isSlotOverflow,
      );

      if (effectiveStatus === 'Available') {
        if (isSlotOverflow) {
          ineligibilityReason =
            'Overflow bays are frozen for customer bookings. Strictly reserved for system overstay reassignments and authorized security staff.';
        } else if (!isVehicleCompatible) {
          ineligibilityReason = `Designed for ${slot.supportedVehicleType} vehicles (selected: ${requestedVehicleType}).`;
        }
      }

      const isEligible =
        effectiveStatus === 'Available' &&
        isVehicleCompatible &&
        !isSlotOverflow;

      if (effectiveStatus === 'Available') {
        availableCount++;
        if (isVehicleCompatible) compatibleAvailableCount++;
      } else if (effectiveStatus === 'Reserved') {
        reservedCount++;
      } else if (effectiveStatus === 'Occupied') {
        occupiedCount++;
      } else if (effectiveStatus === 'Under Maintenance') {
        maintenanceCount++;
      }

      return {
        _id: slotIdStr,
        slotNumber: slot.slotNumber,
        slotLabel: slot.slotLabel,
        slotType: slot.slotType,
        supportedVehicleType: slot.supportedVehicleType as SupportedVehicleType,
        floorId: targetFloor._id.toString(),
        floorName: targetFloor.floorName,
        floorNumber: targetFloor.floorNumber,
        zoneId: slot.zoneId.toString(),
        zoneCode: zone?.zoneCode || 'A',
        zoneName: zone?.zoneName || 'Standard Zone',
        physicalStatus: slot.slotStatus,
        effectiveStatus,
        isVehicleCompatible,
        isEligible,
        isOverflow: isSlotOverflow,
        ineligibilityReason,
        expectedAvailableAt,
        expectedAvailableMinutes,
      };
    });

    const slotByIdMap = new Map(evaluatedSlots.map((s) => [s._id, s]));
    const slotByNumberMap = new Map(evaluatedSlots.map((s) => [s.slotNumber, s]));

    // Enrich layout elements with live slot metadata so the 2D canvas renders accurate statuses
    const enrichedElements = (targetLayout.elements || []).map((el) => {
      const plainEl =
        typeof (el as unknown as { toObject?: () => Record<string, unknown> }).toObject === 'function'
          ? (el as unknown as { toObject: () => Record<string, unknown> }).toObject()
          : { ...(el as unknown as Record<string, unknown>) };

      if (plainEl.elementType === 'ParkingSlot') {
        const slotIdKey = typeof plainEl.slotId === 'string' || typeof plainEl.slotId === 'object' ? String(plainEl.slotId) : '';
        const slotNumberKey = typeof plainEl.slotNumber === 'string' ? plainEl.slotNumber : '';
        const matchedSlot =
          (slotIdKey ? slotByIdMap.get(slotIdKey) : undefined) ??
          (slotNumberKey ? slotByNumberMap.get(slotNumberKey) : undefined);

        if (matchedSlot) {
          return {
            ...plainEl,
            slotId: matchedSlot._id,
            slotNumber: matchedSlot.slotNumber,
            zoneId: matchedSlot.zoneId,
            zoneCode: matchedSlot.zoneCode,
            zoneName: matchedSlot.zoneName,
            slotType: matchedSlot.slotType,
            supportedVehicleType: matchedSlot.supportedVehicleType,
            effectiveStatus: matchedSlot.effectiveStatus,
            isVehicleCompatible: matchedSlot.isVehicleCompatible,
            isEligible: matchedSlot.isEligible,
            isOverflow: Boolean(matchedSlot.isOverflow || plainEl.isOverflow),
            ineligibilityReason: matchedSlot.ineligibilityReason,
            expectedAvailableAt: matchedSlot.expectedAvailableAt,
            expectedAvailableMinutes: matchedSlot.expectedAvailableMinutes,
          };
        }
      }

      return plainEl;
    });

    return {
      facility: {
        _id: (lot._id as mongoose.Types.ObjectId).toString(),
        parkingName: lot.parkingName,
        address: lot.address,
        city: lot.city,
        state: lot.state,
        postalCode: lot.postalCode,
        hourlyRate: lot.hourlyRate,
        gracePeriodMinutes: pricing.gracePeriodMinutes,
        openingTime: operating.openingTime,
        closingTime: operating.closingTime,
        isOpen24Hours: operating.isOpen24x7,
        pricing,
        vehicleCapacityByType,
      },
      floors: eligibleFloors.map((f) => ({
        _id: f._id.toString(),
        floorName: f.floorName,
        floorNumber: f.floorNumber,
        floorStatus: f.floorStatus,
        totalSlots: f.totalSlots,
      })),
      activeFloor: {
        floor: {
          _id: targetFloor._id.toString(),
          floorName: targetFloor.floorName,
          floorNumber: targetFloor.floorNumber,
          floorStatus: targetFloor.floorStatus,
          totalSlots: targetFloor.totalSlots,
        },
        zones: zones.map((z) => ({
          _id: z._id.toString(),
          zoneCode: z.zoneCode,
          zoneName: z.zoneName,
          vehicleType: z.vehicleType ?? null,
          zoneStatus: z.zoneStatus,
          totalSlots: z.totalSlots,
        })),
        layout: {
          _id: targetLayout._id.toString(),
          version: targetLayout.version,
          canvasConfig: {
            width: targetLayout.canvasConfig?.width || 1600,
            height: targetLayout.canvasConfig?.height || 1000,
            gridSize: targetLayout.canvasConfig?.gridSize || 20,
            snapToGrid: targetLayout.canvasConfig?.snapToGrid ?? true,
            backgroundColor: targetLayout.canvasConfig?.backgroundColor || '#0f172a',
          },
          elements: enrichedElements,
        },
        slots: evaluatedSlots,
        slotSummary: {
          totalSlots: evaluatedSlots.length,
          availableCount,
          reservedCount,
          occupiedCount,
          maintenanceCount,
          compatibleAvailableCount,
        },
      },
      priceBreakdown: breakdown,
    };
  }

  /**
   * Retrieves customer's active registered vehicles, enriched with active booking status
   */
  public async getCustomerVehicles(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Unauthorized user.', 401, 'UNAUTHORIZED');
    }

    const vehicles = await (VehicleModel as mongoose.Model<Vehicle>)
      .find({
        customerId: new mongoose.Types.ObjectId(userId),
        vehicleStatus: 'Active',
      })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean()
      .exec();

    if (vehicles.length === 0) {
      return [];
    }

    const vehicleIds = vehicles.map((v) => v._id);
    const activeBookings = await (BookingModel as mongoose.Model<Booking>)
      .find({
        vehicleId: { $in: vehicleIds },
        bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
      })
      .select('bookingReference vehicleId bookingStatus scheduledEntryTime scheduledExitTime')
      .lean()
      .exec();

    const activeMap = new Map<string, { bookingId: string; bookingReference: string; bookingStatus: string }>();
    for (const b of activeBookings) {
      activeMap.set(b.vehicleId.toString(), {
        bookingId: b._id.toString(),
        bookingReference: b.bookingReference,
        bookingStatus: b.bookingStatus,
      });
    }

    return vehicles.map((v) => {
      const active = activeMap.get(v._id.toString());
      return {
        ...v,
        hasActiveBooking: Boolean(active),
        activeBookingId: active?.bookingId ?? null,
        activeBookingReference: active?.bookingReference ?? null,
        activeBookingStatus: active?.bookingStatus ?? null,
      };
    });
  }

  /**
   * Registers a new vehicle for the authenticated customer
   */
  public async addCustomerVehicle(
    userId: string,
    input: {
      vehicleNumber: string;
      vehicleType: SupportedVehicleType;
      vehicleBrand: string;
      vehicleModel: string;
      vehicleColor?: string | undefined;
      fuelType?: 'Petrol' | 'Diesel' | 'CNG' | 'Electric' | 'Hybrid' | undefined;
    },
  ) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Unauthorized user.', 401, 'UNAUTHORIZED');
    }

    const normalizedNumber = input.vehicleNumber.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(normalizedNumber)) {
      throw new AppError(
        'Invalid Indian vehicle registration number format (e.g. GJ05AB1234).',
        400,
        'INVALID_VEHICLE_NUMBER',
      );
    }

    const existing = await (VehicleModel as mongoose.Model<Vehicle>)
      .findOne({ vehicleNumber: normalizedNumber })
      .lean()
      .exec();

    if (existing) {
      if (existing.customerId.toString() === userId) {
        const activeBooking = await (BookingModel as mongoose.Model<Booking>)
          .findOne({
            vehicleId: existing._id,
            bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
          })
          .select('bookingReference bookingStatus')
          .lean()
          .exec();

        return {
          ...existing,
          hasActiveBooking: Boolean(activeBooking),
          activeBookingReference: activeBooking?.bookingReference ?? null,
          activeBookingStatus: activeBooking?.bookingStatus ?? null,
        };
      }
      throw new AppError(
        'A vehicle with this registration number is already registered.',
        409,
        'VEHICLE_ALREADY_EXISTS',
      );
    }

    const count = await (VehicleModel as mongoose.Model<Vehicle>)
      .countDocuments({
        customerId: new mongoose.Types.ObjectId(userId),
        vehicleStatus: 'Active',
      });

    const created = await (VehicleModel as mongoose.Model<Vehicle>).create({
      customerId: new mongoose.Types.ObjectId(userId),
      vehicleNumber: normalizedNumber,
      vehicleType: input.vehicleType,
      vehicleBrand: input.vehicleBrand.trim() || 'Standard',
      vehicleModel: input.vehicleModel.trim() || 'Model',
      vehicleColor: input.vehicleColor?.trim() || null,
      fuelType: input.fuelType || (input.vehicleType === 'EV' ? 'Electric' : 'Petrol'),
      isDefault: count === 0,
      rcVerified: false,
      vehicleStatus: 'Active',
    });

    return {
      ...created.toObject(),
      hasActiveBooking: false,
      activeBookingReference: null,
      activeBookingStatus: null,
    };
  }

  /**
   * Validates a specific slot for the requested time window and vehicle type
   */
  public async validateSlotEligibility(params: {
    parkingLotId: string;
    slotId: string;
    vehicleType: SupportedVehicleType;
    scheduledEntryTime: string;
    scheduledExitTime: string;
    excludeBookingId?: mongoose.Types.ObjectId | undefined;
  }) {
    const lot = await this.verifyEligibleFacility(params.parkingLotId);
    const { pricing, operating } = await this.resolveFacilityPricing(lot);

    if (!mongoose.Types.ObjectId.isValid(params.slotId)) {
      throw new AppError('Invalid parking slot ID.', 400, 'INVALID_SLOT_ID');
    }

    const platformBookingFee = await adminSettingsService.getPlatformBookingFee();
    const { entryDate, exitDate, breakdown } = this.calculatePriceAndValidatePeriod({
      vehicleType: params.vehicleType,
      scheduledEntryTime: params.scheduledEntryTime,
      scheduledExitTime: params.scheduledExitTime,
      pricing,
      operating,
      platformBookingFee,
    });

    const operationalVehicleSlotsCount = await (
      ParkingSlotModel as mongoose.Model<ParkingSlot>
    ).countDocuments({
      parkingLotId: lot._id,
      supportedVehicleType: params.vehicleType,
      slotStatus: { $ne: 'Under Maintenance' },
    });

    const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .findOne({
        _id: new mongoose.Types.ObjectId(params.slotId),
        parkingLotId: lot._id,
      })
      .lean()
      .exec();

    if (!slot) {
      throw new AppError(
        'Selected parking slot does not belong to this facility.',
        404,
        'SLOT_NOT_FOUND',
      );
    }

    if (operationalVehicleSlotsCount === 0 && slot.supportedVehicleType !== params.vehicleType) {
      throw new AppError(
        `${params.vehicleType} parking is not offered or has no operational bays at this facility.`,
        400,
        'VEHICLE_TYPE_NOT_OFFERED',
      );
    }

    const floor = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
      .findOne({
        _id: slot.floorId,
        parkingLotId: lot._id,
      })
      .lean()
      .exec();

    if (!floor || floor.floorStatus !== 'Active') {
      throw new AppError(
        'The floor for this parking slot is not active.',
        400,
        'FLOOR_NOT_ACTIVE',
      );
    }

    const zone = await (ParkingZoneModel as mongoose.Model<ParkingZone>)
      .findOne({
        _id: slot.zoneId,
        parkingLotId: lot._id,
      })
      .lean()
      .exec();

    if (!zone || zone.zoneStatus !== 'Active') {
      throw new AppError(
        'The zone for this parking slot is currently closed or under maintenance.',
        400,
        'ZONE_NOT_ACTIVE',
      );
    }

    // Verify published layout exists for this floor and contains this slot
    const publishedLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({
        parkingLotId: lot._id,
        floorId: floor._id,
        isPublished: true,
        status: 'Published',
      })
      .lean()
      .exec();

    if (!publishedLayout) {
      throw new AppError(
        'No published layout exists for the selected floor.',
        400,
        'FLOOR_LAYOUT_NOT_PUBLISHED',
      );
    }

    const isPlacedInPublishedLayout = (publishedLayout.elements || []).some(
      (el) =>
        el.elementType === 'ParkingSlot' &&
        ((el.slotId && el.slotId.toString() === slot._id.toString()) ||
          el.slotNumber === slot.slotNumber),
    );

    if (!isPlacedInPublishedLayout) {
      throw new AppError(
        'Selected slot is not placed in the facility’s published 2D floor plan.',
        400,
        'SLOT_NOT_IN_PUBLISHED_LAYOUT',
      );
    }

    if (slot.slotStatus === 'Under Maintenance') {
      throw new AppError(
        `Slot ${slot.slotNumber} is currently under maintenance and cannot be booked.`,
        409,
        'SLOT_UNDER_MAINTENANCE',
      );
    }

    const isOverflowSlot = Boolean(slot.isOverflow);

    if (!this.isSlotCompatibleWithVehicle(slot.supportedVehicleType, params.vehicleType, isOverflowSlot)) {
      throw new AppError(
        `Slot ${slot.slotNumber} is designated for ${slot.supportedVehicleType} vehicles and is not compatible with ${params.vehicleType}.`,
        400,
        'INCOMPATIBLE_VEHICLE_TYPE',
      );
    }

    if (isOverflowSlot) {
      throw new AppError(
        `Slot ${slot.slotNumber} is designated as an Overflow bay and is frozen for direct customer bookings. Overflow bays cannot be booked online and are strictly reserved for automatic system overstay reassignments and authorized security staff.`,
        400,
        'OVERFLOW_SLOT_NOT_BOOKABLE_BY_CUSTOMER',
      );
    }

    const conflictMap = await this.findConflictingSlotMap({
      parkingLotId: lot._id as mongoose.Types.ObjectId,
      slotIds: [slot._id as mongoose.Types.ObjectId],
      entryDate,
      exitDate,
      excludeBookingId: params.excludeBookingId,
    });

    if (conflictMap.has(slot._id.toString())) {
      throw new AppError(
        `Slot ${slot.slotNumber} is already reserved or occupied during your selected time window.`,
        409,
        'SLOT_TIME_CONFLICT',
      );
    }

    const isNearPresentWindow = entryDate.getTime() <= Date.now() + 30 * 60 * 1000;
    if (
      isNearPresentWindow &&
      (slot.slotStatus === 'Occupied' ||
        (slot.slotStatus === 'Reserved' && !slot.currentBookingId))
    ) {
      throw new AppError(
        `Slot ${slot.slotNumber} is currently ${slot.slotStatus.toLowerCase()} and unavailable for immediate entry.`,
        409,
        'SLOT_CURRENTLY_UNAVAILABLE',
      );
    }

    return {
      isEligible: true,
      lot,
      floor,
      zone,
      slot,
      entryDate,
      exitDate,
      breakdown,
    };
  }

  /**
   * Step 1 of Checkout:
   * Validates eligibility, creates a 'Pending Payment' Booking, initiates a Razorpay Order,
   * and creates a 'PENDING' Payment record.
   */
  public async initiateBookingPayment(
    input: InitiateBookingPaymentInput,
  ): Promise<InitiateBookingPaymentResponse> {
    if (!mongoose.Types.ObjectId.isValid(input.userId)) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    if (!mongoose.Types.ObjectId.isValid(input.vehicleId)) {
      throw new AppError('Please select a valid vehicle for this booking.', 400, 'INVALID_VEHICLE');
    }

    const user = await (UserModel as mongoose.Model<User>)
      .findById(input.userId)
      .lean()
      .exec();

    if (!user || user.accountStatus !== 'Active') {
      throw new AppError('Customer account is not active.', 403, 'ACCOUNT_NOT_ACTIVE');
    }

    const vehicle = await (VehicleModel as mongoose.Model<Vehicle>)
      .findOne({
        _id: new mongoose.Types.ObjectId(input.vehicleId),
        customerId: user._id,
        vehicleStatus: 'Active',
      })
      .lean()
      .exec();

    if (!vehicle) {
      throw new AppError(
        'Selected vehicle was not found or does not belong to your account.',
        404,
        'VEHICLE_NOT_FOUND',
      );
    }

    // Enforce 1 active booking per vehicle rule:
    // A vehicle cannot book a slot if it currently has an active booking (Confirmed, Active, Overstay)
    const existingActiveBooking = await (BookingModel as mongoose.Model<Booking>)
      .findOne({
        vehicleId: vehicle._id,
        bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
      })
      .lean()
      .exec();

    if (existingActiveBooking) {
      throw new AppError(
        `Vehicle ${vehicle.vehicleNumber} already has an active booking (${existingActiveBooking.bookingReference}) with status "${existingActiveBooking.bookingStatus}". Only one active booking is allowed per vehicle. Please complete or exit the existing booking before booking again.`,
        400,
        'VEHICLE_HAS_ACTIVE_BOOKING',
      );
    }

    // Clean up any stale unfulfilled 'Pending Payment' bookings for this vehicle
    await (BookingModel as mongoose.Model<Booking>).updateMany(
      {
        vehicleId: vehicle._id,
        bookingStatus: 'Pending Payment',
      },
      {
        $set: { bookingStatus: 'Cancelled' },
      },
    );

    const vehicleType = vehicle.vehicleType as SupportedVehicleType;

    // Perform full backend eligibility & conflict validation
    const validated = await this.validateSlotEligibility({
      parkingLotId: input.parkingLotId,
      slotId: input.slotId,
      vehicleType,
      scheduledEntryTime: input.scheduledEntryTime,
      scheduledExitTime: input.scheduledExitTime,
    });

    const bookingReference = this.generateBookingReference();
    const gracePeriodMinutes = validated.breakdown.gracePeriodMinutes;
    const gracePeriodEndsAt = new Date(
      validated.entryDate.getTime() + gracePeriodMinutes * 60 * 1000,
    );

    const amount = validated.breakdown.totalAmount;
    const amountPaise = Math.round(amount * 100);

    // Create Razorpay Order via existing RazorpayService
    const order = await razorpayService.createOrder({
      amountPaise,
      currency: 'INR',
      receipt: bookingReference,
      notes: {
        bookingReference,
        parkingLotId: validated.lot._id.toString(),
        slotNumber: validated.slot.slotNumber,
        customerId: user._id.toString(),
        vehicleNumber: vehicle.vehicleNumber,
      },
    });

    // Create Pending Payment Booking record
    const booking = await (BookingModel as mongoose.Model<Booking>).create({
      bookingReference,
      customerId: user._id,
      vehicleId: vehicle._id,
      parkingLotId: validated.lot._id,
      floorId: validated.floor._id,
      zoneId: validated.zone._id,
      originalSlotId: validated.slot._id,
      currentSlotId: validated.slot._id,
      bookingType: 'ONLINE',
      bookingStatus: 'Pending Payment',
      scheduledEntryTime: validated.entryDate,
      scheduledExitTime: validated.exitDate,
      gracePeriodMinutes,
      gracePeriodEndsAt,
      bookingDurationMinutes: validated.breakdown.bookingDurationMinutes,
      parkingRateAtBooking: validated.breakdown.hourlyRate,
      overstayRateAtBooking: validated.breakdown.overstayRateAtBooking,
      baseAmount: validated.breakdown.baseAmount,
      platformBookingFee: validated.breakdown.platformBookingFee ?? 0,
      additionalCharges: validated.breakdown.additionalCharges,
      totalAmount: amount,
    });

    // Create centralized PENDING Payment record
    const paymentReference = this.generatePaymentReference();
    await (PaymentModel as mongoose.Model<Payment>).create({
      paymentReference,
      bookingId: booking._id,
      customerId: user._id,
      ownerId: validated.lot.ownerId,
      parkingLotId: validated.lot._id,
      paymentType: 'Parking Booking',
      paymentTypeCode: 'BOOKING',
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'PENDING',
      gatewayOrderId: order.id,
      amount,
      platformBookingFee: validated.breakdown.platformBookingFee ?? 0,
      additionalCharges: 0,
      refundAmount: 0,
      remarks: `Online slot reservation for ${validated.lot.parkingName} — Slot ${validated.slot.slotNumber}`,
    });

    // Record BookingTimeline event: BOOKING_CREATED
    await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create({
      bookingId: booking._id,
      performedBy: user._id,
      eventCode: 'BOOKING_CREATED',
      eventType: 'Booking Created',
      eventTitle: 'Booking Initiated (Pending Payment)',
      eventDescription: `Reservation ${bookingReference} created for Slot ${validated.slot.slotNumber} (${vehicle.vehicleNumber}). Awaiting payment confirmation.`,
      eventSource: 'Customer',
      metadata: {
        slotNumber: validated.slot.slotNumber,
        floorName: validated.floor.floorName,
        zoneCode: validated.zone.zoneCode,
        totalAmount: amount,
        gatewayOrderId: order.id,
      },
    });

    return {
      bookingId: booking._id.toString(),
      bookingReference,
      paymentReference,
      orderId: order.id,
      amount,
      amountPaise,
      currency: order.currency || 'INR',
      keyId: env.RAZORPAY_KEY_ID,
      customer: {
        name: user.fullName,
        email: user.email,
        contact: user.mobileNumber,
      },
      summary: {
        facilityName: validated.lot.parkingName,
        floorName: validated.floor.floorName,
        zoneCode: validated.zone.zoneCode,
        slotNumber: validated.slot.slotNumber,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.vehicleType,
        scheduledEntryTime: validated.entryDate.toISOString(),
        scheduledExitTime: validated.exitDate.toISOString(),
        bookingDurationMinutes: validated.breakdown.bookingDurationMinutes,
        totalAmount: amount,
      },
    };
  }

  /**
   * Step 2 of Checkout:
   * Cryptographically verifies Razorpay signature, executes an atomic MongoDB transaction
   * to re-validate slot availability and prevent race conditions, confirms the booking,
   * or initiates an automatic full refund if a concurrent booking claimed the slot.
   */
  public async verifyPaymentAndConfirmBooking(
    input: VerifyBookingPaymentInput,
    ipAddress?: string,
  ): Promise<VerifyBookingPaymentResponse> {
    if (!mongoose.Types.ObjectId.isValid(input.bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const booking = await (BookingModel as mongoose.Model<Booking>)
      .findOne({
        _id: new mongoose.Types.ObjectId(input.bookingId),
        customerId: new mongoose.Types.ObjectId(input.userId),
      })
      .exec();

    if (!booking) {
      throw new AppError('Booking record not found.', 404, 'BOOKING_NOT_FOUND');
    }

    const payment = await (PaymentModel as mongoose.Model<Payment>)
      .findOne({
        bookingId: booking._id,
        gatewayOrderId: input.razorpay_order_id,
      })
      .exec();

    if (!payment) {
      throw new AppError(
        'Matching payment order record was not found for this booking.',
        404,
        'PAYMENT_ORDER_NOT_FOUND',
      );
    }

    // Load associated entities for response details
    const [lot, floor, zone, slot, vehicle, customer] = await Promise.all([
      (ParkingLotModel as mongoose.Model<ParkingLot>).findById(booking.parkingLotId).lean().exec(),
      (ParkingFloorModel as mongoose.Model<ParkingFloor>).findById(booking.floorId).lean().exec(),
      (ParkingZoneModel as mongoose.Model<ParkingZone>).findById(booking.zoneId).lean().exec(),
      (ParkingSlotModel as mongoose.Model<ParkingSlot>).findById(booking.currentSlotId).lean().exec(),
      (VehicleModel as mongoose.Model<Vehicle>).findById(booking.vehicleId).lean().exec(),
      (UserModel as mongoose.Model<User>).findById(booking.customerId).lean().exec(),
    ]);

    if (!lot || !floor || !zone || !slot || !vehicle) {
      throw new AppError('Associated facility or slot records are missing.', 404, 'RECORDS_MISSING');
    }

    const customerDetails = {
      fullName: customer?.fullName || 'ParkEase Customer',
      email: customer?.email || '',
      mobileNumber: customer?.mobileNumber || '',
    };

    const fullAddress = [lot.address, lot.city, lot.state, lot.postalCode]
      .filter(Boolean)
      .join(', ');

    // Idempotency handling: if already confirmed with this payment, return existing confirmation
    if (booking.bookingStatus === 'Confirmed' && payment.paymentStatus === 'SUCCESSFUL') {
      return {
        bookingStatus: 'Confirmed',
        bookingReference: booking.bookingReference,
        bookingId: booking._id.toString(),
        qrCode: booking.qrCode ?? null,
        paymentReference: payment.paymentReference,
        paymentStatus: 'SUCCESSFUL',
        transactionId: payment.transactionId ?? null,
        message: 'Booking is already confirmed.',
        customerDetails,
        paymentDetails: {
          paymentReference: payment.paymentReference,
          paymentMethod: payment.paymentMethod || 'Razorpay',
          paymentStatus: 'SUCCESSFUL',
          paymentDate: (payment.paymentDate || new Date()).toISOString(),
          razorpayOrderId: payment.gatewayOrderId || input.razorpay_order_id,
          razorpayPaymentId: payment.gatewayPaymentId || input.razorpay_payment_id,
          paymentVerificationReference: payment.transactionId || payment.paymentReference,
        },
        bookingDetails: {
          facilityName: lot.parkingName,
          address: fullAddress,
          floorName: floor.floorName,
          zoneName: zone.zoneName,
          zoneCode: zone.zoneCode,
          slotNumber: slot.slotNumber,
          slotLabel: slot.slotLabel,
          vehicleNumber: vehicle.vehicleNumber,
          vehicleType: vehicle.vehicleType,
          vehicleBrand: vehicle.vehicleBrand ?? null,
          vehicleModel: vehicle.vehicleModel ?? null,
          bookingType: booking.bookingType || 'ONLINE',
          scheduledEntryTime: booking.scheduledEntryTime.toISOString(),
          scheduledExitTime: booking.scheduledExitTime.toISOString(),
          gracePeriodMinutes: booking.gracePeriodMinutes,
          bookingDurationMinutes: booking.bookingDurationMinutes,
          baseAmount: booking.baseAmount,
          platformBookingFee: booking.platformBookingFee ?? 0,
          taxes: 0,
          discountAmount: 0,
          additionalCharges: booking.additionalCharges,
          totalAmount: booking.totalAmount,
        },
      };
    }

    // 1. Verify Razorpay cryptographic HMAC-SHA256 signature
    const isSignatureValid = razorpayService.verifySignature({
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });

    if (!isSignatureValid) {
      payment.paymentStatus = 'FAILED';
      payment.remarks = 'Razorpay signature verification failed.';
      await payment.save();

      await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create({
        bookingId: booking._id,
        performedBy: new mongoose.Types.ObjectId(input.userId),
        eventCode: 'PAYMENT_FAILED',
        eventType: 'Payment Failed',
        eventTitle: 'Payment Verification Failed',
        eventDescription: 'Cryptographic signature verification failed for Razorpay transaction.',
        eventSource: 'System',
      });

      throw new AppError(
        'Payment signature verification failed. Booking could not be confirmed.',
        400,
        'PAYMENT_SIGNATURE_INVALID',
      );
    }

    const txnId = `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 2. Atomic MongoDB Session & Transaction for concurrency-safe slot revalidation and confirmation
    const session = await mongoose.startSession();
    let conflictDetected = false;
    let conflictReason = '';
    let generatedQrCode: string | null = null;

    try {
      await session.withTransaction(async () => {
        const freshLot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
          .findById(booking.parkingLotId)
          .session(session)
          .exec();

        const freshSlot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
          .findById(booking.currentSlotId)
          .session(session)
          .exec();

        const freshFloor = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
          .findById(booking.floorId)
          .session(session)
          .exec();

        const freshZone = await (ParkingZoneModel as mongoose.Model<ParkingZone>)
          .findById(booking.zoneId)
          .session(session)
          .exec();

        const isImmediatePhysicalWindow = this.isBookingInImmediatePhysicalWindow(
          booking.scheduledEntryTime,
          booking.scheduledExitTime,
          booking.gracePeriodMinutes || 15,
        );

        if (
          !freshLot ||
          freshLot.parkingStatus !== 'Active' ||
          !freshFloor ||
          freshFloor.floorStatus !== 'Active' ||
          !freshZone ||
          freshZone.zoneStatus !== 'Active' ||
          !freshSlot ||
          freshSlot.slotStatus === 'Under Maintenance' ||
          (isImmediatePhysicalWindow &&
            (freshSlot.slotStatus === 'Occupied' ||
              (freshSlot.slotStatus === 'Reserved' && !freshSlot.currentBookingId)))
        ) {
          conflictDetected = true;
          conflictReason = 'Slot or facility became unavailable during payment processing.';
        } else {
          // Check overlapping confirmed/active/overstay bookings for the same slot inside the transaction
          const overlapping = await (BookingModel as mongoose.Model<Booking>)
            .findOne({
              _id: { $ne: booking._id },
              parkingLotId: booking.parkingLotId,
              currentSlotId: booking.currentSlotId,
              bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
              scheduledEntryTime: { $lt: booking.scheduledExitTime },
              scheduledExitTime: { $gt: booking.scheduledEntryTime },
            })
            .session(session)
            .exec();

          if (overlapping) {
            conflictDetected = true;
            conflictReason = `Slot ${freshSlot.slotNumber} was just reserved by another customer for an overlapping period.`;
          } else {
            // Check if vehicle already has another active Confirmed/Active/Overstay booking
            const concurrentVehicleActive = await (BookingModel as mongoose.Model<Booking>)
              .findOne({
                _id: { $ne: booking._id },
                vehicleId: booking.vehicleId,
                bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
              })
              .session(session)
              .exec();

            if (concurrentVehicleActive) {
              conflictDetected = true;
              conflictReason = `Vehicle already has an active booking (${concurrentVehicleActive.bookingReference}). Only one active booking is permitted per vehicle.`;
            } else if (freshSlot.isOverflow) {
              const maxOverflowCap = freshLot.overflowCapacity ?? 0;
              if (maxOverflowCap <= 0) {
                conflictDetected = true;
                conflictReason = 'Overflow parking allocation is currently disabled for this facility.';
              } else {
                const overflowSlotsInLot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
                  .find({ parkingLotId: freshLot._id, isOverflow: true })
                  .select('_id')
                  .session(session)
                  .lean()
                  .exec();

                const overflowSlotIdList = overflowSlotsInLot.map((s) => s._id);
                const overlappingOverflowCount = await (BookingModel as mongoose.Model<Booking>)
                  .countDocuments({
                    _id: { $ne: booking._id },
                    parkingLotId: freshLot._id,
                    currentSlotId: { $in: overflowSlotIdList },
                    bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
                    scheduledEntryTime: { $lt: booking.scheduledExitTime },
                    scheduledExitTime: { $gt: booking.scheduledEntryTime },
                  })
                  .session(session)
                  .exec();

                if (overlappingOverflowCount >= maxOverflowCap) {
                  conflictDetected = true;
                  conflictReason = 'Overflow capacity threshold was reached during transaction processing.';
                }
              }
            }
          }
        }

        if (conflictDetected) {
          // Payment succeeded at gateway, but slot was taken concurrently -> Cancel & Refund
          const refundRef = `RFD-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
          const now = new Date();

          payment.paymentStatus = 'REFUNDED';
          payment.gatewayPaymentId = input.razorpay_payment_id;
          payment.gatewaySignature = input.razorpay_signature;
          payment.transactionId = txnId;
          payment.paymentDate = now;
          payment.refundAmount = payment.amount;
          payment.refundDate = now;
          payment.refunds.push({
            refundReference: refundRef,
            refundAmount: payment.amount,
            refundStatus: 'Refund Completed',
            refundReason: conflictReason,
            gatewayRefundId: `rfnd_sim_${crypto.randomBytes(4).toString('hex')}`,
            refundTransactionId: `RTXN-${Date.now()}`,
            initiatedAt: now,
            completedAt: now,
            initiatedBy: null,
            remarks: 'Automatic full refund due to concurrent slot conflict during payment confirmation.',
          });
          await payment.save({ session });

          booking.bookingStatus = 'Cancelled';
          booking.cancellationBy = 'System';
          booking.cancellationReason = conflictReason;
          booking.refundAmount = booking.totalAmount;
          await booking.save({ session });

          await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create(
            [
              {
                bookingId: booking._id,
                performedBy: new mongoose.Types.ObjectId(input.userId),
                eventCode: 'PAYMENT_SUCCESSFUL',
                eventType: 'Payment Successful',
                eventTitle: 'Payment Captured',
                eventDescription: `Payment of ₹${payment.amount} verified via Razorpay (${input.razorpay_payment_id}).`,
                eventSource: 'Customer',
              },
              {
                bookingId: booking._id,
                performedBy: null,
                eventCode: 'BOOKING_CANCELLED',
                eventType: 'Booking Cancelled',
                eventTitle: 'Cancelled Due to Concurrent Slot Conflict',
                eventDescription: conflictReason,
                eventSource: 'System',
              },
              {
                bookingId: booking._id,
                performedBy: null,
                eventCode: 'FULL_REFUND_COMPLETED',
                eventType: 'Full Refund Completed',
                eventTitle: 'Automatic Full Refund Processed',
                eventDescription: `Full refund of ₹${payment.amount} (${refundRef}) processed automatically.`,
                eventSource: 'System',
              },
            ],
            { session, ordered: true },
          );
          return;
        }

        // No conflict: Confirm Booking & Reserve Slot if applicable
        generatedQrCode = this.generateBookingQrCode(booking.bookingReference, slot.qrIdentifier);

        payment.paymentStatus = 'SUCCESSFUL';
        payment.gatewayPaymentId = input.razorpay_payment_id;
        payment.gatewaySignature = input.razorpay_signature;
        payment.transactionId = txnId;
        payment.paymentDate = new Date();
        await payment.save({ session });

        booking.bookingStatus = 'Confirmed';
        booking.qrCode = generatedQrCode;
        await booking.save({ session });

        // Only transition physical slot status to Reserved and update cached hierarchy counters
        // when the booking falls within the immediate physical arrival window.
        // Future-dated bookings remain discoverable through BookingModel time-overlap queries
        // without prematurely blocking the physical slot for immediate reservations today.
        if (isImmediatePhysicalWindow && freshSlot && freshSlot.slotStatus === 'Available') {
          freshSlot.slotStatus = 'Reserved';
          freshSlot.currentBookingId = booking._id as mongoose.Types.ObjectId;
          await freshSlot.save({ session });

          await this.reconcileHierarchyCounters({
            parkingLotId: booking.parkingLotId as mongoose.Types.ObjectId,
            floorId: booking.floorId as mongoose.Types.ObjectId,
            zoneId: booking.zoneId as mongoose.Types.ObjectId,
            session,
          });
        }

        await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create(
          [
            {
              bookingId: booking._id,
              performedBy: new mongoose.Types.ObjectId(input.userId),
              eventCode: 'PAYMENT_SUCCESSFUL',
              eventType: 'Payment Successful',
              eventTitle: 'Payment Verified',
              eventDescription: `Payment of ₹${payment.amount} verified (${payment.paymentReference}).`,
              eventSource: 'Customer',
              metadata: {
                paymentReference: payment.paymentReference,
                gatewayPaymentId: input.razorpay_payment_id,
                transactionId: txnId,
              },
            },
            {
              bookingId: booking._id,
              performedBy: null,
              eventCode: 'SLOT_RESERVED',
              eventType: 'Slot Reserved',
              eventTitle: `Slot ${slot.slotNumber} Reserved`,
              eventDescription: `Bay ${slot.slotNumber} on ${floor.floorName} (Zone ${zone.zoneCode}) locked for your arrival.`,
              eventSource: 'System',
            },
            {
              bookingId: booking._id,
              performedBy: null,
              eventCode: 'QR_GENERATED',
              eventType: 'QR Generated',
              eventTitle: 'Digital Entry QR Pass Generated',
              eventDescription: 'Cryptographic QR access token generated for barrier check-in.',
              eventSource: 'System',
            },
            {
              bookingId: booking._id,
              performedBy: null,
              eventCode: 'BOOKING_CONFIRMED',
              eventType: 'Booking Confirmed',
              eventTitle: 'Reservation Confirmed',
              eventDescription: `Booking ${booking.bookingReference} is confirmed.`,
              eventSource: 'System',
            },
          ],
          { session, ordered: true },
        );
      });
    } finally {
      await session.endSession();
    }

    if (conflictDetected) {
      // Send conflict & refund notification
      try {
        await notificationService.createNotification({
          userId: booking.customerId,
          bookingId: booking._id,
          paymentId: payment._id,
          notificationType: 'Refund',
          eventType: 'Full Refund Completed',
          title: 'Slot Unavailable — Full Refund Processed',
          message: `${conflictReason} Your payment of ₹${payment.amount} for ${booking.bookingReference} has been refunded in full.`,
          priority: 'High',
          actionUrl: `/customer/parking/${lot._id.toString()}/book`,
        });
      } catch {
        // Non-blocking notification
      }

      return {
        bookingStatus: 'Cancelled',
        bookingReference: booking.bookingReference,
        bookingId: booking._id.toString(),
        qrCode: null,
        paymentReference: payment.paymentReference,
        paymentStatus: 'REFUNDED',
        transactionId: txnId,
        conflictRefundInitiated: true,
        message: `${conflictReason} A full refund of ₹${payment.amount} has been automatically processed.`,
        customerDetails,
        paymentDetails: {
          paymentReference: payment.paymentReference,
          paymentMethod: payment.paymentMethod || 'Razorpay',
          paymentStatus: 'REFUNDED',
          paymentDate: (payment.paymentDate || new Date()).toISOString(),
          razorpayOrderId: payment.gatewayOrderId || input.razorpay_order_id,
          razorpayPaymentId: payment.gatewayPaymentId || input.razorpay_payment_id,
          paymentVerificationReference: txnId,
        },
        bookingDetails: {
          facilityName: lot.parkingName,
          address: fullAddress,
          floorName: floor.floorName,
          zoneName: zone.zoneName,
          zoneCode: zone.zoneCode,
          slotNumber: slot.slotNumber,
          slotLabel: slot.slotLabel,
          vehicleNumber: vehicle.vehicleNumber,
          vehicleType: vehicle.vehicleType,
          vehicleBrand: vehicle.vehicleBrand ?? null,
          vehicleModel: vehicle.vehicleModel ?? null,
          bookingType: booking.bookingType || 'ONLINE',
          scheduledEntryTime: booking.scheduledEntryTime.toISOString(),
          scheduledExitTime: booking.scheduledExitTime.toISOString(),
          gracePeriodMinutes: booking.gracePeriodMinutes,
          bookingDurationMinutes: booking.bookingDurationMinutes,
          parkingRateAtBooking: booking.parkingRateAtBooking,
          baseAmount: booking.baseAmount,
          platformBookingFee: booking.platformBookingFee ?? 0,
          taxes: 0,
          discountAmount: 0,
          additionalCharges: booking.additionalCharges,
          totalAmount: booking.totalAmount,
        },
      };
    }

    // Dispatch real-time notifications, confirmation email, & audit log on successful confirmation
    try {
      await notificationService.createNotification({
        userId: booking.customerId,
        bookingId: booking._id,
        paymentId: payment._id,
        notificationType: 'Booking',
        eventType: 'Booking Confirmed',
        title: `Booking Confirmed — ${booking.bookingReference}`,
        message: `Slot ${slot.slotNumber} (${floor.floorName}, Zone ${zone.zoneCode}) at ${lot.parkingName} is reserved for ${vehicle.vehicleNumber}.`,
        priority: 'Normal',
        actionUrl: `/customer/dashboard`,
      });

      if (customerDetails.email && generatedQrCode) {
        const confirmedQr: string = generatedQrCode;
        await emailService.sendBookingConfirmationEmail({
          to: customerDetails.email,
          customerName: customerDetails.fullName,
          customerEmail: customerDetails.email,
          customerMobile: customerDetails.mobileNumber,
          bookingId: booking._id as mongoose.Types.ObjectId,
          parkingLotId: booking.parkingLotId,
          bookingReference: booking.bookingReference,
          parkingName: lot.parkingName,
          parkingAddress: fullAddress,
          floorName: floor.floorName,
          zoneCode: zone.zoneCode,
          slotNumber: slot.slotNumber,
          vehicleNumber: vehicle.vehicleNumber,
          vehicleType: vehicle.vehicleType,
          vehicleBrand: vehicle.vehicleBrand ?? undefined,
          vehicleModel: vehicle.vehicleModel ?? undefined,
          bookingType: booking.bookingType || 'ONLINE',
          scheduledEntryTime: booking.scheduledEntryTime,
          scheduledExitTime: booking.scheduledExitTime,
          bookingDurationMinutes: booking.bookingDurationMinutes,
          paymentReference: payment.paymentReference,
          paymentMethod: payment.paymentMethod || 'Razorpay',
          paymentStatus: 'SUCCESSFUL',
          paymentDate: payment.paymentDate || new Date(),
          razorpayOrderId: payment.gatewayOrderId || input.razorpay_order_id,
          razorpayPaymentId: payment.gatewayPaymentId || input.razorpay_payment_id,
          paymentVerificationReference: txnId,
          baseAmount: booking.baseAmount,
          additionalCharges: booking.additionalCharges,
          totalAmount: booking.totalAmount,
          qrCode: confirmedQr,
        });
      }

      await auditService.log({
        userId: booking.customerId,
        actionCode: 'BOOKING_CONFIRMED',
        module: 'Booking Management',
        actionTitle: `Customer Booking Confirmed (${booking.bookingReference})`,
        description: `Customer confirmed reservation ${booking.bookingReference} for Slot ${slot.slotNumber} at ${lot.parkingName}.`,
        targetCollection: 'bookings',
        targetDocumentId: booking._id as mongoose.Types.ObjectId,
        metadata: {
          bookingReference: booking.bookingReference,
          paymentReference: payment.paymentReference,
          slotNumber: slot.slotNumber,
          totalAmount: booking.totalAmount,
        },
        ipAddress: ipAddress ?? null,
      });
    } catch {
      // Non-blocking post-confirmation hooks
    }

    return {
      bookingStatus: 'Confirmed',
      bookingReference: booking.bookingReference,
      bookingId: booking._id.toString(),
      qrCode: generatedQrCode,
      paymentReference: payment.paymentReference,
      paymentStatus: 'SUCCESSFUL',
      transactionId: txnId,
      message: 'Payment verified and parking slot reservation confirmed!',
      customerDetails,
      paymentDetails: {
        paymentReference: payment.paymentReference,
        paymentMethod: payment.paymentMethod || 'Razorpay',
        paymentStatus: 'SUCCESSFUL',
        paymentDate: (payment.paymentDate || new Date()).toISOString(),
        razorpayOrderId: payment.gatewayOrderId || input.razorpay_order_id,
        razorpayPaymentId: payment.gatewayPaymentId || input.razorpay_payment_id,
        paymentVerificationReference: txnId,
      },
      bookingDetails: {
        facilityName: lot.parkingName,
        address: fullAddress,
        floorName: floor.floorName,
        zoneName: zone.zoneName,
        zoneCode: zone.zoneCode,
        slotNumber: slot.slotNumber,
        slotLabel: slot.slotLabel,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.vehicleType,
        vehicleBrand: vehicle.vehicleBrand ?? null,
        vehicleModel: vehicle.vehicleModel ?? null,
        bookingType: booking.bookingType || 'ONLINE',
        scheduledEntryTime: booking.scheduledEntryTime.toISOString(),
        scheduledExitTime: booking.scheduledExitTime.toISOString(),
        gracePeriodMinutes: booking.gracePeriodMinutes,
        bookingDurationMinutes: booking.bookingDurationMinutes,
        parkingRateAtBooking: booking.parkingRateAtBooking,
        baseAmount: booking.baseAmount,
        taxes: 0,
        discountAmount: 0,
        additionalCharges: booking.additionalCharges,
        totalAmount: booking.totalAmount,
      },
    };
  }

  /**
   * Sends or re-sends the official booking confirmation & payment receipt email on customer request
   */
  public async emailBookingReceipt(params: { userId: string; bookingId: string }) {
    if (!mongoose.Types.ObjectId.isValid(params.bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const booking = await (BookingModel as mongoose.Model<Booking>)
      .findById(params.bookingId)
      .lean()
      .exec();

    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.customerId.toString() !== params.userId) {
      throw new AppError(
        'Access denied: you do not have permission to access this booking receipt.',
        403,
        'FORBIDDEN_BOOKING_ACCESS',
      );
    }

    if (booking.bookingStatus === 'Pending Payment') {
      throw new AppError(
        'Cannot email receipt for an unconfirmed booking.',
        400,
        'BOOKING_NOT_CONFIRMED',
      );
    }

    const [lot, floor, zone, slot, vehicle, customer, payment] = await Promise.all([
      (ParkingLotModel as mongoose.Model<ParkingLot>).findById(booking.parkingLotId).lean().exec(),
      (ParkingFloorModel as mongoose.Model<ParkingFloor>).findById(booking.floorId).lean().exec(),
      (ParkingZoneModel as mongoose.Model<ParkingZone>).findById(booking.zoneId).lean().exec(),
      (ParkingSlotModel as mongoose.Model<ParkingSlot>).findById(booking.currentSlotId).lean().exec(),
      (VehicleModel as mongoose.Model<Vehicle>).findById(booking.vehicleId).lean().exec(),
      (UserModel as mongoose.Model<User>).findById(booking.customerId).lean().exec(),
      (PaymentModel as mongoose.Model<Payment>)
        .findOne({ bookingId: booking._id, paymentStatus: { $in: ['SUCCESSFUL', 'REFUNDED'] } })
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
    ]);

    if (!lot || !floor || !zone || !slot || !vehicle || !customer || !payment) {
      throw new AppError('Required booking or payment records are missing.', 404, 'RECORDS_MISSING');
    }

    const fullAddress = [lot.address, lot.city, lot.state, lot.postalCode]
      .filter(Boolean)
      .join(', ');

    await emailService.sendBookingConfirmationEmail({
      to: customer.email,
      customerName: customer.fullName,
      customerEmail: customer.email,
      customerMobile: customer.mobileNumber,
      bookingId: booking._id as mongoose.Types.ObjectId,
      parkingLotId: booking.parkingLotId,
      bookingReference: booking.bookingReference,
      parkingName: lot.parkingName,
      parkingAddress: fullAddress,
      floorName: floor.floorName,
      zoneCode: zone.zoneCode,
      slotNumber: slot.slotNumber,
      vehicleNumber: vehicle.vehicleNumber,
      vehicleType: vehicle.vehicleType,
      vehicleBrand: vehicle.vehicleBrand ?? undefined,
      vehicleModel: vehicle.vehicleModel ?? undefined,
      bookingType: booking.bookingType || 'ONLINE',
      scheduledEntryTime: new Date(booking.scheduledEntryTime),
      scheduledExitTime: new Date(booking.scheduledExitTime),
      bookingDurationMinutes: booking.bookingDurationMinutes,
      paymentReference: payment.paymentReference,
      paymentMethod: payment.paymentMethod || 'Razorpay',
      paymentStatus: payment.paymentStatus,
      paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
      razorpayOrderId: payment.gatewayOrderId || 'N/A',
      razorpayPaymentId: payment.gatewayPaymentId || 'N/A',
      paymentVerificationReference: payment.transactionId || payment.paymentReference,
      baseAmount: booking.baseAmount,
      additionalCharges: booking.additionalCharges,
      totalAmount: booking.totalAmount,
      qrCode: booking.qrCode || `PE-PASS|${booking.bookingReference}|${slot.qrIdentifier}`,
    });

    return {
      sent: true,
      email: customer.email,
      bookingReference: booking.bookingReference,
      message: `Official receipt sent to ${customer.email}.`,
    };
  }

  /**
   * Marks a pending booking payment as failed or cancelled when the customer dismisses or fails Razorpay checkout
   */
  public async recordPaymentFailure(params: {
    userId: string;
    bookingId: string;
    reason?: string | undefined;
  }) {
    if (!mongoose.Types.ObjectId.isValid(params.bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const booking = await (BookingModel as mongoose.Model<Booking>)
      .findOne({
        _id: new mongoose.Types.ObjectId(params.bookingId),
        customerId: new mongoose.Types.ObjectId(params.userId),
      })
      .exec();

    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.bookingStatus !== 'Pending Payment') {
      return {
        bookingId: booking._id.toString(),
        bookingStatus: booking.bookingStatus,
      };
    }

    const reasonText = params.reason?.trim() || 'Payment was cancelled or failed at checkout.';

    booking.bookingStatus = 'Cancelled';
    booking.cancellationBy = 'Customer';
    booking.cancellationReason = reasonText;
    await booking.save();

    await (PaymentModel as mongoose.Model<Payment>).updateMany(
      { bookingId: booking._id, paymentStatus: 'PENDING' },
      {
        $set: {
          paymentStatus: 'FAILED',
          remarks: reasonText,
        },
      },
    );

    await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create({
      bookingId: booking._id,
      performedBy: new mongoose.Types.ObjectId(params.userId),
      eventCode: 'PAYMENT_FAILED',
      eventType: 'Payment Failed',
      eventTitle: 'Payment Not Completed',
      eventDescription: reasonText,
      eventSource: 'Customer',
    });

    return {
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      bookingStatus: booking.bookingStatus,
    };
  }

  /**
   * Transitions a Confirmed booking to Active upon physical vehicle entry, marks the physical ParkingSlot
   * as Occupied, and reconciles cached Zone, Floor, and Lot counters atomically.
   */
  public async recordVehicleEntry(params: {
    bookingId: string;
    performedBy?: string | null | undefined;
    entryTime?: Date | undefined;
  }) {
    if (!mongoose.Types.ObjectId.isValid(params.bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const session = await mongoose.startSession();
    let updatedSlotStatus = 'Reserved';

    try {
      await session.withTransaction(async () => {
        const booking = await (BookingModel as mongoose.Model<Booking>)
          .findById(params.bookingId)
          .session(session)
          .exec();

        if (!booking) {
          throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
        }

        if (booking.bookingStatus !== 'Confirmed') {
          throw new AppError(
            `Cannot record vehicle entry for a booking with status '${booking.bookingStatus}'.`,
            409,
            'INVALID_BOOKING_STATE_FOR_ENTRY',
          );
        }

        const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
          .findById(booking.currentSlotId)
          .session(session)
          .exec();

        if (!slot || slot.slotStatus === 'Under Maintenance') {
          throw new AppError(
            'Assigned parking slot is unavailable or under maintenance.',
            409,
            'SLOT_UNAVAILABLE_FOR_ENTRY',
          );
        }

        if (
          slot.slotStatus === 'Occupied' &&
          slot.currentBookingId &&
          slot.currentBookingId.toString() !== booking._id.toString()
        ) {
          throw new AppError(
            `Slot ${slot.slotNumber} is currently occupied by another active session.`,
            409,
            'SLOT_OCCUPIED_CONFLICT',
          );
        }

        const actualEntry = params.entryTime ?? new Date();
        booking.bookingStatus = 'Active';
        booking.actualEntryTime = actualEntry;
        await booking.save({ session });

        slot.slotStatus = 'Reserved';
        slot.currentBookingId = booking._id as mongoose.Types.ObjectId;
        await slot.save({ session });
        updatedSlotStatus = slot.slotStatus;

        await this.reconcileHierarchyCounters({
          parkingLotId: booking.parkingLotId as mongoose.Types.ObjectId,
          floorId: booking.floorId as mongoose.Types.ObjectId,
          zoneId: booking.zoneId as mongoose.Types.ObjectId,
          session,
        });

        await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create(
          [
            {
              bookingId: booking._id,
              performedBy:
                params.performedBy && mongoose.Types.ObjectId.isValid(params.performedBy)
                  ? new mongoose.Types.ObjectId(params.performedBy)
                  : null,
              eventCode: 'VEHICLE_ENTERED',
              eventType: 'Vehicle Entered',
              eventTitle: 'Vehicle Checked In',
              eventDescription: `Vehicle entered Bay ${slot.slotNumber}. Physical slot marked Occupied.`,
              eventSource: params.performedBy ? 'Security Staff' : 'System',
              eventTime: actualEntry,
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    const updatedBooking = await (BookingModel as mongoose.Model<Booking>)
      .findById(params.bookingId)
      .lean()
      .exec();

    return {
      bookingId: params.bookingId,
      bookingReference: updatedBooking?.bookingReference ?? '',
      bookingStatus: updatedBooking?.bookingStatus ?? 'Active',
      actualEntryTime: updatedBooking?.actualEntryTime ?? null,
      slotStatus: updatedSlotStatus,
    };
  }

  /**
   * Transitions an Active booking to Overstay when the vehicle remains past scheduledExitTime + gracePeriodMinutes,
   * calculates applicable overstay charges, keeps the physical slot Occupied, and reconciles counters.
   */
  public async markBookingOverstay(params: {
    bookingId: string;
    detectedAt?: Date | undefined;
  }) {
    if (!mongoose.Types.ObjectId.isValid(params.bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const session = await mongoose.startSession();
    let updatedSlotStatus = 'Occupied';

    try {
      await session.withTransaction(async () => {
        const booking = await (BookingModel as mongoose.Model<Booking>)
          .findById(params.bookingId)
          .session(session)
          .exec();

        if (!booking) {
          throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
        }

        if (booking.bookingStatus !== 'Active' && booking.bookingStatus !== 'Overstay') {
          throw new AppError(
            `Cannot mark overstay for a booking with status '${booking.bookingStatus}'.`,
            409,
            'INVALID_BOOKING_STATE_FOR_OVERSTAY',
          );
        }

        const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
          .findById(booking.currentSlotId)
          .session(session)
          .exec();

        if (!slot) {
          throw new AppError('Assigned parking slot not found.', 404, 'SLOT_NOT_FOUND');
        }

        const now = params.detectedAt ?? new Date();
        let overstayStart = new Date(booking.scheduledExitTime);
        if (Array.isArray(booking.extensions)) {
          for (const ext of booking.extensions) {
            if (ext && ext.newScheduledExitTime && ext.status !== 'FAILED' && ext.status !== 'CANCELLED') {
              const d = new Date(ext.newScheduledExitTime);
              if (!isNaN(d.getTime()) && d.getTime() > overstayStart.getTime()) {
                overstayStart = d;
              }
            }
          }
        }
        const overstayMinutes = Math.max(
          1,
          Math.ceil((now.getTime() - overstayStart.getTime()) / (60 * 1000)),
        );
        const billableOverstayHours = Math.max(1, Math.ceil(overstayMinutes / 60));
        const ratePerHour = booking.overstayRateAtBooking || booking.parkingRateAtBooking || 0;
        const overstayCharge = Math.round(billableOverstayHours * ratePerHour);

        const wasAlreadyOverstay = booking.bookingStatus === 'Overstay';

        booking.bookingStatus = 'Overstay';
        booking.overstayDetected = true;
        booking.overstayStartedAt = booking.overstayStartedAt ?? overstayStart;
        booking.overstayDurationMinutes = overstayMinutes;
        booking.overstayCharge = overstayCharge;
        booking.additionalCharges = overstayCharge;
        booking.totalAmount = booking.baseAmount + (booking.platformBookingFee || 0) + overstayCharge;
        await booking.save({ session });

        slot.slotStatus = 'Occupied';
        slot.currentBookingId = booking._id as mongoose.Types.ObjectId;
        await slot.save({ session });
        updatedSlotStatus = slot.slotStatus;

        await (VehicleMovementLogModel as any).updateMany(
          { bookingId: booking._id, exitTime: null },
          {
            $set: {
              movementStatus: 'Overstayed',
              overstayMinutes,
            },
          },
          { session },
        );

        await this.reconcileHierarchyCounters({
          parkingLotId: booking.parkingLotId as mongoose.Types.ObjectId,
          floorId: booking.floorId as mongoose.Types.ObjectId,
          zoneId: booking.zoneId as mongoose.Types.ObjectId,
          session,
        });

        if (!wasAlreadyOverstay) {
          await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create(
            [
              {
                bookingId: booking._id,
                performedBy: null,
                eventCode: 'OVERSTAY_DETECTED',
                eventType: 'Overstay Detected',
                eventTitle: 'Booking Entered Overstay',
                eventDescription: `Overstay of ${overstayMinutes} minute(s) detected on Bay ${slot.slotNumber}. Additional charge: ₹${overstayCharge}.`,
                eventSource: 'System',
                eventTime: now,
                metadata: {
                  overstayDurationMinutes: overstayMinutes,
                  overstayCharge,
                },
              },
            ],
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }

    const updatedBooking = await (BookingModel as mongoose.Model<Booking>)
      .findById(params.bookingId)
      .lean()
      .exec();

    if (updatedBooking) {
      emitBookingStatusUpdate({
        bookingId: updatedBooking._id.toString(),
        bookingReference: updatedBooking.bookingReference,
        parkingLotId: updatedBooking.parkingLotId.toString(),
        customerId: updatedBooking.customerId.toString(),
        bookingStatus: 'Overstay',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      bookingId: params.bookingId,
      bookingReference: updatedBooking?.bookingReference ?? '',
      bookingStatus: updatedBooking?.bookingStatus ?? 'Overstay',
      overstayDurationMinutes: updatedBooking?.overstayDurationMinutes ?? 0,
      overstayCharge: updatedBooking?.overstayCharge ?? 0,
      slotStatus: updatedSlotStatus,
    };
  }

  /**
   * Completes an Active or Overstay booking upon vehicle exit, releases the physical ParkingSlot
   * back to Available (or Reserved if another Confirmed booking is in its immediate arrival window),
   * and reconciles Zone, Floor, and Lot counters atomically.
   */
  public async completeBookingExit(params: {
    bookingId: string;
    performedBy?: string | null | undefined;
    exitTime?: Date | undefined;
  }) {
    if (!mongoose.Types.ObjectId.isValid(params.bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const session = await mongoose.startSession();
    let finalSlotStatus = 'Available';
    let computedActualDurationMinutes = 0;

    try {
      await session.withTransaction(async () => {
        const booking = await (BookingModel as mongoose.Model<Booking>)
          .findById(params.bookingId)
          .session(session)
          .exec();

        if (!booking) {
          throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
        }

        if (booking.bookingStatus !== 'Active' && booking.bookingStatus !== 'Overstay') {
          throw new AppError(
            `Cannot complete exit for a booking with status '${booking.bookingStatus}'.`,
            409,
            'INVALID_BOOKING_STATE_FOR_EXIT',
          );
        }

        const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
          .findById(booking.currentSlotId)
          .session(session)
          .exec();

        if (!slot) {
          throw new AppError('Assigned parking slot not found.', 404, 'SLOT_NOT_FOUND');
        }

        const actualExit = params.exitTime ?? new Date();
        const entryRef = booking.actualEntryTime ?? booking.scheduledEntryTime;
        const actualDurationMinutes = Math.max(
          1,
          Math.ceil((actualExit.getTime() - entryRef.getTime()) / (60 * 1000)),
        );
        computedActualDurationMinutes = actualDurationMinutes;

        booking.bookingStatus = 'Completed';
        booking.actualExitTime = actualExit;
        await booking.save({ session });

        await this.releaseOrHandOffPhysicalSlot({
          slot,
          releasedBookingId: booking._id as mongoose.Types.ObjectId,
          gracePeriodMinutes: booking.gracePeriodMinutes || 15,
          session,
        });
        finalSlotStatus = slot.slotStatus;

        const actorId =
          params.performedBy && mongoose.Types.ObjectId.isValid(params.performedBy)
            ? new mongoose.Types.ObjectId(params.performedBy)
            : null;
        const actorSource = params.performedBy ? 'Security Staff' : 'System';

        await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create(
          [
            {
              bookingId: booking._id,
              performedBy: actorId,
              eventCode: 'VEHICLE_EXITED',
              eventType: 'Vehicle Exited',
              eventTitle: 'Vehicle Checked Out',
              eventDescription: `Vehicle exited Bay ${slot.slotNumber}. Physical slot state updated to ${slot.slotStatus}.`,
              eventSource: actorSource,
              eventTime: actualExit,
            },
            {
              bookingId: booking._id,
              performedBy: null,
              eventCode: 'BOOKING_COMPLETED',
              eventType: 'Booking Completed',
              eventTitle: 'Booking Completed',
              eventDescription: `Booking ${booking.bookingReference} completed after ${actualDurationMinutes} minute(s).`,
              eventSource: 'System',
              eventTime: actualExit,
            },
          ],
          { session, ordered: true },
        );
      });
    } finally {
      await session.endSession();
    }

    const updatedBooking = await (BookingModel as mongoose.Model<Booking>)
      .findById(params.bookingId)
      .lean()
      .exec();

    return {
      bookingId: params.bookingId,
      bookingReference: updatedBooking?.bookingReference ?? '',
      bookingStatus: updatedBooking?.bookingStatus ?? 'Completed',
      actualExitTime: updatedBooking?.actualExitTime ?? null,
      actualDurationMinutes: computedActualDurationMinutes,
      slotStatus: finalSlotStatus,
    };
  }

  /**
   * Cancels a Pending Payment or Confirmed booking prior to vehicle entry, restores physical slot status
   * if the booking was holding the physical slot as Reserved, and reconciles Zone, Floor, and Lot counters.
   */
  public async cancelBooking(params: {
    bookingId: string;
    userId?: string | undefined;
    cancelledBy?:
    | 'Customer'
    | 'Security Staff'
    | 'Parking Owner'
    | 'Administrator'
    | 'System'
    | undefined;
    reason?: string | undefined;
  }) {
    if (!mongoose.Types.ObjectId.isValid(params.bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const session = await mongoose.startSession();
    let finalSlotStatus = 'Available';

    try {
      await session.withTransaction(async () => {
        const booking = await (BookingModel as mongoose.Model<Booking>)
          .findById(params.bookingId)
          .session(session)
          .exec();

        if (!booking) {
          throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
        }

        if (
          params.userId &&
          (params.cancelledBy === undefined || params.cancelledBy === 'Customer') &&
          booking.customerId.toString() !== params.userId
        ) {
          throw new AppError('Booking not found for this customer.', 404, 'BOOKING_NOT_FOUND');
        }

        if (
          booking.bookingStatus !== 'Confirmed' &&
          booking.bookingStatus !== 'Pending Payment'
        ) {
          throw new AppError(
            `Cannot cancel a booking with status '${booking.bookingStatus}'.`,
            409,
            'INVALID_BOOKING_STATE_FOR_CANCELLATION',
          );
        }

        const cancelledBy = params.cancelledBy ?? 'Customer';
        if (
          cancelledBy === 'Customer' &&
          booking.bookingStatus === 'Confirmed' &&
          Date.now() >= booking.scheduledEntryTime.getTime()
        ) {
          throw new AppError(
            'Customer cancellations are permitted only before the scheduled booking entry time.',
            409,
            'CANCELLATION_WINDOW_PASSED',
          );
        }

        const reasonText = params.reason?.trim() || `Booking cancelled by ${cancelledBy}.`;

        booking.bookingStatus = 'Cancelled';
        booking.cancellationBy = cancelledBy;
        booking.cancellationReason = reasonText;

        // Automatically process refund for paid bookings cancelled in time
        const payment = await (PaymentModel as mongoose.Model<Payment>)
          .findOne({ bookingId: booking._id, paymentStatus: 'SUCCESSFUL' })
          .session(session)
          .exec();

        if (payment) {
          const refundAmount = booking.totalAmount || payment.amount || 0;
          booking.refundAmount = refundAmount;
          payment.paymentStatus = 'REFUNDED';
          payment.refundAmount = refundAmount;
          payment.refundDate = new Date();
          payment.refunds = payment.refunds || [];
          payment.refunds.push({
            refundReference: `REF-${Date.now().toString(36).toUpperCase()}`,
            refundAmount,
            refundStatus: 'Refund Completed',
            refundReason: reasonText,
            initiatedAt: new Date(),
            completedAt: new Date(),
          } as any);
          await payment.save({ session });
        }

        await booking.save({ session });

        const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
          .findById(booking.currentSlotId)
          .session(session)
          .exec();

        if (slot) {
          const isHeldByThisBooking =
            slot.currentBookingId?.toString() === booking._id.toString() ||
            (slot.slotStatus === 'Reserved' && !slot.currentBookingId);

          if (isHeldByThisBooking) {
            await this.releaseOrHandOffPhysicalSlot({
              slot,
              releasedBookingId: booking._id as mongoose.Types.ObjectId,
              gracePeriodMinutes: booking.gracePeriodMinutes || 15,
              session,
            });
          } else {
            await this.reconcileHierarchyCounters({
              parkingLotId: booking.parkingLotId as mongoose.Types.ObjectId,
              floorId: booking.floorId as mongoose.Types.ObjectId,
              zoneId: booking.zoneId as mongoose.Types.ObjectId,
              session,
            });
          }
          finalSlotStatus = slot.slotStatus;
        }

        const eventSourceMap: Record<
          'Customer' | 'Security Staff' | 'Parking Owner' | 'Administrator' | 'System',
          'Customer' | 'Security Staff' | 'Parking Owner' | 'Admin' | 'System'
        > = {
          Customer: 'Customer',
          'Security Staff': 'Security Staff',
          'Parking Owner': 'Parking Owner',
          Administrator: 'Admin',
          System: 'System',
        };

        await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create(
          [
            {
              bookingId: booking._id,
              performedBy:
                params.userId && mongoose.Types.ObjectId.isValid(params.userId)
                  ? new mongoose.Types.ObjectId(params.userId)
                  : null,
              eventCode: 'BOOKING_CANCELLED',
              eventType: 'Booking Cancelled',
              eventTitle: 'Booking Cancelled',
              eventDescription: reasonText,
              eventSource: eventSourceMap[cancelledBy],
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    const updatedBooking = await (BookingModel as mongoose.Model<Booking>)
      .findById(params.bookingId)
      .lean()
      .exec();

    // Send cancellation receipt email and create notifications
    if (updatedBooking) {
      try {
        const [customerDoc, lotDoc, slotDoc, paymentDoc] = await Promise.all([
          updatedBooking.customerId
            ? (UserModel as mongoose.Model<User>).findById(updatedBooking.customerId).lean().exec()
            : null,
          updatedBooking.parkingLotId
            ? (ParkingLotModel as mongoose.Model<ParkingLot>).findById(updatedBooking.parkingLotId).lean().exec()
            : null,
          updatedBooking.currentSlotId
            ? (ParkingSlotModel as mongoose.Model<ParkingSlot>).findById(updatedBooking.currentSlotId).lean().exec()
            : null,
          (PaymentModel as mongoose.Model<Payment>)
            .findOne({
              bookingId: updatedBooking._id,
              paymentStatus: { $in: ['REFUNDED', 'SUCCESSFUL', 'CASH_REVERSAL_PENDING'] },
            })
            .lean()
            .exec(),
        ]);

        const refundAmount = updatedBooking.refundAmount || paymentDoc?.refundAmount || 0;
        const paymentMethod = paymentDoc?.paymentMethod || 'RAZORPAY';
        const refundStatus = refundAmount > 0 ? 'Refund Completed' : 'No Refund Applicable';

        // 1. Dispatch Cancellation Receipt Email
        if (customerDoc?.email) {
          void emailService.sendBookingCancelledEmail({
            to: customerDoc.email,
            customerName: customerDoc.fullName || 'Valued Customer',
            bookingReference: updatedBooking.bookingReference,
            parkingName: lotDoc?.parkingName || 'ParkEase Parking Facility',
            slotNumber: slotDoc?.slotNumber || 'Allocated Bay',
            cancellationReason: updatedBooking.cancellationReason || params.reason || 'Booking cancelled.',
            cancelledBy: updatedBooking.cancellationBy || params.cancelledBy || 'Customer',
            refundAmount,
            paymentMethod,
            refundStatus,
          }).catch((emailErr) => {
            console.warn('[CustomerBookingService] Cancellation receipt email warning:', emailErr);
          });
        }

        // 2. In-app Notification for Customer
        const notifRef = `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const notif = await (NotificationModel as any).create({
          notificationReference: notifRef,
          userId: updatedBooking.customerId,
          bookingId: updatedBooking._id,
          title: 'Booking Cancelled & Refund Notice',
          message: `Your booking (${updatedBooking.bookingReference}) at ${lotDoc?.parkingName || 'ParkEase'} was cancelled. ${refundAmount > 0 ? `Refund of ₹${refundAmount.toFixed(2)} processed.` : ''}`,
          notificationType: 'Booking',
          eventType: 'Booking Cancelled',
          priority: 'High',
          deliveryChannel: 'In-App',
          deliveryStatus: 'Delivered',
          actionUrl: '/customer/bookings',
        });
        emitNewNotification(updatedBooking.customerId.toString(), notif);

        // 3. Socket.IO status update
        emitBookingStatusUpdate({
          bookingId: updatedBooking._id.toString(),
          bookingReference: updatedBooking.bookingReference,
          parkingLotId: updatedBooking.parkingLotId.toString(),
          customerId: updatedBooking.customerId.toString(),
          bookingStatus: 'Cancelled',
          paymentStatus: paymentDoc?.paymentStatus || 'REFUNDED',
          timestamp: new Date().toISOString(),
        });
      } catch (postCancelErr) {
        console.warn('[CustomerBookingService] Post-cancellation notification warning:', postCancelErr);
      }
    }

    return {
      bookingId: params.bookingId,
      bookingReference: updatedBooking?.bookingReference ?? '',
      bookingStatus: updatedBooking?.bookingStatus ?? 'Cancelled',
      slotStatus: finalSlotStatus,
    };
  }

  /**
   * Marks a Confirmed booking as No Show when the customer does not check in within the allowed entry threshold,
   * releases any physical slot hold, and records the authoritative BookingTimeline event.
   */
  public async markBookingNoShow(params: {
    bookingId: string;
    detectedAt?: Date | undefined;
    reason?: string | undefined;
  }) {
    if (!mongoose.Types.ObjectId.isValid(params.bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const session = await mongoose.startSession();
    let finalSlotStatus = 'Available';

    try {
      await session.withTransaction(async () => {
        const booking = await (BookingModel as mongoose.Model<Booking>)
          .findById(params.bookingId)
          .session(session)
          .exec();

        if (!booking) {
          throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
        }

        if (booking.bookingStatus !== 'Confirmed') {
          throw new AppError(
            `Cannot mark No Show for a booking with status '${booking.bookingStatus}'.`,
            409,
            'INVALID_BOOKING_STATE_FOR_NO_SHOW',
          );
        }

        const now = params.detectedAt ?? new Date();
        const reasonText =
          params.reason?.trim() ||
          'Customer did not check in within the allowed entry window (No Show).';

        booking.bookingStatus = 'No Show';
        booking.noShowDetected = true;
        booking.cancellationBy = 'System';
        booking.cancellationReason = reasonText;
        await booking.save({ session });

        const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
          .findById(booking.currentSlotId)
          .session(session)
          .exec();

        if (slot) {
          const isHeldByThisBooking =
            slot.currentBookingId?.toString() === booking._id.toString() ||
            (slot.slotStatus === 'Reserved' && !slot.currentBookingId);

          if (isHeldByThisBooking) {
            await this.releaseOrHandOffPhysicalSlot({
              slot,
              releasedBookingId: booking._id as mongoose.Types.ObjectId,
              gracePeriodMinutes: booking.gracePeriodMinutes || 15,
              session,
            });
          } else {
            await this.reconcileHierarchyCounters({
              parkingLotId: booking.parkingLotId as mongoose.Types.ObjectId,
              floorId: booking.floorId as mongoose.Types.ObjectId,
              zoneId: booking.zoneId as mongoose.Types.ObjectId,
              session,
            });
          }
          finalSlotStatus = slot.slotStatus;
        }

        await (BookingTimelineModel as mongoose.Model<BookingTimeline>).create(
          [
            {
              bookingId: booking._id,
              performedBy: null,
              eventCode: 'BOOKING_NO_SHOW',
              eventType: 'No Show',
              eventTitle: 'Booking Marked as No Show',
              eventDescription: reasonText,
              eventSource: 'System',
              eventTime: now,
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    const updatedBooking = await (BookingModel as mongoose.Model<Booking>)
      .findById(params.bookingId)
      .lean()
      .exec();

    return {
      bookingId: params.bookingId,
      bookingReference: updatedBooking?.bookingReference ?? '',
      bookingStatus: updatedBooking?.bookingStatus ?? 'No Show',
      slotStatus: finalSlotStatus,
    };
  }

  private lastGlobalReconcileAt = 0;

  /**
   * Reconciles expired Confirmed bookings to No Show and overdue Active bookings to Overstay,
   * keeping customer booking tabs, counts, and physical bay states authoritative in real time.
   */
  public async reconcileBookingStatuses(customerId?: mongoose.Types.ObjectId): Promise<void> {
    const now = new Date();
    if (!customerId) {
      if (now.getTime() - this.lastGlobalReconcileAt < 3000) {
        return;
      }
      this.lastGlobalReconcileAt = now.getTime();
    }

    // 1. Confirmed bookings whose arrival grace window has elapsed without gate entry -> No Show
    const expiredConfirmedFilter: Record<string, unknown> = {
      bookingStatus: 'Confirmed',
      actualEntryTime: null,
      $or: [
        { scheduledExitTime: { $lte: now } },
        {
          $expr: {
            $lte: [
              {
                $add: [
                  '$scheduledEntryTime',
                  { $multiply: [{ $ifNull: ['$gracePeriodMinutes', 15] }, 60000] },
                ],
              },
              now,
            ],
          },
        },
      ],
    };
    if (customerId) {
      expiredConfirmedFilter.customerId = customerId;
    }

    try {
      const expiredConfirmedBookings = await (BookingModel as mongoose.Model<Booking>)
        .find(expiredConfirmedFilter)
        .select('_id')
        .limit(25)
        .lean()
        .exec();

      for (const b of expiredConfirmedBookings) {
        try {
          await this.markBookingNoShow({
            bookingId: b._id.toString(),
            reason: 'Arrival window expired without gate check-in (No Show).',
          });
        } catch {
          // Continue gracefully
        }
      }
    } catch {
      // Non-blocking background reconciliation
    }

    // 2. Active or Overstay bookings past scheduledExitTime without checkout -> Overstay & live charge update
    const overdueActiveFilter: Record<string, unknown> = {
      bookingStatus: { $in: ['Active', 'Overstay'] },
      actualExitTime: null,
      scheduledExitTime: { $lte: now },
    };
    if (customerId) {
      overdueActiveFilter.customerId = customerId;
    }

    try {
      const overdueActiveBookings = await (BookingModel as mongoose.Model<Booking>)
        .find(overdueActiveFilter)
        .select('_id bookingStatus scheduledExitTime extensions overstayDurationMinutes overstayCharge overstayRateAtBooking parkingRateAtBooking baseAmount platformBookingFee overstayStartedAt')
        .sort({ scheduledExitTime: -1 })
        .limit(100)
        .lean()
        .exec();

      const bulkRefreshOps: any[] = [];
      let newlyTransitionedCount = 0;

      for (const b of overdueActiveBookings) {
        try {
          let effectiveExitTime = new Date(b.scheduledExitTime);
          if (Array.isArray(b.extensions)) {
            for (const ext of b.extensions) {
              if (ext && ext.newScheduledExitTime && ext.status !== 'FAILED' && ext.status !== 'CANCELLED') {
                const d = new Date(ext.newScheduledExitTime);
                if (!isNaN(d.getTime()) && d.getTime() > effectiveExitTime.getTime()) {
                  effectiveExitTime = d;
                }
              }
            }
          }

          if (now.getTime() <= effectiveExitTime.getTime()) {
            continue;
          }

          const expectedMins = Math.max(
            1,
            Math.ceil((now.getTime() - effectiveExitTime.getTime()) / (60 * 1000)),
          );
          const expectedHours = Math.max(1, Math.ceil(expectedMins / 60));
          const rate = b.overstayRateAtBooking || b.parkingRateAtBooking || 0;
          const expectedCharge = Math.round(expectedHours * rate);

          if (b.bookingStatus === 'Active') {
            if (newlyTransitionedCount < 10) {
              newlyTransitionedCount++;
              await this.markBookingOverstay({
                bookingId: b._id.toString(),
                detectedAt: now,
              });
            }
          } else if (
            b.overstayDurationMinutes !== expectedMins ||
            b.overstayCharge !== expectedCharge ||
            !b.overstayStartedAt
          ) {
            bulkRefreshOps.push({
              updateOne: {
                filter: { _id: b._id },
                update: {
                  $set: {
                    overstayDetected: true,
                    overstayStartedAt: b.overstayStartedAt ?? effectiveExitTime,
                    overstayDurationMinutes: expectedMins,
                    overstayCharge: expectedCharge,
                    additionalCharges: expectedCharge,
                    totalAmount: (b.baseAmount || 0) + ((b as any).platformBookingFee || 0) + expectedCharge,
                  },
                },
              },
            });
          }
        } catch {
          // Continue gracefully
        }
      }

      if (bulkRefreshOps.length > 0) {
        await (BookingModel as mongoose.Model<Booking>).bulkWrite(bulkRefreshOps, { ordered: false });
      }
    } catch {
      // Non-blocking background reconciliation
    }
  }

  /**
   * Batch-enriches Booking documents into customer-facing CustomerBookingItem records
   * without N+1 database queries.
   */
  private async enrichBookingsForCustomer(
    bookings: Array<Booking & { _id: mongoose.Types.ObjectId; createdAt?: Date; updatedAt?: Date }>,
  ): Promise<CustomerBookingItem[]> {
    if (bookings.length === 0) return [];

    const lotIds = Array.from(new Set(bookings.map((b) => b.parkingLotId.toString()))).map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const floorIds = Array.from(new Set(bookings.map((b) => b.floorId.toString()))).map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const zoneIds = Array.from(new Set(bookings.map((b) => b.zoneId.toString()))).map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const slotIdsSet = new Set<string>();
    for (const b of bookings) {
      slotIdsSet.add(b.currentSlotId.toString());
      if (b.originalSlotId) slotIdsSet.add(b.originalSlotId.toString());
    }
    const slotIds = Array.from(slotIdsSet).map((id) => new mongoose.Types.ObjectId(id));
    const vehicleIds = Array.from(new Set(bookings.map((b) => b.vehicleId.toString()))).map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const bookingIds = bookings.map((b) => b._id);

    const [lots, floors, zones, slots, vehicles, payments] = await Promise.all([
      (ParkingLotModel as mongoose.Model<ParkingLot>)
        .find({ _id: { $in: lotIds } })
        .lean()
        .exec(),
      (ParkingFloorModel as mongoose.Model<ParkingFloor>)
        .find({ _id: { $in: floorIds } })
        .lean()
        .exec(),
      (ParkingZoneModel as mongoose.Model<ParkingZone>)
        .find({ _id: { $in: zoneIds } })
        .lean()
        .exec(),
      (ParkingSlotModel as mongoose.Model<ParkingSlot>)
        .find({ _id: { $in: slotIds } })
        .lean()
        .exec(),
      (VehicleModel as mongoose.Model<Vehicle>)
        .find({ _id: { $in: vehicleIds } })
        .lean()
        .exec(),
      (PaymentModel as mongoose.Model<Payment>)
        .find({ bookingId: { $in: bookingIds } })
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
    ]);

    const lotMap = new Map(lots.map((l) => [l._id.toString(), l]));
    const floorMap = new Map(floors.map((f) => [f._id.toString(), f]));
    const zoneMap = new Map(zones.map((z) => [z._id.toString(), z]));
    const slotMap = new Map(slots.map((s) => [s._id.toString(), s]));
    const vehicleMap = new Map(vehicles.map((v) => [v._id.toString(), v]));

    const paymentsByBooking = new Map<string, Array<Payment & { _id: mongoose.Types.ObjectId }>>();
    for (const p of payments) {
      if (!p.bookingId) continue;
      const bId = p.bookingId.toString();
      const arr = paymentsByBooking.get(bId) ?? [];
      arr.push(p as Payment & { _id: mongoose.Types.ObjectId });
      paymentsByBooking.set(bId, arr);
    }

    const nowMs = Date.now();

    return bookings.map((booking) => {
      const bIdStr = booking._id.toString();
      const lot = lotMap.get(booking.parkingLotId.toString());
      const floor = floorMap.get(booking.floorId.toString());
      const zone = zoneMap.get(booking.zoneId.toString());
      const currentSlot = slotMap.get(booking.currentSlotId.toString());
      const originalSlotDoc = booking.originalSlotId
        ? slotMap.get(booking.originalSlotId.toString())
        : undefined;
      const vehicle = vehicleMap.get(booking.vehicleId.toString());
      const bookingPayments = paymentsByBooking.get(bIdStr) ?? [];

      const primaryPayment =
        bookingPayments.find((p) => p.paymentTypeCode === 'BOOKING') ?? bookingPayments[0] ?? null;
      const overstayPayment =
        bookingPayments.find(
          (p) => p.paymentTypeCode === 'OVERSTAY' && p.paymentStatus === 'SUCCESSFUL',
        ) ?? null;

      const latestRefund =
        primaryPayment?.refunds && primaryPayment.refunds.length > 0
          ? primaryPayment.refunds[primaryPayment.refunds.length - 1]
          : null;

      const entryTimeMs = new Date(booking.scheduledEntryTime).getTime();
      let exitTimeMs = new Date(booking.scheduledExitTime).getTime();
      if (Array.isArray(booking.extensions)) {
        for (const ext of booking.extensions) {
          if (ext && ext.newScheduledExitTime && ext.status !== 'FAILED' && ext.status !== 'CANCELLED') {
            const d = new Date(ext.newScheduledExitTime).getTime();
            if (!Number.isNaN(d) && d > exitTimeMs) {
              exitTimeMs = d;
            }
          }
        }
      }
      const graceMins = booking.gracePeriodMinutes ?? 15;
      const isLiveOverstay =
        (booking.bookingStatus === 'Active' || booking.bookingStatus === 'Overstay') &&
        !booking.actualExitTime &&
        nowMs > exitTimeMs;

      const graceEndsAtDate =
        booking.bookingStatus === 'Active' || booking.bookingStatus === 'Overstay'
          ? new Date(exitTimeMs)
          : booking.gracePeriodEndsAt
            ? new Date(booking.gracePeriodEndsAt)
            : new Date(entryTimeMs + graceMins * 60 * 1000);

      let remainingMinutes: number | null = null;
      if (booking.bookingStatus === 'Active' && !isLiveOverstay) {
        remainingMinutes = Math.max(0, Math.ceil((exitTimeMs - nowMs) / (60 * 1000)));
      } else if (booking.bookingStatus === 'Confirmed' && entryTimeMs > nowMs) {
        remainingMinutes = Math.max(0, Math.ceil((entryTimeMs - nowMs) / (60 * 1000)));
      }

      const status = (isLiveOverstay ? 'Overstay' : booking.bookingStatus) as CanonicalBookingStatus;
      const canViewQr =
        (status === 'Confirmed' || status === 'Active' || status === 'Overstay') &&
        Boolean(booking.qrCode);

      const canDownloadReceipt =
        status !== 'Pending Payment' &&
        Boolean(
          primaryPayment &&
          (primaryPayment.paymentStatus === 'SUCCESSFUL' ||
            primaryPayment.paymentStatus === 'REFUNDED'),
        );

      const isReassigned =
        booking.slotReassignmentStatus === 'REASSIGNED' ||
        (booking.originalSlotId &&
          booking.originalSlotId.toString() !== booking.currentSlotId.toString());

      const refundAmt = booking.refundAmount || primaryPayment?.refundAmount || 0;
      const paidAmt = primaryPayment?.amount || booking.totalAmount || 0;
      const refundPct =
        refundAmt > 0 && paidAmt > 0 ? Math.min(100, Math.round((refundAmt / paidAmt) * 100)) : null;

      const liveOverstayMinutes = isLiveOverstay
        ? Math.max(1, Math.ceil((nowMs - exitTimeMs) / (60 * 1000)))
        : booking.overstayDurationMinutes || 0;
      const billableOverstayHours = isLiveOverstay
        ? Math.max(1, Math.ceil(liveOverstayMinutes / 60))
        : 0;
      const overstayRate = booking.overstayRateAtBooking || booking.parkingRateAtBooking || 0;
      const overstayChargeVal = isLiveOverstay
        ? Math.max(booking.overstayCharge || 0, Math.round(billableOverstayHours * overstayRate))
        : booking.overstayCharge || 0;

      let additionalChargePaymentStatus: 'PAID' | 'UNPAID' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';
      if (booking.overstayDetected || status === 'Overstay' || overstayChargeVal > 0) {
        additionalChargePaymentStatus = overstayPayment ? 'PAID' : 'UNPAID';
      }

      const fullAddress = lot
        ? [lot.address, lot.city, lot.state, lot.postalCode].filter(Boolean).join(', ')
        : 'Address unavailable';

      return {
        bookingId: bIdStr,
        bookingReference: booking.bookingReference,
        parkingLotId: booking.parkingLotId.toString(),
        parkingName: lot?.parkingName ?? 'Parking Facility',
        parkingAddress: fullAddress,
        parkingCity: lot?.city ?? '',
        parkingImages: lot?.parkingImages ?? [],
        floor: {
          _id: booking.floorId.toString(),
          floorName: floor?.floorName ?? 'Floor 1',
          floorNumber: floor?.floorNumber ?? 1,
        },
        zone: {
          _id: booking.zoneId.toString(),
          zoneName: zone?.zoneName ?? 'Zone A',
          zoneCode: zone?.zoneCode ?? 'A',
        },
        currentSlot: {
          _id: booking.currentSlotId.toString(),
          slotNumber: currentSlot?.slotNumber ?? 'N/A',
          slotLabel: currentSlot?.slotLabel ?? currentSlot?.slotNumber ?? 'N/A',
          slotType: currentSlot?.slotType ?? 'Standard',
          supportedVehicleType: currentSlot?.supportedVehicleType ?? 'Car',
        },
        originalSlot:
          isReassigned && originalSlotDoc
            ? {
              _id: originalSlotDoc._id.toString(),
              slotNumber: originalSlotDoc.slotNumber,
              slotLabel: originalSlotDoc.slotLabel || originalSlotDoc.slotNumber,
            }
            : null,
        vehicle: {
          _id: booking.vehicleId.toString(),
          vehicleNumber: vehicle?.vehicleNumber ?? 'N/A',
          vehicleType: vehicle?.vehicleType ?? 'Car',
          vehicleBrand: vehicle?.vehicleBrand ?? null,
          vehicleModel: vehicle?.vehicleModel ?? null,
          vehicleColor: vehicle?.vehicleColor ?? null,
          fuelType: vehicle?.fuelType ?? null,
        },
        bookingType: (booking.bookingType as 'ONLINE' | 'WALK_IN') || 'ONLINE',
        bookingStatus: status,
        scheduledEntryTime: new Date(booking.scheduledEntryTime).toISOString(),
        scheduledExitTime: new Date(booking.scheduledExitTime).toISOString(),
        actualEntryTime: booking.actualEntryTime
          ? new Date(booking.actualEntryTime).toISOString()
          : null,
        actualExitTime: booking.actualExitTime
          ? new Date(booking.actualExitTime).toISOString()
          : null,
        gracePeriodMinutes: graceMins,
        gracePeriodEndsAt: graceEndsAtDate.toISOString(),
        bookingDurationMinutes: booking.bookingDurationMinutes,
        remainingMinutes,
        parkingRateAtBooking: booking.parkingRateAtBooking,
        overstayRateAtBooking: booking.overstayRateAtBooking,
        baseAmount: booking.baseAmount,
        platformBookingFee: (booking as any).platformBookingFee ?? 0,
        additionalCharges: booking.additionalCharges,
        totalAmount: booking.totalAmount,
        canViewQr,
        qrCode: canViewQr ? booking.qrCode ?? null : null,
        canDownloadReceipt,
        payment: primaryPayment
          ? {
            paymentReference: primaryPayment.paymentReference,
            paymentMethod: primaryPayment.paymentMethod,
            paymentStatus: primaryPayment.paymentStatus as
              | 'PENDING'
              | 'SUCCESSFUL'
              | 'FAILED'
              | 'REFUNDED'
              | 'CASH_REVERSAL_PENDING',
            paymentDate: primaryPayment.paymentDate
              ? new Date(primaryPayment.paymentDate).toISOString()
              : null,
            razorpayOrderId: primaryPayment.gatewayOrderId ?? null,
            razorpayPaymentId: primaryPayment.gatewayPaymentId ?? null,
            transactionId: primaryPayment.transactionId ?? null,
            amount: primaryPayment.amount,
            refundAmount: refundAmt,
            refundStatus: latestRefund?.refundStatus ?? null,
            refundReason: latestRefund?.refundReason ?? booking.cancellationReason ?? null,
            refundPercentage: refundPct,
            refundCompletedAt: latestRefund?.completedAt
              ? new Date(latestRefund.completedAt).toISOString()
              : null,
          }
          : null,
        overstay: {
          overstayDetected: Boolean(booking.overstayDetected || status === 'Overstay' || isLiveOverstay),
          overstayStartedAt: booking.overstayStartedAt
            ? new Date(booking.overstayStartedAt).toISOString()
            : isLiveOverstay
              ? new Date(exitTimeMs).toISOString()
              : null,
          overstayDurationMinutes: liveOverstayMinutes,
          overstayCharge: overstayChargeVal,
          additionalChargePaymentStatus,
        },
        reassignment: {
          slotReassignmentStatus: (booking.slotReassignmentStatus ?? 'NOT_REQUIRED') as
            | 'NOT_REQUIRED'
            | 'PENDING'
            | 'REASSIGNED'
            | 'FAILED'
            | 'CANCELLED_REFUNDED',
          slotReassignmentReason: booking.slotReassignmentReason ?? null,
          slotReassignedAt: booking.slotReassignedAt
            ? new Date(booking.slotReassignedAt).toISOString()
            : null,
          originalSlotNumber: originalSlotDoc?.slotNumber ?? null,
          currentSlotNumber: currentSlot?.slotNumber ?? 'N/A',
        },
        cancellation:
          status === 'Cancelled' || status === 'No Show' || booking.cancellationReason
            ? {
              cancellationReason: booking.cancellationReason ?? null,
              cancellationBy: booking.cancellationBy ?? null,
              cancelledAt: booking.updatedAt ? new Date(booking.updatedAt).toISOString() : null,
              refundAmount: refundAmt,
              refundPercentage: refundPct,
              refundStatus:
                latestRefund?.refundStatus ??
                (refundAmt > 0 ? 'Refund Completed' : null),
            }
            : null,
        noShowDetected: Boolean(booking.noShowDetected || status === 'No Show'),
        createdAt: booking.createdAt
          ? new Date(booking.createdAt).toISOString()
          : new Date().toISOString(),
        updatedAt: booking.updatedAt
          ? new Date(booking.updatedAt).toISOString()
          : new Date().toISOString(),
      };
    });
  }

  /**
   * Retrieves paginated bookings belonging exclusively to the authenticated customer
   * with category filtering, search, facility filter, and date filter.
   */
  public async getCustomerBookings(params: {
    userId: string;
    category?: CustomerBookingCategory | undefined;
    search?: string | undefined;
    parkingLotId?: string | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  }): Promise<PaginatedCustomerBookingsResponse> {
    if (!mongoose.Types.ObjectId.isValid(params.userId)) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const customerObjectId = new mongoose.Types.ObjectId(params.userId);

    // Auto-reconcile expired or overdue bookings before computing tabs and category counts
    await this.reconcileBookingStatuses(customerObjectId);

    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 8));

    const visibleStatuses: CanonicalBookingStatus[] = [
      'Confirmed',
      'Active',
      'Completed',
      'Cancelled',
      'No Show',
      'Overstay',
    ];

    // 1. Compute category counts & distinct facilities across the customer's bookings
    const allCustomerBookingsMeta = await (BookingModel as mongoose.Model<Booking>)
      .find(
        {
          customerId: customerObjectId,
          bookingStatus: { $in: visibleStatuses },
        },
        'bookingStatus parkingLotId',
      )
      .lean()
      .exec();

    const categoryCounts = {
      Upcoming: 0,
      Active: 0,
      Completed: 0,
      Cancelled: 0,
      'No Show': 0,
      Overstay: 0,
      All: 0,
    };

    const distinctLotIdsSet = new Set<string>();
    for (const meta of allCustomerBookingsMeta) {
      distinctLotIdsSet.add(meta.parkingLotId.toString());
      categoryCounts.All += 1;
      if (meta.bookingStatus === 'Confirmed') categoryCounts.Upcoming += 1;
      else if (meta.bookingStatus === 'Active') categoryCounts.Active += 1;
      else if (meta.bookingStatus === 'Completed') categoryCounts.Completed += 1;
      else if (meta.bookingStatus === 'Cancelled') categoryCounts.Cancelled += 1;
      else if (meta.bookingStatus === 'No Show') categoryCounts['No Show'] += 1;
      else if (meta.bookingStatus === 'Overstay') categoryCounts.Overstay += 1;
    }

    const customerLots =
      distinctLotIdsSet.size > 0
        ? await (ParkingLotModel as mongoose.Model<ParkingLot>)
          .find(
            {
              _id: {
                $in: Array.from(distinctLotIdsSet).map((id) => new mongoose.Types.ObjectId(id)),
              },
            },
            '_id parkingName',
          )
          .sort({ parkingName: 1 })
          .lean()
          .exec()
        : [];

    const facilities = customerLots.map((l) => ({
      _id: l._id.toString(),
      parkingName: l.parkingName,
    }));

    // 2. Build filtered query scoped strictly to customerId
    const filter: Record<string, unknown> = {
      customerId: customerObjectId,
    };

    const cat = params.category ?? 'Upcoming';
    if (cat === 'Upcoming') {
      filter.bookingStatus = 'Confirmed';
    } else if (cat === 'Active') {
      filter.bookingStatus = 'Active';
    } else if (cat === 'Completed') {
      filter.bookingStatus = 'Completed';
    } else if (cat === 'Cancelled') {
      filter.bookingStatus = 'Cancelled';
    } else if (cat === 'No Show') {
      filter.bookingStatus = 'No Show';
    } else if (cat === 'Overstay') {
      filter.bookingStatus = 'Overstay';
    } else {
      filter.bookingStatus = { $in: visibleStatuses };
    }

    if (params.parkingLotId && mongoose.Types.ObjectId.isValid(params.parkingLotId)) {
      filter.parkingLotId = new mongoose.Types.ObjectId(params.parkingLotId);
    }

    if (params.dateFrom || params.dateTo) {
      const dateCond: Record<string, Date> = {};
      if (params.dateFrom) {
        const fromD = new Date(params.dateFrom);
        if (!isNaN(fromD.getTime())) {
          dateCond.$gte = fromD;
        }
      }
      if (params.dateTo) {
        const toD = new Date(params.dateTo);
        if (!isNaN(toD.getTime())) {
          // If only a date string like YYYY-MM-DD was passed, include the full day
          if (params.dateTo.length <= 10) {
            toD.setHours(23, 59, 59, 999);
          }
          dateCond.$lte = toD;
        }
      }
      if (Object.keys(dateCond).length > 0) {
        filter.scheduledEntryTime = dateCond;
      }
    }

    if (params.search && params.search.trim()) {
      const escaped = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      const matchingLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
        .find({
          $or: [{ parkingName: regex }, { city: regex }, { address: regex }],
        })
        .select('_id')
        .lean()
        .exec();

      const matchingLotIds = matchingLots.map((l) => l._id);

      filter.$or = [
        { bookingReference: regex },
        ...(matchingLotIds.length > 0 ? [{ parkingLotId: { $in: matchingLotIds } }] : []),
      ];
    }

    const sortSpec: Record<string, 1 | -1> =
      cat === 'Upcoming'
        ? { scheduledEntryTime: 1, createdAt: -1 }
        : { scheduledEntryTime: -1, createdAt: -1 };

    const [total, rawBookings] = await Promise.all([
      (BookingModel as mongoose.Model<Booking>).countDocuments(filter).exec(),
      (BookingModel as mongoose.Model<Booking>)
        .find(filter)
        .sort(sortSpec)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    const enrichedBookings = await this.enrichBookingsForCustomer(
      rawBookings as Array<
        Booking & { _id: mongoose.Types.ObjectId; createdAt?: Date; updatedAt?: Date }
      >,
    );

    return {
      bookings: enrichedBookings,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      categoryCounts,
      facilities,
    };
  }

  /**
   * Retrieves full booking details, timeline, QR pass, and receipt payload for a single booking,
   * strictly enforcing customer ownership.
   */
  public async getCustomerBookingDetails(params: {
    userId: string;
    bookingId: string;
  }): Promise<CustomerBookingDetailsResponse> {
    if (!mongoose.Types.ObjectId.isValid(params.userId)) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    if (!mongoose.Types.ObjectId.isValid(params.bookingId)) {
      throw new AppError('Invalid booking ID format.', 400, 'INVALID_BOOKING_ID');
    }

    const customerObjectId = new mongoose.Types.ObjectId(params.userId);
    await this.reconcileBookingStatuses(customerObjectId);

    const booking = await (BookingModel as mongoose.Model<Booking>)
      .findById(params.bookingId)
      .lean()
      .exec();

    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    // Strict ownership enforcement: never allow one customer to access another customer's booking
    if (booking.customerId.toString() !== params.userId) {
      throw new AppError(
        'Access denied: you do not have permission to view this booking.',
        403,
        'FORBIDDEN_BOOKING_ACCESS',
      );
    }

    const [enrichedList, customer, timelineDocs] = await Promise.all([
      this.enrichBookingsForCustomer([
        booking as Booking & { _id: mongoose.Types.ObjectId; createdAt?: Date; updatedAt?: Date },
      ]),
      (UserModel as mongoose.Model<User>).findById(params.userId).lean().exec(),
      (BookingTimelineModel as mongoose.Model<BookingTimeline>)
        .find({ bookingId: booking._id })
        .sort({ eventTime: 1, createdAt: 1 })
        .lean()
        .exec(),
    ]);

    const enriched = enrichedList[0];
    if (!enriched) {
      throw new AppError('Failed to load booking details.', 500, 'BOOKING_ENRICH_FAILED');
    }

    const customerDetails = {
      fullName: customer?.fullName ?? 'Valued Customer',
      email: customer?.email ?? '',
      mobileNumber: customer?.mobileNumber ?? '',
    };

    const timeline: CustomerBookingTimelineItem[] = timelineDocs.map((t) => ({
      _id: t._id.toString(),
      bookingId: booking._id.toString(),
      bookingReference: enriched.bookingReference,
      parkingName: enriched.parkingName,
      eventCode: t.eventCode,
      eventType: t.eventType,
      eventTitle: t.eventTitle,
      eventDescription: t.eventDescription ?? null,
      eventSource: t.eventSource,
      eventTime: t.eventTime
        ? new Date(t.eventTime).toISOString()
        : new Date().toISOString(),
    }));

    let receiptData: VerifyBookingPaymentResponse | null = null;
    if (enriched.canDownloadReceipt && enriched.payment) {
      receiptData = {
        bookingStatus:
          enriched.bookingStatus === 'Cancelled' || enriched.bookingStatus === 'No Show'
            ? 'Cancelled'
            : 'Confirmed',
        bookingReference: enriched.bookingReference,
        bookingId: enriched.bookingId,
        qrCode: enriched.qrCode,
        paymentReference: enriched.payment.paymentReference,
        paymentStatus:
          enriched.payment.paymentStatus === 'REFUNDED'
            ? 'REFUNDED'
            : enriched.payment.paymentStatus === 'SUCCESSFUL'
              ? 'SUCCESSFUL'
              : 'FAILED',
        transactionId: enriched.payment.transactionId,
        message: `Official receipt for booking ${enriched.bookingReference}`,
        customerDetails,
        paymentDetails: {
          paymentReference: enriched.payment.paymentReference,
          paymentMethod: enriched.payment.paymentMethod,
          paymentStatus:
            enriched.payment.paymentStatus === 'REFUNDED'
              ? 'REFUNDED'
              : enriched.payment.paymentStatus === 'SUCCESSFUL'
                ? 'SUCCESSFUL'
                : 'FAILED',
          paymentDate: enriched.payment.paymentDate ?? enriched.createdAt,
          razorpayOrderId: enriched.payment.razorpayOrderId ?? 'N/A',
          razorpayPaymentId: enriched.payment.razorpayPaymentId ?? 'N/A',
          paymentVerificationReference:
            enriched.payment.transactionId ?? enriched.payment.paymentReference,
        },
        bookingDetails: {
          facilityName: enriched.parkingName,
          address: enriched.parkingAddress,
          floorName: enriched.floor.floorName,
          zoneName: enriched.zone.zoneName,
          zoneCode: enriched.zone.zoneCode,
          slotNumber: enriched.currentSlot.slotNumber,
          slotLabel: enriched.currentSlot.slotLabel,
          vehicleNumber: enriched.vehicle.vehicleNumber,
          vehicleType: enriched.vehicle.vehicleType,
          vehicleBrand: enriched.vehicle.vehicleBrand,
          vehicleModel: enriched.vehicle.vehicleModel,
          bookingType: enriched.bookingType,
          scheduledEntryTime: enriched.scheduledEntryTime,
          scheduledExitTime: enriched.scheduledExitTime,
          gracePeriodMinutes: enriched.gracePeriodMinutes,
          bookingDurationMinutes: enriched.bookingDurationMinutes,
          parkingRateAtBooking: enriched.parkingRateAtBooking,
          baseAmount: enriched.baseAmount,
          platformBookingFee: (enriched as any).platformBookingFee ?? 0,
          taxes: 0,
          discountAmount: 0,
          additionalCharges: enriched.additionalCharges,
          totalAmount: enriched.totalAmount,
        },
      };
    }

    return {
      booking: enriched,
      customerDetails,
      timeline,
      receiptData,
    };
  }

  /**
   * Retrieves the complete backend-driven Customer Dashboard overview for `/customer/dashboard`:
   * - Real summary statistics
   * - Active booking (when one exists)
   * - Next upcoming confirmed reservation
   * - Authoritative recent booking timeline activity
   * - Real 6-month booking activity chart data
   * - Synchronized favourite parking locations
   * - Recent unread customer notifications
   */
  public async getCustomerDashboardOverview(params: {
    userId: string;
    userLat?: number | undefined;
    userLng?: number | undefined;
  }): Promise<CustomerDashboardOverviewResponse> {
    if (!mongoose.Types.ObjectId.isValid(params.userId)) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const customerObjectId = new mongoose.Types.ObjectId(params.userId);

    // Auto-reconcile expired or overdue bookings before computing overview stats
    await this.reconcileBookingStatuses(customerObjectId);

    const visibleStatuses: CanonicalBookingStatus[] = [
      'Confirmed',
      'Active',
      'Completed',
      'Cancelled',
      'No Show',
      'Overstay',
    ];

    const [
      allCustomerBookings,
      registeredVehiclesCount,
      favouriteLocations,
      unreadNotificationsDocs,
      unreadNotificationCount,
    ] = await Promise.all([
      (BookingModel as mongoose.Model<Booking>)
        .find({
          customerId: customerObjectId,
          bookingStatus: { $in: visibleStatuses },
        })
        .sort({ scheduledEntryTime: -1, createdAt: -1 })
        .lean()
        .exec(),
      (VehicleModel as mongoose.Model<Vehicle>)
        .countDocuments({
          customerId: customerObjectId,
          vehicleStatus: 'Active',
        })
        .exec(),
      customerParkingService.getCustomerFavourites(params.userId, params.userLat, params.userLng),
      (NotificationModel as mongoose.Model<Notification>)
        .find({
          userId: customerObjectId,
          isRead: false,
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec(),
      (NotificationModel as mongoose.Model<Notification>)
        .countDocuments({
          userId: customerObjectId,
          isRead: false,
        })
        .exec(),
    ]);

    const typedBookings = allCustomerBookings as Array<
      Booking & { _id: mongoose.Types.ObjectId; createdAt?: Date; updatedAt?: Date }
    >;

    // 1. Compute real summary metrics
    let activeBookingsCount = 0;
    let upcomingBookingsCount = 0;
    let completedBookingsCount = 0;
    let cancelledBookingsCount = 0;
    let noShowBookingsCount = 0;
    let overstayBookingsCount = 0;
    let totalSpentAmount = 0;

    for (const b of typedBookings) {
      if (b.bookingStatus === 'Active') {
        activeBookingsCount += 1;
        totalSpentAmount += b.totalAmount || 0;
      } else if (b.bookingStatus === 'Overstay') {
        activeBookingsCount += 1;
        overstayBookingsCount += 1;
        totalSpentAmount += b.totalAmount || 0;
      } else if (b.bookingStatus === 'Confirmed') {
        upcomingBookingsCount += 1;
        totalSpentAmount += b.totalAmount || 0;
      } else if (b.bookingStatus === 'Completed') {
        completedBookingsCount += 1;
        totalSpentAmount += b.totalAmount || 0;
      } else if (b.bookingStatus === 'Cancelled') {
        cancelledBookingsCount += 1;
      } else if (b.bookingStatus === 'No Show') {
        noShowBookingsCount += 1;
      }
    }

    const bookingIds = typedBookings.map((b) => b._id);

    const digitalReceiptsCount =
      bookingIds.length > 0
        ? await (PaymentModel as mongoose.Model<Payment>)
          .countDocuments({
            bookingId: { $in: bookingIds },
            paymentTypeCode: 'BOOKING',
            paymentStatus: { $in: ['SUCCESSFUL', 'REFUNDED'] },
          })
          .exec()
        : 0;

    // 2. Identify Active Booking (Active or Overstay) & Next Upcoming Confirmed Booking
    const activeCandidates = typedBookings
      .filter((b) => b.bookingStatus === 'Active' || b.bookingStatus === 'Overstay')
      .sort((a, b) => {
        const aTime = a.actualEntryTime
          ? new Date(a.actualEntryTime).getTime()
          : new Date(a.scheduledEntryTime).getTime();
        const bTime = b.actualEntryTime
          ? new Date(b.actualEntryTime).getTime()
          : new Date(b.scheduledEntryTime).getTime();
        return bTime - aTime;
      });

    const nowMs = Date.now();
    const confirmedBookings = typedBookings.filter((b) => b.bookingStatus === 'Confirmed');
    const futureConfirmed = confirmedBookings
      .filter((b) => new Date(b.scheduledExitTime).getTime() >= nowMs)
      .sort(
        (a, b) =>
          new Date(a.scheduledEntryTime).getTime() - new Date(b.scheduledEntryTime).getTime(),
      );
    const upcomingCandidate =
      futureConfirmed[0] ??
      confirmedBookings.sort(
        (a, b) =>
          new Date(a.scheduledEntryTime).getTime() - new Date(b.scheduledEntryTime).getTime(),
      )[0] ??
      null;

    const toEnrich: Array<
      Booking & { _id: mongoose.Types.ObjectId; createdAt?: Date; updatedAt?: Date }
    > = [];
    if (activeCandidates[0]) toEnrich.push(activeCandidates[0]);
    if (
      upcomingCandidate &&
      (!activeCandidates[0] ||
        upcomingCandidate._id.toString() !== activeCandidates[0]._id.toString())
    ) {
      toEnrich.push(upcomingCandidate);
    }

    const enrichedFeatured = await this.enrichBookingsForCustomer(toEnrich);
    const activeBooking = activeCandidates[0]
      ? (enrichedFeatured.find((eb) => eb.bookingId === activeCandidates[0]!._id.toString()) ?? null)
      : null;
    const upcomingBooking = upcomingCandidate
      ? (enrichedFeatured.find((eb) => eb.bookingId === upcomingCandidate._id.toString()) ?? null)
      : null;

    // 3. Recent Activity from authoritative BookingTimeline records
    let recentActivity: CustomerBookingTimelineItem[] = [];
    if (bookingIds.length > 0) {
      const lotIds = Array.from(new Set(typedBookings.map((b) => b.parkingLotId.toString()))).map(
        (id) => new mongoose.Types.ObjectId(id),
      );
      const [timelineDocs, lots] = await Promise.all([
        (BookingTimelineModel as mongoose.Model<BookingTimeline>)
          .find({ bookingId: { $in: bookingIds } })
          .sort({ eventTime: -1, createdAt: -1 })
          .limit(8)
          .lean()
          .exec(),
        (ParkingLotModel as mongoose.Model<ParkingLot>)
          .find({ _id: { $in: lotIds } }, '_id parkingName')
          .lean()
          .exec(),
      ]);

      const lotNameById = new Map(lots.map((l) => [l._id.toString(), l.parkingName]));
      const bookingInfoById = new Map(
        typedBookings.map((b) => [
          b._id.toString(),
          {
            bookingReference: b.bookingReference,
            parkingName: lotNameById.get(b.parkingLotId.toString()) ?? 'Parking Facility',
          },
        ]),
      );

      recentActivity = timelineDocs.map((t) => {
        const info = bookingInfoById.get(t.bookingId.toString());
        return {
          _id: t._id.toString(),
          bookingId: t.bookingId.toString(),
          bookingReference: info?.bookingReference ?? 'N/A',
          parkingName: info?.parkingName ?? 'Parking Facility',
          eventCode: t.eventCode,
          eventType: t.eventType,
          eventTitle: t.eventTitle,
          eventDescription: t.eventDescription ?? null,
          eventSource: t.eventSource,
          eventTime: t.eventTime
            ? new Date(t.eventTime).toISOString()
            : new Date().toISOString(),
        };
      });
    }

    // 4. Real 6-Month Booking Activity Chart Data
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const nowDate = new Date();
    const chartMap = new Map<string, CustomerActivityChartPoint>();

    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      chartMap.set(key, {
        monthKey: key,
        label: `${monthNames[m]} ${y}`,
        totalBookings: 0,
        completedBookings: 0,
        activeOrUpcomingBookings: 0,
        cancelledOrNoShowBookings: 0,
        amountSpent: 0,
      });
    }

    for (const b of typedBookings) {
      // Use createdAt (or scheduledEntryTime) so newly created reservations for future dates are reflected in current activity
      const refDate = b.createdAt ? new Date(b.createdAt) : new Date(b.scheduledEntryTime);
      const y = refDate.getFullYear();
      const m = refDate.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;

      if (!chartMap.has(key)) {
        chartMap.set(key, {
          monthKey: key,
          label: `${monthNames[m]} ${y}`,
          totalBookings: 0,
          completedBookings: 0,
          activeOrUpcomingBookings: 0,
          cancelledOrNoShowBookings: 0,
          amountSpent: 0,
        });
      }

      const pt = chartMap.get(key)!;
      pt.totalBookings += 1;
      if (b.bookingStatus === 'Completed') {
        pt.completedBookings += 1;
        pt.amountSpent += b.totalAmount || 0;
      } else if (
        b.bookingStatus === 'Confirmed' ||
        b.bookingStatus === 'Active' ||
        b.bookingStatus === 'Overstay'
      ) {
        pt.activeOrUpcomingBookings += 1;
        pt.amountSpent += b.totalAmount || 0;
      } else if (b.bookingStatus === 'Cancelled' || b.bookingStatus === 'No Show') {
        pt.cancelledOrNoShowBookings += 1;
      }
    }

    const sortedPoints = Array.from(chartMap.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .slice(-6);

    const unreadNotifications = unreadNotificationsDocs.map((n) => ({
      _id: n._id.toString(),
      notificationReference: n.notificationReference,
      bookingId: n.bookingId ? n.bookingId.toString() : null,
      notificationType: n.notificationType,
      eventType: n.eventType,
      title: n.title,
      message: n.message,
      priority: n.priority,
      isRead: Boolean(n.isRead),
      actionUrl: n.actionUrl ?? null,
      createdAt: n.createdAt
        ? new Date(n.createdAt).toISOString()
        : new Date().toISOString(),
    }));

    return {
      stats: {
        activeBookingsCount,
        upcomingBookingsCount,
        completedBookingsCount,
        cancelledBookingsCount,
        noShowBookingsCount,
        overstayBookingsCount,
        totalBookingsCount: typedBookings.length,
        registeredVehiclesCount,
        digitalReceiptsCount,
        totalSpentAmount,
      },
      activeBooking,
      upcomingBooking,
      recentActivity,
      activityChart: {
        hasActivityData: typedBookings.length > 0,
        points: sortedPoints,
      },
      favouriteLocations,
      unreadNotifications,
      unreadNotificationCount,
    };
  }
}

export const customerBookingService = new CustomerBookingService();
