import mongoose from 'mongoose';
import { BookingModel, type Booking } from '../models/Booking.js';
import { BookingTimelineModel } from '../models/BookingTimeline.js';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { ParkingSlotModel, type ParkingSlot } from '../models/ParkingSlot.js';
import { UserModel, type User } from '../models/User.js';
import { VehicleModel, type Vehicle } from '../models/Vehicle.js';
import { PaymentModel, type Payment } from '../models/Payment.js';
import { VehicleMovementLogModel } from '../models/VehicleMovementLog.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { NotificationModel } from '../models/Notification.js';
import { customerBookingService } from './customerBooking.service.js';
import { emailService } from './email.service.js';
import { emitBookingStatusUpdate, emitSlotStatusUpdate } from '../socket.js';
import { AppError } from '../utils/AppError.js';

export interface AdminBookingOverview {
  totalBookings: number;
  confirmedBookings: number;
  activeBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  overstayBookings: number;
  totalRevenue: number;
  totalRefunded: number;
}

export interface AdminBookingQueryParams {
  search?: string | undefined;
  status?: string | undefined;
  parkingLotId?: string | undefined;
  ownerId?: string | undefined;
  customerId?: string | undefined;
  paymentStatus?: string | undefined;
  bookingType?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number | string | undefined;
  limit?: number | string | undefined;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

export interface AdminLiveVehicleQueryParams {
  search?: string | undefined;
  parkingLotId?: string | undefined;
  floorId?: string | undefined;
  vehicleType?: string | undefined;
  status?: 'ALL' | 'Inside Parking' | 'Overstayed' | undefined;
  duration?: '< 1 Hour' | '1-3 Hours' | '3-6 Hours' | '> 6 Hours' | 'Overnight' | undefined;
  page?: number | string | undefined;
  limit?: number | string | undefined;
}

export interface AdminLiveVehicleOverview {
  vehiclesCurrentlyInside: number;
  vehiclesEnteredToday: number;
  vehiclesExitedToday: number;
  averageParkingDurationMinutes: number;
  longestParkedVehicle: {
    vehicleNumber: string;
    entryTime: Date | null;
    durationMinutes: number;
    parkingName: string;
    slotNumber: string;
  } | null;
  availableSlots: number;
  occupiedSlots: number;
  overstayedVehicles: number;
}

class AdminOperationsService {
  /**
   * 1. Get Platform-wide Booking Overview KPI Counters
   */
  public async getBookingOverview(): Promise<AdminBookingOverview> {
    try {
      await customerBookingService.reconcileBookingStatuses();
    } catch (e) {
      console.warn('Booking reconciliation warning in getBookingOverview:', e);
    }

    const [statusCounts, revenueAgg, refundAgg] = await Promise.all([
      (BookingModel as mongoose.Model<Booking>).aggregate([
        {
          $group: {
            _id: '$bookingStatus',
            count: { $sum: 1 },
          },
        },
      ]),
      (PaymentModel as mongoose.Model<Payment>).aggregate([
        {
          $match: {
            paymentStatus: { $in: ['SUCCESSFUL', 'REFUNDED'] },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
          },
        },
      ]),
      (BookingModel as mongoose.Model<Booking>).aggregate([
        {
          $match: {
            bookingStatus: 'Cancelled',
            refundAmount: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalRefunded: { $sum: '$refundAmount' },
          },
        },
      ]),
    ]);

    const counts: Record<string, number> = {};
    let totalBookings = 0;
    for (const item of statusCounts) {
      counts[item._id] = item.count;
      totalBookings += item.count;
    }

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const totalRefunded = refundAgg[0]?.totalRefunded || 0;

    return {
      totalBookings,
      confirmedBookings: counts['Confirmed'] || 0,
      activeBookings: counts['Active'] || 0,
      completedBookings: counts['Completed'] || 0,
      cancelledBookings: counts['Cancelled'] || 0,
      overstayBookings: counts['Overstay'] || 0,
      totalRevenue,
      totalRefunded,
    };
  }

  /**
   * 2. Query Platform-wide Bookings with Multi-Criteria Filters & Search
   */
  public async getBookings(params: AdminBookingQueryParams): Promise<{
    bookings: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      await customerBookingService.reconcileBookingStatuses();
    } catch (e) {
      console.warn('Reconcile warning in getBookings:', e);
    }

    const filter: Record<string, any> = {};

    // Status filter
    if (params.status && params.status !== 'ALL') {
      filter.bookingStatus = params.status;
    }

    // Parking Lot filter
    if (params.parkingLotId && params.parkingLotId !== 'ALL' && mongoose.isValidObjectId(params.parkingLotId)) {
      filter.parkingLotId = new mongoose.Types.ObjectId(params.parkingLotId);
    }

    // Owner filter (match lots owned by this owner)
    if (params.ownerId && params.ownerId !== 'ALL' && mongoose.isValidObjectId(params.ownerId)) {
      const ownerLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
        .find({ ownerId: new mongoose.Types.ObjectId(params.ownerId) })
        .select('_id')
        .lean();
      const lotIds = ownerLots.map((l) => l._id);
      filter.parkingLotId = { $in: lotIds };
    }

    // Customer filter
    if (params.customerId && params.customerId !== 'ALL' && mongoose.isValidObjectId(params.customerId)) {
      filter.customerId = new mongoose.Types.ObjectId(params.customerId);
    }

    // Booking Type filter
    if (params.bookingType && params.bookingType !== 'ALL') {
      filter.bookingType = params.bookingType;
    }

    // Date range filter
    if (params.dateFrom || params.dateTo) {
      filter.createdAt = {};
      if (params.dateFrom) {
        filter.createdAt.$gte = new Date(params.dateFrom);
      }
      if (params.dateTo) {
        const toDate = new Date(params.dateTo);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    // Payment status filter (via PaymentModel lookup)
    if (params.paymentStatus && params.paymentStatus !== 'ALL') {
      const matchingPayments = await (PaymentModel as any)
        .find({ paymentStatus: params.paymentStatus })
        .select('bookingId')
        .lean();
      const bookingIdsWithStatus = matchingPayments
        .map((p: any) => p.bookingId)
        .filter((id: any): id is mongoose.Types.ObjectId => Boolean(id));

      if (filter._id) {
        filter._id = { $in: bookingIdsWithStatus, ...filter._id };
      } else {
        filter._id = { $in: bookingIdsWithStatus };
      }
    }

    // Search filter across reference, vehicle plate, customer name, email, phone
    if (params.search && params.search.trim()) {
      const searchRegex = new RegExp(params.search.trim(), 'i');

      const [matchingUsers, matchingVehicles] = await Promise.all([
        (UserModel as mongoose.Model<User>)
          .find({
            $or: [
              { fullName: searchRegex },
              { email: searchRegex },
              { mobileNumber: searchRegex },
            ],
          })
          .select('_id')
          .lean(),
        (VehicleModel as mongoose.Model<Vehicle>)
          .find({ vehicleNumber: searchRegex })
          .select('_id')
          .lean(),
      ]);

      const matchingUserIds = matchingUsers.map((u) => u._id);
      const matchingVehicleIds = matchingVehicles.map((v) => v._id);

      const searchConditions: any[] = [{ bookingReference: searchRegex }];

      if (matchingVehicleIds.length > 0) {
        searchConditions.push({ vehicleId: { $in: matchingVehicleIds } });
      }

      if (matchingUserIds.length > 0) {
        searchConditions.push({ customerId: { $in: matchingUserIds } });
      }

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const sortField = params.sortBy || 'createdAt';
    const sortDirection = params.sortOrder === 'asc' ? 1 : -1;
    const sortOption: Record<string, any> = { [sortField]: sortDirection };

    const [bookings, total] = await Promise.all([
      (BookingModel as mongoose.Model<Booking>)
        .find(filter)
        .populate('customerId', 'fullName email mobileNumber')
        .populate('parkingLotId', 'parkingName address city ownerId')
        .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel vehicleColor')
        .populate('currentSlotId', 'slotNumber slotLabel')
        .populate('floorId', 'floorName')
        .populate('zoneId', 'zoneName zoneCode')
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      (BookingModel as mongoose.Model<Booking>).countDocuments(filter),
    ]);

    // Attach payment info and cancellation eligibility to each booking
    const bookingIds = bookings.map((b) => b._id);
    const payments = await (PaymentModel as any)
      .find({ bookingId: { $in: bookingIds } })
      .lean();

    const paymentMap = new Map<string, any>();
    for (const p of payments) {
      if (p.bookingId) {
        paymentMap.set(p.bookingId.toString(), p);
      }
    }

    const enrichedBookings = bookings.map((b: any) => {
      const payment = paymentMap.get(b._id.toString()) || null;

      // Determine backend cancellation eligibility
      let isCancellable = false;
      let ineligibilityReason: string | undefined;

      if (b.bookingStatus === 'Cancelled') {
        ineligibilityReason = 'Booking is already cancelled.';
      } else if (b.bookingStatus === 'Completed') {
        ineligibilityReason = 'Completed bookings cannot be cancelled.';
      } else if (b.bookingStatus === 'No Show') {
        ineligibilityReason = 'No-show reservations have expired and cannot be cancelled.';
      } else if (b.bookingStatus === 'Active' && b.actualEntryTime) {
        ineligibilityReason = 'Vehicle is currently inside the parking facility. Must complete exit verification.';
      } else if (b.bookingStatus === 'Overstay') {
        ineligibilityReason = 'Vehicle is currently in overstay state. Must settle charges at gate before exit.';
      } else if (b.bookingStatus === 'Confirmed') {
        isCancellable = true;
      } else {
        ineligibilityReason = `Booking status '${b.bookingStatus}' does not permit cancellation.`;
      }

      const vehicleNumber = b.vehicleId?.vehicleNumber || b.vehicleNumber || 'Unknown';
      const vehicleType = b.vehicleId?.vehicleType || b.vehicleType || 'Car';

      return {
        ...b,
        vehicleNumber,
        vehicleType,
        payment,
        cancellableByAdmin: isCancellable,
        ineligibilityReason,
      };
    });

    return {
      bookings: enrichedBookings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 3. Get Single Booking Full Dossier
   */
  public async getBookingById(bookingId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new AppError('Invalid booking ID format.', 400, 'INVALID_BOOKING_ID');
    }

    const booking = await (BookingModel as mongoose.Model<Booking>)
      .findById(bookingId)
      .populate('customerId', 'fullName email mobileNumber accountStatus')
      .populate('parkingLotId', 'parkingName address city state postalCode contactNumber supportEmail ownerId')
      .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel vehicleColor')
      .populate('currentSlotId', 'slotNumber slotLabel slotType vehicleType slotStatus')
      .populate('floorId', 'floorName floorNumber')
      .populate('zoneId', 'zoneName zoneCode')
      .lean()
      .exec();

    if (!booking) {
      throw new AppError('Booking record not found.', 404, 'BOOKING_NOT_FOUND');
    }

    const [payments, timeline, movementLogs, ownerUser] = await Promise.all([
      (PaymentModel as any).find({ bookingId: booking._id }).lean(),
      (BookingTimelineModel as any)
        .find({ bookingId: booking._id })
        .populate('performedBy', 'fullName role')
        .sort({ eventTime: 1 })
        .lean(),
      (VehicleMovementLogModel as any)
        .find({ bookingId: booking._id })
        .populate('verifiedBy', 'fullName employeeId')
        .populate('exitVerifiedBy', 'fullName employeeId')
        .sort({ entryTime: -1 })
        .lean(),
      (booking.parkingLotId as any)?.ownerId
        ? (UserModel as mongoose.Model<User>)
            .findById((booking.parkingLotId as any).ownerId)
            .select('fullName email mobileNumber businessName')
            .lean()
        : null,
    ]);

    // Cancellation eligibility calculation
    let isCancellable = false;
    let ineligibilityReason: string | undefined;

    if (booking.bookingStatus === 'Cancelled') {
      ineligibilityReason = 'Booking is already cancelled.';
    } else if (booking.bookingStatus === 'Completed') {
      ineligibilityReason = 'Completed bookings cannot be cancelled.';
    } else if (booking.bookingStatus === 'No Show') {
      ineligibilityReason = 'No-show reservations have expired.';
    } else if (booking.bookingStatus === 'Active' && booking.actualEntryTime) {
      ineligibilityReason = 'Vehicle is currently inside facility. Complete gate exit verification first.';
    } else if (booking.bookingStatus === 'Overstay') {
      ineligibilityReason = 'Vehicle has overstayed. Outstanding barrier charges must be reconciled.';
    } else if (booking.bookingStatus === 'Confirmed') {
      isCancellable = true;
    }

    const vehicleNumber = (booking.vehicleId as any)?.vehicleNumber || 'Unknown';
    const vehicleType = (booking.vehicleId as any)?.vehicleType || 'Car';

    return {
      booking: {
        ...booking,
        vehicleNumber,
        vehicleType,
      },
      owner: ownerUser,
      payments,
      timeline,
      movementLogs,
      cancellableByAdmin: isCancellable,
      ineligibilityReason,
    };
  }

  /**
   * 4. Cancel Booking (Administrator-Authoritative Workflow with Centralized Refund)
   */
  public async cancelBooking(
    bookingId: string,
    payload: { reason: string },
    adminUserId: string,
    context?: { ipAddress?: string | undefined; userAgent?: string | undefined },
  ): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const reason = (payload.reason || '').trim();
    if (!reason || reason.length < 5) {
      throw new AppError(
        'A mandatory administrative reason of at least 5 characters must be provided.',
        400,
        'CANCELLATION_REASON_REQUIRED',
      );
    }

    const session = await mongoose.startSession();
    let updatedBookingDoc: any = null;
    let refundAmount = 0;
    let refundStatus = 'No Refund Applicable';
    let paymentMethod = 'N/A';
    let lotIdStr = '';
    let floorIdStr = '';
    let zoneIdStr = '';
    let customerIdStr = '';
    let customerName = 'Customer';
    let customerEmail = '';

    try {
      await session.withTransaction(async () => {
        const booking = await (BookingModel as mongoose.Model<Booking>)
          .findById(bookingId)
          .session(session)
          .exec();

        if (!booking) {
          throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
        }

        if (booking.bookingStatus === 'Cancelled') {
          throw new AppError('Booking is already cancelled.', 409, 'BOOKING_ALREADY_CANCELLED');
        }

        if (booking.bookingStatus === 'Completed') {
          throw new AppError('Completed bookings cannot be cancelled.', 409, 'BOOKING_ALREADY_COMPLETED');
        }

        if (booking.bookingStatus === 'Active' && booking.actualEntryTime) {
          throw new AppError(
            'Cannot cancel in-progress booking: vehicle is currently parked inside the facility.',
            409,
            'CANNOT_CANCEL_ACTIVE_IN_PROGRESS_BOOKING',
          );
        }

        lotIdStr = booking.parkingLotId.toString();
        floorIdStr = booking.floorId?.toString() || '';
        zoneIdStr = booking.zoneId?.toString() || '';
        customerIdStr = booking.customerId.toString();

        booking.bookingStatus = 'Cancelled';
        booking.cancellationBy = 'Administrator';
        booking.cancellationReason = reason;

        // Process refund according to centralized rules
        const payment = await (PaymentModel as mongoose.Model<Payment>)
          .findOne({ bookingId: booking._id, paymentStatus: 'SUCCESSFUL' })
          .session(session)
          .exec();

        if (payment) {
          paymentMethod = payment.paymentMethod;
          refundAmount = booking.totalAmount || payment.amount || 0;
          booking.refundAmount = refundAmount;
          payment.refundAmount = refundAmount;
          payment.refundDate = new Date();
          payment.refunds = payment.refunds || [];

          if (payment.paymentMethod === 'RAZORPAY') {
            refundStatus = 'Refund Completed';
            payment.paymentStatus = 'REFUNDED';
            payment.refunds.push({
              refundReference: `REF-ADM-${Date.now().toString(36).toUpperCase()}`,
              refundAmount,
              refundStatus: 'Refund Completed',
              refundReason: reason,
              initiatedAt: new Date(),
              completedAt: new Date(),
              initiatedBy: new mongoose.Types.ObjectId(adminUserId),
              remarks: 'Administrator centralized cancellation refund',
            } as any);
          } else {
            // CASH / WALK-IN
            refundStatus = 'Cash Reversal Pending';
            payment.paymentStatus = 'CASH_REVERSAL_PENDING';
            payment.refunds.push({
              refundReference: `CASH-REV-ADM-${Date.now().toString(36).toUpperCase()}`,
              refundAmount,
              refundStatus: 'Refund Pending',
              refundReason: reason,
              initiatedAt: new Date(),
              initiatedBy: new mongoose.Types.ObjectId(adminUserId),
              remarks: 'Cash reversal pending for walk-in booking',
            } as any);
          }

          await payment.save({ session });
        }

        await booking.save({ session });
        updatedBookingDoc = booking;

        // Release slot if currently held
        if (booking.currentSlotId) {
          const slot = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
            .findById(booking.currentSlotId)
            .session(session)
            .exec();

          if (slot) {
            const isHeld =
              slot.currentBookingId?.toString() === booking._id.toString() ||
              (slot.slotStatus === 'Reserved' && !slot.currentBookingId);

            if (isHeld && slot.slotStatus !== 'Under Maintenance') {
              slot.slotStatus = 'Available';
              slot.currentBookingId = null;
              await slot.save({ session });
            }
          }
        }

        // Record Timeline Event
        await (BookingTimelineModel as any).create(
          [
            {
              bookingId: booking._id,
              performedBy: new mongoose.Types.ObjectId(adminUserId),
              eventCode: 'BOOKING_CANCELLED',
              eventType: 'Booking Cancelled',
              eventTitle: 'Booking Cancelled by Administrator',
              eventDescription: reason,
              eventSource: 'Admin',
              eventTime: new Date(),
              metadata: {
                operationalReason: reason,
                refundAmount,
                refundStatus,
                cancelledBy: 'Administrator',
              },
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    // Post-transaction actions
    if (lotIdStr && floorIdStr && zoneIdStr) {
      try {
        await customerBookingService.reconcileHierarchyCounters({
          parkingLotId: new mongoose.Types.ObjectId(lotIdStr),
          floorId: new mongoose.Types.ObjectId(floorIdStr),
          zoneId: new mongoose.Types.ObjectId(zoneIdStr),
        });
      } catch (recErr) {
        console.warn('Reconcile hierarchy counters warning:', recErr);
      }
    }

    const [customer, lot, slot] = await Promise.all([
      (UserModel as mongoose.Model<User>).findById(customerIdStr).select('fullName email').lean(),
      (ParkingLotModel as mongoose.Model<ParkingLot>).findById(lotIdStr).select('parkingName').lean(),
      updatedBookingDoc.currentSlotId
        ? (ParkingSlotModel as mongoose.Model<ParkingSlot>).findById(updatedBookingDoc.currentSlotId).select('slotNumber').lean()
        : null,
    ]);

    if (customer) {
      customerName = customer.fullName;
      customerEmail = customer.email;
    }

    const parkingName = lot?.parkingName || 'Parking Facility';
    const slotNumber = slot?.slotNumber || 'Allocated Bay';

    // In-app Notification
    try {
      await NotificationModel.create({
        notificationReference: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        userId: new mongoose.Types.ObjectId(customerIdStr),
        senderId: new mongoose.Types.ObjectId(adminUserId),
        bookingId: updatedBookingDoc._id,
        title: 'Booking Cancelled by Administrator',
        message: `Your booking (${updatedBookingDoc.bookingReference}) at ${parkingName} has been cancelled by an administrator. Reason: ${reason}. Refund: ₹${refundAmount.toFixed(2)} (${refundStatus}).`,
        notificationType: 'Booking',
        eventType: 'Booking Cancelled',
        priority: 'High',
        deliveryChannel: 'In-App',
        deliveryStatus: 'Delivered',
        actionUrl: '/customer/bookings',
      });
    } catch (notifErr) {
      console.warn('Notification creation warning:', notifErr);
    }

    // Email Notification
    if (customerEmail) {
      try {
        await emailService.sendBookingCancelledEmail({
          to: customerEmail,
          customerName,
          bookingReference: updatedBookingDoc.bookingReference,
          parkingName,
          slotNumber,
          cancellationReason: reason,
          cancelledBy: 'Administrator',
          refundAmount,
          paymentMethod,
          refundStatus,
        });
      } catch (mailErr) {
        console.warn('Cancellation email dispatch warning:', mailErr);
      }
    }

    // System Audit Log
    try {
      await AuditLogModel.create({
        actionCode: 'BOOKING_CANCELLED',
        actionTitle: 'Booking Cancelled by Administrator',
        module: 'Booking Management',
        targetCollection: 'bookings',
        targetDocumentId: updatedBookingDoc._id,
        bookingId: updatedBookingDoc._id,
        parkingLotId: new mongoose.Types.ObjectId(lotIdStr),
        userId: new mongoose.Types.ObjectId(adminUserId),
        description: `Administrator cancelled booking ${updatedBookingDoc.bookingReference}. Reason: ${reason}. Refund Amount: ₹${refundAmount}.`,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: {
          bookingReference: updatedBookingDoc.bookingReference,
          refundAmount,
          refundStatus,
          reason,
        },
      });
    } catch (auditErr) {
      console.warn('AuditLog creation warning:', auditErr);
    }

    // Real-time Socket.IO broadcasts
    emitBookingStatusUpdate({
      bookingId: updatedBookingDoc._id.toString(),
      bookingReference: updatedBookingDoc.bookingReference,
      parkingLotId: lotIdStr,
      customerId: customerIdStr,
      bookingStatus: 'Cancelled',
      paymentStatus: refundStatus,
      timestamp: new Date().toISOString(),
    });

    if (updatedBookingDoc.currentSlotId) {
      emitSlotStatusUpdate({
        parkingLotId: lotIdStr,
        floorId: floorIdStr,
        zoneId: zoneIdStr,
        slotId: updatedBookingDoc.currentSlotId.toString(),
        slotNumber,
        slotStatus: 'Available',
        remarks: 'Released via administrator cancellation',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      message: 'Booking cancelled successfully and refund processed.',
      booking: updatedBookingDoc,
      refundAmount,
      refundStatus,
    };
  }

  /**
   * 5. Get Cancellation Details for Cancelled Booking
   */
  public async getBookingCancellationDetails(bookingId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const booking = await (BookingModel as mongoose.Model<Booking>)
      .findById(bookingId)
      .populate('parkingLotId', 'parkingName address city')
      .populate('customerId', 'fullName email mobileNumber')
      .lean()
      .exec();

    if (!booking) {
      throw new AppError('Booking record not found.', 404, 'BOOKING_NOT_FOUND');
    }

    const payment = await (PaymentModel as any)
      .findOne({ bookingId: booking._id })
      .lean();

    const cancellationTimeline = await (BookingTimelineModel as any)
      .findOne({ bookingId: booking._id, eventCode: 'BOOKING_CANCELLED' })
      .populate('performedBy', 'fullName role')
      .sort({ eventTime: -1 })
      .lean();

    return {
      bookingId: booking._id,
      bookingReference: booking.bookingReference,
      parkingLot: booking.parkingLotId,
      customer: booking.customerId,
      bookingStatus: booking.bookingStatus,
      cancellationBy: booking.cancellationBy || cancellationTimeline?.eventSource || 'N/A',
      cancellationReason: booking.cancellationReason || cancellationTimeline?.eventDescription || 'No reason provided',
      cancelledAt: cancellationTimeline?.eventTime || booking.updatedAt,
      refundAmount: booking.refundAmount || payment?.refundAmount || 0,
      paymentMethod: payment?.paymentMethod || 'N/A',
      paymentStatus: payment?.paymentStatus || 'N/A',
      refunds: payment?.refunds || [],
    };
  }

  /**
   * 6. Live Vehicle Locator Overview (8 KPI Cards)
   */
  public async getLiveVehiclesOverview(): Promise<AdminLiveVehicleOverview> {
    try {
      await customerBookingService.reconcileBookingStatuses();
    } catch (e) {
      console.warn('Reconcile warning in getLiveVehiclesOverview:', e);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      vehiclesInsideList,
      enteredTodayCount,
      exitedTodayCount,
      slotCounts,
      overstayCount,
    ] = await Promise.all([
      // 1. Vehicles currently inside
      (BookingModel as mongoose.Model<Booking>)
        .find({
          bookingStatus: { $in: ['Active', 'Overstay'] },
          actualEntryTime: { $exists: true, $ne: null },
          actualExitTime: null,
        })
        .populate('parkingLotId', 'parkingName')
        .populate('currentSlotId', 'slotNumber')
        .populate('vehicleId', 'vehicleNumber')
        .sort({ actualEntryTime: 1 })
        .lean()
        .exec(),

      // 2. Vehicles entered today
      (VehicleMovementLogModel as any).countDocuments({
        entryTime: { $gte: todayStart },
      }),

      // 3. Vehicles exited today
      (VehicleMovementLogModel as any).countDocuments({
        exitTime: { $gte: todayStart, $ne: null },
      }),

      // 4. Slots availability & occupancy
      (ParkingSlotModel as mongoose.Model<ParkingSlot>).aggregate([
        {
          $group: {
            _id: '$slotStatus',
            count: { $sum: 1 },
          },
        },
      ]),

      // 5. Overstay count
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        bookingStatus: 'Overstay',
        actualExitTime: null,
      }),
    ]);

    const vehiclesCurrentlyInside = vehiclesInsideList.length;

    // Calculate Average Duration & Longest Parked
    let totalDurationMinutes = 0;
    const now = Date.now();

    for (const v of vehiclesInsideList) {
      if (v.actualEntryTime) {
        const diffMins = Math.max(0, Math.floor((now - new Date(v.actualEntryTime).getTime()) / 60000));
        totalDurationMinutes += diffMins;
      }
    }

    const averageParkingDurationMinutes =
      vehiclesCurrentlyInside > 0 ? Math.round(totalDurationMinutes / vehiclesCurrentlyInside) : 0;

    let longestParkedVehicle: AdminLiveVehicleOverview['longestParkedVehicle'] = null;
    const longest = vehiclesInsideList[0];
    if (longest && longest.actualEntryTime) {
      const entryTime = new Date(longest.actualEntryTime);
      const diffMins = Math.max(0, Math.floor((now - entryTime.getTime()) / 60000));
      longestParkedVehicle = {
        vehicleNumber: (longest.vehicleId as any)?.vehicleNumber || 'Unknown',
        entryTime,
        durationMinutes: diffMins,
        parkingName: (longest.parkingLotId as any)?.parkingName || 'Parking Lot',
        slotNumber: (longest.currentSlotId as any)?.slotNumber || 'Bay',
      };
    }

    const slotMap: Record<string, number> = {};
    for (const item of slotCounts) {
      slotMap[item._id] = item.count;
    }

    return {
      vehiclesCurrentlyInside,
      vehiclesEnteredToday: enteredTodayCount,
      vehiclesExitedToday: exitedTodayCount,
      averageParkingDurationMinutes,
      longestParkedVehicle,
      availableSlots: slotMap['Available'] || 0,
      occupiedSlots: slotMap['Occupied'] || 0,
      overstayedVehicles: overstayCount,
    };
  }

  /**
   * 7. Query Live Vehicles Currently Inside Parking Facilities
   */
  public async getLiveVehicles(params: AdminLiveVehicleQueryParams): Promise<{
    vehicles: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      await customerBookingService.reconcileBookingStatuses();
    } catch (e) {
      console.warn('Reconcile warning in getLiveVehicles:', e);
    }

    const filter: Record<string, any> = {
      bookingStatus: { $in: ['Active', 'Overstay'] },
      actualEntryTime: { $exists: true, $ne: null },
      actualExitTime: null,
    };

    if (params.status === 'Overstayed') {
      filter.bookingStatus = 'Overstay';
    } else if (params.status === 'Inside Parking') {
      filter.bookingStatus = 'Active';
    }

    if (params.parkingLotId && params.parkingLotId !== 'ALL' && mongoose.isValidObjectId(params.parkingLotId)) {
      filter.parkingLotId = new mongoose.Types.ObjectId(params.parkingLotId);
    }

    if (params.floorId && params.floorId !== 'ALL' && mongoose.isValidObjectId(params.floorId)) {
      filter.floorId = new mongoose.Types.ObjectId(params.floorId);
    }

    if (params.search && params.search.trim()) {
      const searchRegex = new RegExp(params.search.trim(), 'i');

      const [matchingUsers, matchingVehicles] = await Promise.all([
        (UserModel as mongoose.Model<User>)
          .find({
            $or: [
              { fullName: searchRegex },
              { email: searchRegex },
              { mobileNumber: searchRegex },
            ],
          })
          .select('_id')
          .lean(),
        (VehicleModel as mongoose.Model<Vehicle>)
          .find({ vehicleNumber: searchRegex })
          .select('_id')
          .lean(),
      ]);

      const userIds = matchingUsers.map((u) => u._id);
      const vehicleIds = matchingVehicles.map((v) => v._id);

      const orConds: any[] = [{ bookingReference: searchRegex }];

      if (vehicleIds.length > 0) {
        orConds.push({ vehicleId: { $in: vehicleIds } });
      }

      if (userIds.length > 0) {
        orConds.push({ customerId: { $in: userIds } });
      }

      filter.$or = orConds;
    }

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      (BookingModel as mongoose.Model<Booking>)
        .find(filter)
        .populate('customerId', 'fullName email mobileNumber')
        .populate('parkingLotId', 'parkingName address city')
        .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel vehicleColor')
        .populate('currentSlotId', 'slotNumber slotLabel slotStatus')
        .populate('floorId', 'floorName')
        .populate('zoneId', 'zoneName zoneCode')
        .sort({ actualEntryTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      (BookingModel as mongoose.Model<Booking>).countDocuments(filter),
    ]);

    // Attach live duration, remaining time, payment status, and security staff
    const bookingIds = bookings.map((b) => b._id);
    const [payments, movementLogs] = await Promise.all([
      (PaymentModel as any).find({ bookingId: { $in: bookingIds } }).lean(),
      (VehicleMovementLogModel as any)
        .find({ bookingId: { $in: bookingIds } })
        .populate('verifiedBy', 'fullName employeeId')
        .lean(),
    ]);

    const paymentMap = new Map<string, any>();
    for (const p of payments) {
      if (p.bookingId) paymentMap.set(p.bookingId.toString(), p);
    }

    const movementMap = new Map<string, any>();
    for (const m of movementLogs) {
      if (m.bookingId) movementMap.set(m.bookingId.toString(), m);
    }

    const now = Date.now();

    const liveVehicles = bookings.map((b: any) => {
      const payment = paymentMap.get(b._id.toString()) || null;
      const movement = movementMap.get(b._id.toString()) || null;

      const entryTime = b.actualEntryTime ? new Date(b.actualEntryTime) : new Date(b.scheduledEntryTime);
      const scheduledExit = new Date(b.scheduledExitTime);

      const durationMinutes = Math.max(0, Math.floor((now - entryTime.getTime()) / 60000));
      const remainingMinutes = Math.floor((scheduledExit.getTime() - now) / 60000);

      const isOverstay = b.bookingStatus === 'Overstay' || remainingMinutes < 0;
      const overstayMinutes = isOverstay ? Math.max(b.overstayDurationMinutes || 1, Math.abs(remainingMinutes)) : 0;

      const trackingStatus = isOverstay ? 'Overstayed' : 'Inside Parking';
      const vehicleNumber = b.vehicleId?.vehicleNumber || 'Unknown';
      const vehicleType = b.vehicleId?.vehicleType || 'Car';

      return {
        _id: b._id,
        bookingId: b._id,
        bookingReference: b.bookingReference,
        bookingType: b.bookingType,
        vehicleNumber,
        vehicleType,
        customer: b.customerId,
        parkingLot: b.parkingLotId,
        slot: b.currentSlotId,
        floor: b.floorId,
        zone: b.zoneId,
        entryTime,
        scheduledExitTime: scheduledExit,
        liveDurationMinutes: durationMinutes,
        remainingMinutes,
        isOverstay,
        overstayMinutes,
        trackingStatus,
        bookingStatus: b.bookingStatus,
        paymentStatus: payment?.paymentStatus || 'PENDING',
        securityStaff: movement?.verifiedBy || null,
      };
    });

    // Optional Duration filter
    let filteredList = liveVehicles;
    if (params.duration) {
      if (params.duration === '< 1 Hour') {
        filteredList = liveVehicles.filter((v) => v.liveDurationMinutes < 60);
      } else if (params.duration === '1-3 Hours') {
        filteredList = liveVehicles.filter((v) => v.liveDurationMinutes >= 60 && v.liveDurationMinutes <= 180);
      } else if (params.duration === '3-6 Hours') {
        filteredList = liveVehicles.filter((v) => v.liveDurationMinutes > 180 && v.liveDurationMinutes <= 360);
      } else if (params.duration === '> 6 Hours') {
        filteredList = liveVehicles.filter((v) => v.liveDurationMinutes > 360 && v.liveDurationMinutes < 720);
      } else if (params.duration === 'Overnight') {
        filteredList = liveVehicles.filter((v) => v.liveDurationMinutes >= 720);
      }
    }

    return {
      vehicles: filteredList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 8. Get Single Live Vehicle Deep Inspection Dossier
   */
  public async getLiveVehicleDetails(bookingId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    const booking = await (BookingModel as mongoose.Model<Booking>)
      .findById(bookingId)
      .populate('customerId', 'fullName email mobileNumber')
      .populate('parkingLotId', 'parkingName address city state contactNumber')
      .populate('vehicleId', 'vehicleNumber vehicleType vehicleBrand vehicleModel vehicleColor')
      .populate('currentSlotId', 'slotNumber slotLabel slotType slotStatus')
      .populate('floorId', 'floorName floorNumber')
      .populate('zoneId', 'zoneName zoneCode')
      .lean()
      .exec();

    if (!booking) {
      throw new AppError('Live vehicle booking record not found.', 404, 'RECORD_NOT_FOUND');
    }

    const [payment, movements, timeline] = await Promise.all([
      (PaymentModel as any).findOne({ bookingId: booking._id }).lean(),
      (VehicleMovementLogModel as any)
        .find({ bookingId: booking._id })
        .populate('verifiedBy', 'fullName employeeId')
        .populate('exitVerifiedBy', 'fullName employeeId')
        .sort({ entryTime: -1 })
        .lean(),
      (BookingTimelineModel as any)
        .find({ bookingId: booking._id })
        .populate('performedBy', 'fullName role')
        .sort({ eventTime: 1 })
        .lean(),
    ]);

    const now = Date.now();
    const entryTime = booking.actualEntryTime ? new Date(booking.actualEntryTime) : new Date(booking.scheduledEntryTime);
    const scheduledExit = new Date(booking.scheduledExitTime);
    const liveDurationMinutes = Math.max(0, Math.floor((now - entryTime.getTime()) / 60000));
    const remainingMinutes = Math.floor((scheduledExit.getTime() - now) / 60000);
    const isOverstay = booking.bookingStatus === 'Overstay' || remainingMinutes < 0;

    const entryMovement = movements.find((m: any) => m.movementType === 'ENTRY') || movements[0];

    return {
      booking: {
        ...booking,
        vehicleNumber: (booking.vehicleId as any)?.vehicleNumber || 'Unknown',
        vehicleType: (booking.vehicleId as any)?.vehicleType || 'Car',
      },
      customer: booking.customerId,
      parkingLot: booking.parkingLotId,
      bayLocation: {
        slot: booking.currentSlotId,
        floor: booking.floorId,
        zone: booking.zoneId,
      },
      timing: {
        entryTime,
        scheduledExitTime: scheduledExit,
        liveDurationMinutes,
        remainingMinutes,
        isOverstay,
        overstayMinutes: isOverstay ? Math.abs(remainingMinutes) : 0,
      },
      payment,
      securityOfficer: entryMovement?.verifiedBy || null,
      movementLogs: movements,
      timeline,
    };
  }
}

export const adminOperationsService = new AdminOperationsService();
