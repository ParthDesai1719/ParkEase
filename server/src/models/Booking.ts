import mongoose, { type InferSchemaType } from 'mongoose';

const bookingTypeValues = ['ONLINE', 'WALK_IN'] as const;

const bookingStatusValues = [
  'Pending Payment',
  'Confirmed',
  'Active',
  'Completed',
  'Cancelled',
  'No Show',
  'Overstay',
] as const;

const slotReassignmentStatusValues = [
  'NOT_REQUIRED',
  'PENDING',
  'REASSIGNED',
  'FAILED',
  'CANCELLED_REFUNDED',
] as const;

const slotReassignmentReasonValues = ['OVERSTAY_SLOT_CONFLICT'] as const;

const cancellationByValues = [
  'Customer',
  'Security Staff',
  'Parking Owner',
  'Administrator',
  'System',
] as const;

const extensionPaymentMethodValues = ['RAZORPAY', 'CASH'] as const;
const extensionPaymentStatusValues = [
  'PENDING',
  'SUCCESSFUL',
  'FAILED',
  'CASH_REVERSAL_PENDING',
] as const;
const extensionStatusValues = ['PENDING_PAYMENT', 'CONFIRMED', 'FAILED', 'CANCELLED'] as const;

const extensionItemSchema = new mongoose.Schema(
  {
    extensionReference: {
      type: String,
      required: true,
      trim: true,
    },
    extensionDurationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    previousScheduledExitTime: {
      type: Date,
      required: true,
    },
    newScheduledExitTime: {
      type: Date,
      required: true,
    },
    extensionAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: extensionPaymentMethodValues,
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: extensionPaymentStatusValues,
      default: 'PENDING',
    },
    paymentReference: {
      type: String,
      default: null,
      trim: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: extensionStatusValues,
      default: 'CONFIRMED',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    cashCollectedAt: {
      type: Date,
      default: null,
    },
    cashCollectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    _id: true,
    timestamps: true,
  },
);

const activeExtensionHoldSchema = new mongoose.Schema(
  {
    holdReference: {
      type: String,
      default: null,
      trim: true,
    },
    additionalMinutes: {
      type: Number,
      default: null,
    },
    proposedExitTime: {
      type: Date,
      default: null,
    },
    additionalCharge: {
      type: Number,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: extensionPaymentMethodValues,
      default: null,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const bookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },

    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Vehicle',
    },

    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingLot',
    },

    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingFloor',
    },

    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingZone',
    },

    originalSlotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingSlot',
    },

    currentSlotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingSlot',
    },

    bookingType: {
      type: String,
      required: true,
      enum: bookingTypeValues,
      default: 'ONLINE',
    },

    bookingStatus: {
      type: String,
      required: true,
      enum: bookingStatusValues,
      default: 'Pending Payment',
    },

    scheduledEntryTime: {
      type: Date,
      required: true,
    },

    scheduledExitTime: {
      type: Date,
      required: true,
    },

    actualEntryTime: {
      type: Date,
      default: null,
    },

    actualExitTime: {
      type: Date,
      default: null,
    },

    completionEmailSent: {
      type: Boolean,
      default: false,
    },

    gracePeriodMinutes: {
      type: Number,
      required: true,
      default: 15,
      min: 0,
    },

    gracePeriodEndsAt: {
      type: Date,
      default: null,
    },

    bookingDurationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },

    parkingRateAtBooking: {
      type: Number,
      required: true,
      min: 0,
    },

    overstayRateAtBooking: {
      type: Number,
      required: true,
      min: 0,
    },

    baseAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    platformBookingFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    additionalCharges: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    qrCode: {
      type: String,
      default: undefined,
      trim: true,
    },

    noShowDetected: {
      type: Boolean,
      required: true,
      default: false,
    },

    overstayDetected: {
      type: Boolean,
      required: true,
      default: false,
    },

    overstayStartedAt: {
      type: Date,
      default: null,
    },

    overstayDurationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    overstayCharge: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    slotReassignmentStatus: {
      type: String,
      required: true,
      enum: slotReassignmentStatusValues,
      default: 'NOT_REQUIRED',
    },

    slotReassignmentReason: {
      type: String,
      enum: slotReassignmentReasonValues,
      default: null,
    },

    slotReassignedAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      default: null,
    },

    cancellationBy: {
      type: String,
      enum: cancellationByValues,
      default: null,
    },

    refundAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    originalScheduledExitTime: {
      type: Date,
      default: null,
    },

    activeExtensionHold: {
      type: activeExtensionHoldSchema,
      default: null,
    },

    extensions: {
      type: [extensionItemSchema],
      default: [],
    },
  },
  {
    collection: 'bookings',
    timestamps: true,
  },
);

bookingSchema.index({ bookingReference: 1 }, { name: 'UQ_BookingReference', unique: true });

bookingSchema.index({ customerId: 1 }, { name: 'IDX_Customer' });

bookingSchema.index({ vehicleId: 1 }, { name: 'IDX_Vehicle' });

bookingSchema.index({ parkingLotId: 1 }, { name: 'IDX_ParkingLot' });

bookingSchema.index({ floorId: 1 }, { name: 'IDX_Floor' });

bookingSchema.index({ zoneId: 1 }, { name: 'IDX_Zone' });

bookingSchema.index({ originalSlotId: 1 }, { name: 'IDX_OriginalSlot' });

bookingSchema.index({ currentSlotId: 1 }, { name: 'IDX_CurrentSlot' });

bookingSchema.index({ bookingStatus: 1 }, { name: 'IDX_Status' });

bookingSchema.index({ scheduledEntryTime: 1 }, { name: 'IDX_EntryTime' });

bookingSchema.index({ scheduledExitTime: 1 }, { name: 'IDX_ExitTime' });

bookingSchema.index({ overstayDetected: 1 }, { name: 'IDX_Overstay' });

bookingSchema.index(
  { qrCode: 1 },
  {
    name: 'UQ_QRCode',
    unique: true,
    sparse: true,
  },
);

export type Booking = InferSchemaType<typeof bookingSchema>;

export const BookingModel =
  mongoose.models.Booking ?? mongoose.model<Booking>('Booking', bookingSchema);
