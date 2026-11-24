import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { BookingModel, type Booking } from '../models/Booking.js';
import { PaymentModel, type Payment } from '../models/Payment.js';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { BookingTimelineModel } from '../models/BookingTimeline.js';
import { SecurityStaffAssignmentModel } from '../models/SecurityStaffAssignment.js';
import { NotificationModel } from '../models/Notification.js';
import { UserModel, type User } from '../models/User.js';
import { ParkingSlotModel, type ParkingSlot } from '../models/ParkingSlot.js';
import { VehicleModel, type Vehicle } from '../models/Vehicle.js';
import { razorpayService } from './razorpay.service.js';
import { auditService } from './audit.service.js';
import { emailService } from './email.service.js';
import { emitBookingStatusUpdate, emitNewNotification } from '../socket.js';
import { env } from '../config/env.js';

export interface ExtensionQuoteResult {
  eligible: boolean;
  bookingId: string;
  bookingReference: string;
  currentScheduledExitTime: string;
  proposedScheduledExitTime: string;
  additionalMinutes: number;
  additionalCharge: number;
  ratePerHour: number;
  exitGracePeriodMinutes: number;
  paymentOptions: Array<'RAZORPAY' | 'CASH'>;
  conflictWithNextBooking?: boolean;
  reason?: string | undefined;
}

export interface InitiateExtensionInput {
  additionalMinutes: number;
  paymentMethod: 'RAZORPAY' | 'CASH';
}

export interface InitiateExtensionResult {
  bookingId: string;
  bookingReference: string;
  extensionReference: string;
  paymentMethod: 'RAZORPAY' | 'CASH';
  paymentStatus: 'PENDING' | 'SUCCESSFUL';
  status: 'PENDING_PAYMENT' | 'CONFIRMED';
  previousScheduledExitTime: string;
  newScheduledExitTime: string;
  additionalMinutes: number;
  additionalCharge: number;
  message: string;
  razorpayOrder?: {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
  };
  paymentReference?: string;
}

export interface VerifyOnlineExtensionInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export class CustomerExtensionService {
  private generatePaymentReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `PAY-EXT-${timestamp}-${random}`;
  }

  private generateExtensionReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `EXT-${timestamp}-${random}`;
  }

  /**
   * Evaluates operating hours for the proposed extension
   */
  private validateOperatingHours(
    exitTime: Date,
    lot: ParkingLot,
  ): { valid: boolean; reason?: string } {
    if (lot.isOpen24Hours) {
      return { valid: true };
    }

    if (!lot.closingTime) {
      return { valid: true };
    }

    const parts = lot.closingTime.split(':');
    const closeH = Number(parts[0]);
    const closeM = Number(parts[1]);
    if (isNaN(closeH) || isNaN(closeM)) {
      return { valid: true };
    }

    const exitH = exitTime.getHours();
    const exitM = exitTime.getMinutes();
    const exitTotalMins = exitH * 60 + exitM;
    const closeTotalMins = closeH * 60 + closeM;

    if (exitTotalMins > closeTotalMins) {
      return {
        valid: false,
        reason: `Proposed exit time (${exitTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) exceeds parking facility closing time of ${lot.closingTime}.`,
      };
    }

    return { valid: true };
  }

  /**
   * Generates a validated extension quote including slot conflict and Exit Grace Period checks
   */
  public async getExtensionQuote(
    userId: string,
    bookingId: string,
    additionalMinutes: number,
  ): Promise<ExtensionQuoteResult> {
    if (!mongoose.isValidObjectId(bookingId)) {
      throw new AppError('Invalid booking ID.', 400, 'INVALID_BOOKING_ID');
    }

    if (!additionalMinutes || isNaN(additionalMinutes) || additionalMinutes <= 0) {
      throw new AppError(
        'Requested extension duration must be a positive integer in minutes.',
        400,
        'INVALID_EXTENSION_DURATION',
      );
    }

    if (additionalMinutes > 720) {
      throw new AppError(
        'Single extension duration cannot exceed 12 hours (720 minutes).',
        400,
        'EXTENSION_DURATION_LIMIT_EXCEEDED',
      );
    }

    const booking = await (BookingModel as mongoose.Model<Booking>)
      .findById(bookingId)
      .exec();

    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.customerId.toString() !== userId.toString()) {
      throw new AppError(
        'Forbidden: You are not authorized to view or extend this booking.',
        403,
        'FORBIDDEN_BOOKING_ACCESS',
      );
    }

    const now = new Date();
    const currentScheduledExit = new Date(booking.scheduledExitTime);

    // 1. Booking Status check: Only Active bookings can be extended
    if (booking.bookingStatus !== 'Active') {
      return {
        eligible: false,
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        currentScheduledExitTime: currentScheduledExit.toISOString(),
        proposedScheduledExitTime: currentScheduledExit.toISOString(),
        additionalMinutes,
        additionalCharge: 0,
        ratePerHour: booking.parkingRateAtBooking || 0,
        exitGracePeriodMinutes: booking.gracePeriodMinutes || 15,
        paymentOptions: ['RAZORPAY', 'CASH'],
        reason: `Cannot extend booking: status is '${booking.bookingStatus}'. Only Active bookings in progress can be extended.`,
      };
    }

    // 2. Current time check: Must be before current scheduled exit time
    if (now.getTime() >= currentScheduledExit.getTime()) {
      return {
        eligible: false,
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        currentScheduledExitTime: currentScheduledExit.toISOString(),
        proposedScheduledExitTime: currentScheduledExit.toISOString(),
        additionalMinutes,
        additionalCharge: 0,
        ratePerHour: booking.parkingRateAtBooking || 0,
        exitGracePeriodMinutes: booking.gracePeriodMinutes || 15,
        paymentOptions: ['RAZORPAY', 'CASH'],
        reason:
          'Current time has reached or passed the scheduled exit time. Bookings in overstay or past exit cannot be extended online.',
      };
    }

    const proposedScheduledExit = new Date(
      currentScheduledExit.getTime() + additionalMinutes * 60 * 1000,
    );

    // 3. Operating hours check
    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(booking.parkingLotId)
      .lean()
      .exec();

    if (!lot) {
      throw new AppError('Associated parking facility not found.', 404, 'FACILITY_NOT_FOUND');
    }

    const opCheck = this.validateOperatingHours(proposedScheduledExit, lot);
    if (!opCheck.valid) {
      return {
        eligible: false,
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        currentScheduledExitTime: currentScheduledExit.toISOString(),
        proposedScheduledExitTime: proposedScheduledExit.toISOString(),
        additionalMinutes,
        additionalCharge: 0,
        ratePerHour: booking.parkingRateAtBooking || lot.hourlyRate || 0,
        exitGracePeriodMinutes: booking.gracePeriodMinutes || 15,
        paymentOptions: ['RAZORPAY', 'CASH'],
        reason: opCheck.reason,
      };
    }

    // 4. Future booking conflict & Exit Grace Period check
    const gracePeriodMinutes = booking.gracePeriodMinutes || 15;
    const graceEnd = new Date(
      proposedScheduledExit.getTime() + gracePeriodMinutes * 60 * 1000,
    );

    const conflictingBooking = await (BookingModel as mongoose.Model<Booking>).findOne({
      _id: { $ne: booking._id },
      currentSlotId: booking.currentSlotId,
      bookingStatus: { $in: ['Confirmed', 'Active'] },
      scheduledEntryTime: { $lt: graceEnd },
      scheduledExitTime: { $gt: currentScheduledExit },
    });

    if (conflictingBooking) {
      return {
        eligible: false,
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        currentScheduledExitTime: currentScheduledExit.toISOString(),
        proposedScheduledExitTime: proposedScheduledExit.toISOString(),
        additionalMinutes,
        additionalCharge: 0,
        ratePerHour: booking.parkingRateAtBooking || lot.hourlyRate || 0,
        exitGracePeriodMinutes: gracePeriodMinutes,
        paymentOptions: ['RAZORPAY', 'CASH'],
        conflictWithNextBooking: true,
        reason:
          'The parking bay has another confirmed reservation scheduled during or immediately after the requested extension period (preserving the required 15-minute exit grace period).',
      };
    }

    // 5. Backend extension charge calculation
    const ratePerHour = booking.parkingRateAtBooking || lot.hourlyRate || 0;
    const billableHours = Math.ceil(additionalMinutes / 60);
    const additionalCharge = Math.round(billableHours * ratePerHour);

    return {
      eligible: true,
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      currentScheduledExitTime: currentScheduledExit.toISOString(),
      proposedScheduledExitTime: proposedScheduledExit.toISOString(),
      additionalMinutes,
      additionalCharge,
      ratePerHour,
      exitGracePeriodMinutes: gracePeriodMinutes,
      paymentOptions: ['RAZORPAY', 'CASH'],
    };
  }

  /**
   * Initiates a customer booking extension with either Pay Online (Razorpay) or Pay Cash at Exit
   */
  public async initiateExtension(
    userId: string,
    bookingId: string,
    input: InitiateExtensionInput,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<InitiateExtensionResult> {
    const quote = await this.getExtensionQuote(userId, bookingId, input.additionalMinutes);
    if (!quote.eligible) {
      throw new AppError(quote.reason || 'Booking is not eligible for extension.', 409, 'EXTENSION_INELIGIBLE');
    }

    const booking = await (BookingModel as mongoose.Model<Booking>).findById(bookingId).exec();
    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(booking.parkingLotId)
      .lean()
      .exec();
    if (!lot) {
      throw new AppError('Parking facility not found.', 404, 'FACILITY_NOT_FOUND');
    }

    const extensionReference = this.generateExtensionReference();
    const paymentReference = this.generatePaymentReference();
    const previousScheduledExitTime = new Date(booking.scheduledExitTime);
    const proposedScheduledExitTime = new Date(quote.proposedScheduledExitTime);

    // =========================================================================
    // OPTION A: PAY ONLINE (RAZORPAY)
    // =========================================================================
    if (input.paymentMethod === 'RAZORPAY') {
      // 1. Create Razorpay order
      const order = await razorpayService.createOrder({
        amountPaise: Math.round(quote.additionalCharge * 100),
        currency: 'INR',
        receipt: paymentReference,
        notes: {
          bookingReference: booking.bookingReference,
          extensionReference,
          additionalMinutes: quote.additionalMinutes.toString(),
          userId,
        },
      });

      // 2. Create pending extension payment record
      const payment = await (PaymentModel as mongoose.Model<Payment>).create({
        paymentReference,
        bookingId: booking._id,
        customerId: booking.customerId,
        ownerId: lot.ownerId,
        parkingLotId: booking.parkingLotId,
        paymentType: 'Parking Booking Extension',
        paymentTypeCode: 'EXTENSION',
        paymentMethod: 'RAZORPAY',
        paymentStatus: 'PENDING',
        amount: quote.additionalCharge,
        platformBookingFee: 0,
        additionalCharges: 0,
        refundAmount: 0,
        gatewayOrderId: order.id,
        remarks: `Online extension hold for +${quote.additionalMinutes}m. Awaiting payment verification.`,
        metadata: {
          extensionReference,
          additionalMinutes: quote.additionalMinutes,
          previousScheduledExitTime,
          newScheduledExitTime: proposedScheduledExitTime,
        },
      });

      // 3. Set temporary extension hold on booking (expires in 10 minutes)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      (booking as any).activeExtensionHold = {
        holdReference: extensionReference,
        additionalMinutes: quote.additionalMinutes,
        proposedExitTime: proposedScheduledExitTime,
        additionalCharge: quote.additionalCharge,
        paymentMethod: 'RAZORPAY',
        paymentId: payment._id,
        expiresAt,
        createdAt: new Date(),
      };
      await booking.save();

      return {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        extensionReference,
        paymentMethod: 'RAZORPAY',
        paymentStatus: 'PENDING',
        status: 'PENDING_PAYMENT',
        previousScheduledExitTime: previousScheduledExitTime.toISOString(),
        newScheduledExitTime: proposedScheduledExitTime.toISOString(),
        additionalMinutes: quote.additionalMinutes,
        additionalCharge: quote.additionalCharge,
        message: 'Online payment order created. Complete checkout via Razorpay to confirm extension.',
        razorpayOrder: {
          orderId: order.id,
          amount: quote.additionalCharge,
          currency: 'INR',
          keyId: env.RAZORPAY_KEY_ID || '',
        },
        paymentReference,
      };
    }

    // =========================================================================
    // OPTION B: PAY CASH AT EXIT (DEFERRED CASH COLLECTION)
    // =========================================================================
    if (input.paymentMethod === 'CASH') {
      const session = await mongoose.startSession();
      let confirmedBooking: any = null;

      try {
        await session.withTransaction(async () => {
          // Re-verify atomically inside transaction
          const freshBooking = await (BookingModel as mongoose.Model<Booking>)
            .findById(booking._id)
            .session(session)
            .exec();

          if (!freshBooking || freshBooking.bookingStatus !== 'Active') {
            throw new AppError('Booking is no longer active for extension.', 409, 'BOOKING_STATE_CHANGED');
          }

          // Conflict re-check inside transaction
          const graceEnd = new Date(
            proposedScheduledExitTime.getTime() + (freshBooking.gracePeriodMinutes || 15) * 60 * 1000,
          );
          const conflict = await (BookingModel as mongoose.Model<Booking>)
            .findOne({
              _id: { $ne: freshBooking._id },
              currentSlotId: freshBooking.currentSlotId,
              bookingStatus: { $in: ['Confirmed', 'Active'] },
              scheduledEntryTime: { $lt: graceEnd },
              scheduledExitTime: { $gt: freshBooking.scheduledExitTime },
            })
            .session(session)
            .exec();

          if (conflict) {
            throw new AppError(
              'Cannot extend booking: a conflicting reservation was created.',
              409,
              'SLOT_CONFLICT_DETECTED',
            );
          }

          // 1. Create extension payment record with Payment Status = PENDING
          const [payment]: any = await (PaymentModel as any).create(
            [
              {
                paymentReference,
                bookingId: freshBooking._id,
                customerId: freshBooking.customerId,
                ownerId: lot.ownerId,
                parkingLotId: freshBooking.parkingLotId,
                paymentType: 'Parking Booking Extension',
                paymentTypeCode: 'EXTENSION',
                paymentMethod: 'CASH',
                paymentStatus: 'PENDING',
                amount: quote.additionalCharge,
                platformBookingFee: 0,
                additionalCharges: 0,
                refundAmount: 0,
                remarks: `Deferred cash collection at exit for +${quote.additionalMinutes}m extension. Cash due to Security Staff at gate.`,
                metadata: {
                  extensionReference,
                  additionalMinutes: quote.additionalMinutes,
                  previousScheduledExitTime,
                  newScheduledExitTime: proposedScheduledExitTime,
                  isDeferredCashAtExit: true,
                },
              },
            ],
            { session },
          );

          // 2. Confirm extension immediately: customer is authorized to stay until revised exit time
          const prevExit = freshBooking.scheduledExitTime;
          if (!freshBooking.originalScheduledExitTime) {
            freshBooking.originalScheduledExitTime = prevExit;
          }
          freshBooking.scheduledExitTime = proposedScheduledExitTime;
          freshBooking.gracePeriodEndsAt = new Date(
            proposedScheduledExitTime.getTime() + (freshBooking.gracePeriodMinutes || 15) * 60 * 1000,
          );
          freshBooking.bookingDurationMinutes = (freshBooking.bookingDurationMinutes || 0) + quote.additionalMinutes;
          freshBooking.additionalCharges = (freshBooking.additionalCharges || 0) + quote.additionalCharge;
          freshBooking.totalAmount = (freshBooking.totalAmount || 0) + quote.additionalCharge;

          const extRecord = {
            extensionReference,
            extensionDurationMinutes: quote.additionalMinutes,
            previousScheduledExitTime: prevExit,
            newScheduledExitTime: proposedScheduledExitTime,
            extensionAmount: quote.additionalCharge,
            paymentMethod: 'CASH',
            paymentStatus: 'PENDING',
            paymentReference,
            paymentId: payment._id,
            status: 'CONFIRMED',
            requestedAt: new Date(),
            confirmedAt: new Date(),
            notes: 'Deferred cash collection at exit.',
          };

          (freshBooking as any).extensions.push(extRecord);
          (freshBooking as any).activeExtensionHold = null;
          await freshBooking.save({ session });

          confirmedBooking = freshBooking;

          // 3. Record Booking Timeline event
          await (BookingTimelineModel as any).create(
            [
              {
                bookingId: freshBooking._id,
                performedBy: new mongoose.Types.ObjectId(userId),
                eventCode: 'BOOKING_EXTENDED',
                eventType: 'Booking Extended',
                eventTitle: 'Booking Extended — Cash Payment Due at Exit',
                eventDescription: `Customer extended parking session by ${quote.additionalMinutes} mins to ${proposedScheduledExitTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Cash payment of ₹${quote.additionalCharge} must be paid to Security Staff at exit.`,
                eventSource: 'Customer',
                eventTime: new Date(),
                metadata: {
                  extensionReference,
                  previousScheduledExitTime: prevExit,
                  newScheduledExitTime: proposedScheduledExitTime,
                  additionalMinutes: quote.additionalMinutes,
                  additionalCharge: quote.additionalCharge,
                  paymentReference,
                  paymentMethod: 'CASH',
                  paymentStatus: 'PENDING',
                },
              },
            ],
            { session },
          );
        });
      } finally {
        await session.endSession();
      }

      // 4. Audit Log (background non-blocking)
      void auditService.log({
        actionCode: 'CUSTOMER_BOOKING_EXTENDED_CASH_DEFERRED',
        module: 'Booking Management',
        actionTitle: 'Customer Extended Booking (Cash at Exit)',
        description: `Customer extended booking ${booking.bookingReference} by ${quote.additionalMinutes}m to ${proposedScheduledExitTime.toISOString()} with deferred cash payment of ₹${quote.additionalCharge} at exit.`,
        targetCollection: 'bookings',
        targetDocumentId: booking._id as mongoose.Types.ObjectId,
        metadata: {
          bookingReference: booking.bookingReference,
          extensionReference,
          previousScheduledExitTime,
          newScheduledExitTime: proposedScheduledExitTime,
          additionalMinutes: quote.additionalMinutes,
          additionalCharge: quote.additionalCharge,
          paymentReference,
        },
        actionStatus: 'Success',
        userId: new mongoose.Types.ObjectId(userId),
        ipAddress: context?.ipAddress,
        deviceInfo: context?.userAgent,
      }).catch((err) => {
        console.warn('[CustomerExtensionService] Audit log warning:', err);
      });

      // 5. Notifications to Customer, Owner, and assigned Security Staff (background non-blocking)
      void this.dispatchExtensionNotifications({
        booking: confirmedBooking || booking,
        lot,
        extensionReference,
        additionalMinutes: quote.additionalMinutes,
        additionalCharge: quote.additionalCharge,
        newExitTime: proposedScheduledExitTime,
        paymentMethod: 'CASH',
        paymentStatus: 'PENDING',
      }).catch((err) => {
        console.warn('[CustomerExtensionService] Notifications warning:', err);
      });

      return {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        extensionReference,
        paymentMethod: 'CASH',
        paymentStatus: 'PENDING',
        status: 'CONFIRMED',
        previousScheduledExitTime: previousScheduledExitTime.toISOString(),
        newScheduledExitTime: proposedScheduledExitTime.toISOString(),
        additionalMinutes: quote.additionalMinutes,
        additionalCharge: quote.additionalCharge,
        message: `Extension confirmed! You may park until ${proposedScheduledExitTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Please hand ₹${quote.additionalCharge} in cash to Security Staff at the gate before exiting.`,
        paymentReference,
      };
    }

    throw new AppError('Invalid payment method selected.', 400, 'INVALID_PAYMENT_METHOD');
  }

  /**
   * Cryptographically verifies Razorpay signature and confirms online booking extension
   */
  public async verifyOnlineExtension(
    userId: string,
    bookingId: string,
    input: VerifyOnlineExtensionInput,
    context?: { ipAddress?: string; userAgent?: string },
  ): Promise<any> {
    const booking = await (BookingModel as mongoose.Model<Booking>).findById(bookingId).exec();
    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.customerId.toString() !== userId.toString()) {
      throw new AppError('Forbidden: Unauthorized booking access.', 403, 'FORBIDDEN_BOOKING_ACCESS');
    }

    const hold = (booking as any).activeExtensionHold;
    if (!hold || !hold.paymentId) {
      throw new AppError('No active online extension hold found for this booking.', 400, 'NO_ACTIVE_HOLD');
    }

    if (hold.expiresAt && new Date().getTime() > new Date(hold.expiresAt).getTime()) {
      (booking as any).activeExtensionHold = null;
      await booking.save();
      throw new AppError('Extension hold has expired. Please re-initiate the extension.', 400, 'HOLD_EXPIRED');
    }

    const payment = await (PaymentModel as mongoose.Model<Payment>).findById(hold.paymentId).exec();
    if (!payment) {
      throw new AppError('Extension payment record not found.', 404, 'PAYMENT_NOT_FOUND');
    }

    if (payment.gatewayOrderId !== input.razorpay_order_id) {
      throw new AppError('Razorpay order ID mismatch.', 400, 'ORDER_ID_MISMATCH');
    }

    // Cryptographic signature verification
    const isSignatureValid = razorpayService.verifySignature({
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });

    if (!isSignatureValid) {
      payment.paymentStatus = 'FAILED';
      payment.remarks = 'Razorpay signature verification failed for extension.';
      await payment.save();

      (booking as any).activeExtensionHold = null;
      await booking.save();

      await (BookingTimelineModel as any).create({
        bookingId: booking._id,
        performedBy: new mongoose.Types.ObjectId(userId),
        eventCode: 'PAYMENT_FAILED',
        eventType: 'Payment Failed',
        eventTitle: 'Online Extension Payment Failed',
        eventDescription: 'Cryptographic signature verification failed for Razorpay extension payment.',
        eventSource: 'Payment Gateway',
        eventTime: new Date(),
        metadata: {
          orderId: input.razorpay_order_id,
          paymentId: input.razorpay_payment_id,
        },
      });

      throw new AppError('Invalid payment signature. Extension could not be verified.', 400, 'INVALID_SIGNATURE');
    }

    const lot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(booking.parkingLotId)
      .lean()
      .exec();

    // Successful Verification: Atomically confirm extension
    const session = await mongoose.startSession();
    let confirmedBooking: any = null;

    try {
      await session.withTransaction(async () => {
        const freshBooking = await (BookingModel as mongoose.Model<Booking>)
          .findById(booking._id)
          .session(session)
          .exec();

        if (!freshBooking || freshBooking.bookingStatus !== 'Active') {
          throw new AppError('Booking is no longer active for extension.', 409, 'BOOKING_STATE_CHANGED');
        }

        // 1. Mark payment SUCCESSFUL
        payment.paymentStatus = 'SUCCESSFUL';
        payment.gatewayPaymentId = input.razorpay_payment_id;
        payment.gatewaySignature = input.razorpay_signature;
        payment.paymentDate = new Date();
        payment.transactionId = input.razorpay_payment_id;
        payment.remarks = 'Online extension payment verified successfully via Razorpay.';
        await payment.save({ session });

        // 2. Apply extension updates to Booking
        const prevExit = freshBooking.scheduledExitTime;
        if (!freshBooking.originalScheduledExitTime) {
          freshBooking.originalScheduledExitTime = prevExit;
        }

        freshBooking.scheduledExitTime = hold.proposedExitTime;
        freshBooking.gracePeriodEndsAt = new Date(
          new Date(hold.proposedExitTime).getTime() + (freshBooking.gracePeriodMinutes || 15) * 60 * 1000,
        );
        freshBooking.bookingDurationMinutes = (freshBooking.bookingDurationMinutes || 0) + hold.additionalMinutes;
        freshBooking.additionalCharges = (freshBooking.additionalCharges || 0) + hold.additionalCharge;
        freshBooking.totalAmount = (freshBooking.totalAmount || 0) + hold.additionalCharge;

        const extRecord = {
          extensionReference: hold.holdReference,
          extensionDurationMinutes: hold.additionalMinutes,
          previousScheduledExitTime: prevExit,
          newScheduledExitTime: hold.proposedExitTime,
          extensionAmount: hold.additionalCharge,
          paymentMethod: 'RAZORPAY',
          paymentStatus: 'SUCCESSFUL',
          paymentReference: payment.paymentReference,
          paymentId: payment._id,
          status: 'CONFIRMED',
          requestedAt: hold.createdAt || new Date(),
          confirmedAt: new Date(),
          notes: `Verified Razorpay payment ID: ${input.razorpay_payment_id}`,
        };

        (freshBooking as any).extensions.push(extRecord);
        (freshBooking as any).activeExtensionHold = null;
        await freshBooking.save({ session });

        confirmedBooking = freshBooking;

        // 3. Record Booking Timeline event
        await (BookingTimelineModel as any).create(
          [
            {
              bookingId: freshBooking._id,
              performedBy: new mongoose.Types.ObjectId(userId),
              eventCode: 'BOOKING_EXTENDED',
              eventType: 'Booking Extended',
              eventTitle: 'Booking Extended via Online Payment',
              eventDescription: `Customer extended parking session by ${hold.additionalMinutes} mins to ${new Date(hold.proposedExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} via Razorpay (₹${hold.additionalCharge}).`,
              eventSource: 'Customer',
              eventTime: new Date(),
              metadata: {
                extensionReference: hold.holdReference,
                previousScheduledExitTime: prevExit,
                newScheduledExitTime: hold.proposedExitTime,
                additionalMinutes: hold.additionalMinutes,
                additionalCharge: hold.additionalCharge,
                paymentReference: payment.paymentReference,
                razorpayPaymentId: input.razorpay_payment_id,
              },
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    // 4. Audit Log (background non-blocking)
    void auditService.log({
      actionCode: 'CUSTOMER_BOOKING_EXTENDED_ONLINE',
      module: 'Booking Management',
      actionTitle: 'Customer Extended Booking (Online)',
      description: `Customer extended booking ${booking.bookingReference} by ${hold.additionalMinutes}m via verified Razorpay payment of ₹${hold.additionalCharge}.`,
      targetCollection: 'bookings',
      targetDocumentId: booking._id as mongoose.Types.ObjectId,
      metadata: {
        bookingReference: booking.bookingReference,
        extensionReference: hold.holdReference,
        additionalMinutes: hold.additionalMinutes,
        additionalCharge: hold.additionalCharge,
        razorpayPaymentId: input.razorpay_payment_id,
      },
      actionStatus: 'Success',
      userId: new mongoose.Types.ObjectId(userId),
      ipAddress: context?.ipAddress,
      deviceInfo: context?.userAgent,
    }).catch((err) => {
      console.warn('[CustomerExtensionService] Audit log warning:', err);
    });

    // 5. Notifications (background non-blocking)
    void this.dispatchExtensionNotifications({
      booking: confirmedBooking || booking,
      lot,
      extensionReference: hold.holdReference,
      additionalMinutes: hold.additionalMinutes,
      additionalCharge: hold.additionalCharge,
      newExitTime: hold.proposedExitTime,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'SUCCESSFUL',
    }).catch((err) => {
      console.warn('[CustomerExtensionService] Notifications warning:', err);
    });

    return {
      success: true,
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      extensionReference: hold.holdReference,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'SUCCESSFUL',
      status: 'CONFIRMED',
      newScheduledExitTime: new Date(hold.proposedExitTime).toISOString(),
      additionalMinutes: hold.additionalMinutes,
      additionalCharge: hold.additionalCharge,
      message: `Extension verified and confirmed! Your new scheduled exit time is ${new Date(hold.proposedExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
    };
  }

  /**
   * Releases temporary online extension hold on checkout cancellation or dismissal
   */
  public async cancelOnlineExtension(userId: string, bookingId: string): Promise<{ success: boolean }> {
    const booking = await (BookingModel as mongoose.Model<Booking>).findById(bookingId).exec();
    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.customerId.toString() !== userId.toString()) {
      throw new AppError('Forbidden: Unauthorized booking access.', 403, 'FORBIDDEN_BOOKING_ACCESS');
    }

    const hold = (booking as any).activeExtensionHold;
    if (hold && hold.paymentId) {
      await (PaymentModel as mongoose.Model<Payment>).findByIdAndUpdate(hold.paymentId, {
        paymentStatus: 'FAILED',
        remarks: 'Online extension checkout cancelled by customer.',
      });
    }

    (booking as any).activeExtensionHold = null;
    await booking.save();

    await (BookingTimelineModel as any).create({
      bookingId: booking._id,
      performedBy: new mongoose.Types.ObjectId(userId),
      eventCode: 'PAYMENT_FAILED',
      eventType: 'Payment Failed',
      eventTitle: 'Online Extension Checkout Cancelled',
      eventDescription: 'Customer dismissed or cancelled online extension payment checkout.',
      eventSource: 'Customer',
      eventTime: new Date(),
    });

    return { success: true };
  }

  /**
   * Helper: Dispatches real-time socket updates and in-app notifications to Customer, Owner, and assigned Security Staff
   */
  private async dispatchExtensionNotifications(params: {
    booking: any;
    lot: any;
    extensionReference: string;
    additionalMinutes: number;
    additionalCharge: number;
    newExitTime: Date;
    paymentMethod: 'RAZORPAY' | 'CASH';
    paymentStatus: 'PENDING' | 'SUCCESSFUL';
  }): Promise<void> {
    const { booking, lot, additionalMinutes, additionalCharge, newExitTime, paymentMethod, paymentStatus } = params;

    const formattedTime = new Date(newExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const paymentLabel = paymentMethod === 'CASH' ? 'Cash at Exit (Pending)' : 'Paid Online (Razorpay)';

    // 1. Notify Customer
    try {
      const customerNotif = await (NotificationModel as any).create({
        notificationReference: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        userId: booking.customerId,
        bookingId: booking._id,
        title: 'Booking Extension Confirmed',
        message: `Your booking ${booking.bookingReference} has been extended by ${additionalMinutes} mins until ${formattedTime}. Payment: ${paymentLabel} (₹${additionalCharge}).`,
        notificationType: 'Booking',
        eventType: 'Booking Extended',
        priority: 'Normal',
        deliveryChannel: 'In-App',
        deliveryStatus: 'Delivered',
        data: {
          bookingId: booking._id.toString(),
          bookingReference: booking.bookingReference,
          newScheduledExitTime: newExitTime.toISOString(),
          additionalCharge,
          paymentMethod,
          paymentStatus,
        },
      });
      emitNewNotification(booking.customerId.toString(), customerNotif.toJSON());
    } catch (err) {
      console.warn('[CustomerExtensionService] Customer notification warning:', err);
    }

    // 2. Notify Parking Owner
    if (lot?.ownerId) {
      try {
        const ownerNotif = await (NotificationModel as any).create({
          notificationReference: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          userId: lot.ownerId,
          bookingId: booking._id,
          title: 'Booking Extended by Customer',
          message: `Booking ${booking.bookingReference} at ${lot.parkingName} was extended by ${additionalMinutes} mins until ${formattedTime}. Amount: ₹${additionalCharge} (${paymentLabel}).`,
          notificationType: 'Booking',
          eventType: 'Booking Extended',
          priority: 'Normal',
          deliveryChannel: 'In-App',
          deliveryStatus: 'Delivered',
          data: {
            bookingId: booking._id.toString(),
            bookingReference: booking.bookingReference,
            parkingLotId: lot._id.toString(),
            additionalCharge,
            paymentMethod,
          },
        });
        emitNewNotification(lot.ownerId.toString(), ownerNotif.toJSON());
      } catch (err) {
        console.warn('[CustomerExtensionService] Owner notification warning:', err);
      }
    }

    // 3. Notify Assigned Security Staff
    try {
      const staffAssignments = await (SecurityStaffAssignmentModel as any)
        .find({ parkingLotId: booking.parkingLotId, assignmentStatus: 'Active' })
        .select('securityStaffId')
        .lean()
        .exec();

      if (staffAssignments && staffAssignments.length > 0) {
        await Promise.allSettled(
          staffAssignments.map(async (assignment: any) => {
            const staffId = assignment.securityStaffId;
            if (!staffId) return;
            const staffNotif = await (NotificationModel as any).create({
              notificationReference: `NOTIF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
              userId: staffId,
              bookingId: booking._id,
              title: paymentMethod === 'CASH' ? 'Cash Due at Exit: Booking Extended' : 'Active Booking Extended',
              message:
                paymentMethod === 'CASH'
                  ? `Booking ${booking.bookingReference} extended until ${formattedTime}. Collect ₹${additionalCharge} in cash at gate exit.`
                  : `Booking ${booking.bookingReference} extended until ${formattedTime} (Online Paid).`,
              notificationType: 'Booking',
              eventType: 'Booking Extended',
              priority: 'Normal',
              deliveryChannel: 'In-App',
              deliveryStatus: 'Delivered',
              data: {
                bookingId: booking._id.toString(),
                bookingReference: booking.bookingReference,
                newScheduledExitTime: newExitTime.toISOString(),
                additionalCharge,
                paymentMethod,
                isCashCollectionRequired: paymentMethod === 'CASH',
              },
            });
            emitNewNotification(staffId.toString(), staffNotif.toJSON());
          }),
        );
      }
    } catch (err) {
      console.warn('[CustomerExtensionService] Security staff notifications warning:', err);
    }

    // 4. Emit Socket Status Update
    try {
      emitBookingStatusUpdate({
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        parkingLotId: booking.parkingLotId.toString(),
        customerId: booking.customerId.toString(),
        bookingStatus: booking.bookingStatus,
        paymentStatus: paymentStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[CustomerExtensionService] Socket status update warning:', err);
    }

    // 5. Dispatch Extension Payment Receipt Email to Customer (for paid online extensions)
    if (paymentStatus === 'SUCCESSFUL' && additionalCharge > 0) {
      try {
        const [customerDoc, slotDoc, vehicleDoc] = await Promise.all([
          (UserModel as mongoose.Model<User>).findById(booking.customerId).lean().exec(),
          (ParkingSlotModel as mongoose.Model<ParkingSlot>).findById(booking.currentSlotId).lean().exec(),
          (VehicleModel as mongoose.Model<Vehicle>).findById(booking.vehicleId).lean().exec(),
        ]);

        if (customerDoc?.email) {
          void emailService.sendExtraChargesReceiptEmail({
            to: customerDoc.email,
            customerName: customerDoc.fullName || 'Valued Customer',
            receiptNumber: params.extensionReference,
            bookingReference: booking.bookingReference,
            parkingName: lot?.parkingName || 'ParkEase Facility',
            parkingAddress: lot?.address,
            slotNumber: slotDoc?.slotNumber || 'Assigned Bay',
            vehicleNumber: vehicleDoc?.vehicleNumber || '',
            vehicleType: vehicleDoc?.vehicleType,
            settlementDate: new Date(),
            paymentMethod,
            chargeTitle: 'Booking Extension Payment Receipt',
            breakdown: {
              extensionMinutes: additionalMinutes,
              extensionAmount: additionalCharge,
              totalAmountPaid: additionalCharge,
            },
            newScheduledExitTime: newExitTime,
            bookingId: booking._id.toString(),
            parkingLotId: (lot?._id || booking.parkingLotId).toString(),
          }).catch((err) => {
            console.warn('[CustomerExtensionService] Receipt email warning:', err);
          });
        }
      } catch (err) {
        console.warn('[CustomerExtensionService] Customer lookup warning:', err);
      }
    }
  }
}

export const customerExtensionService = new CustomerExtensionService();
