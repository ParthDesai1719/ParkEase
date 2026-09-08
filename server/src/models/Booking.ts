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
      default: null,
      unique: true,
      sparse: true,
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
