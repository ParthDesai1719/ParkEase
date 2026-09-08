import mongoose, { type InferSchemaType } from 'mongoose';

const eventSourceValues = [
  'Customer',
  'Parking Owner',
  'Security Staff',
  'Admin',
  'System',
] as const;

const eventTypeValues = [
  'Booking Created',
  'Payment Successful',
  'Payment Failed',
  'Booking Confirmed',
  'Slot Reserved',
  'QR Generated',
  'Vehicle Entered',
  'Vehicle Exited',
  'Booking Extended',
  'Booking Cancelled',
  'No Show',
  'Overstay Detected',
  'Overstay Charge Created',
  'Overstay Payment Successful',
  'Overstay Cash Collected',
  'Slot Reassigned Due to Overstay',
  'Booking Automatically Cancelled Due to Overstay Slot Conflict',
  'Full Refund Initiated',
  'Full Refund Completed',
  'Booking Completed',
  'Manual Entry Approved',
  'Walk-in Booking Created',
] as const;

const eventCodeValues = [
  'BOOKING_CREATED',
  'PAYMENT_SUCCESSFUL',
  'PAYMENT_FAILED',
  'BOOKING_CONFIRMED',
  'SLOT_RESERVED',
  'QR_GENERATED',
  'VEHICLE_ENTERED',
  'VEHICLE_EXITED',
  'BOOKING_EXTENDED',
  'BOOKING_CANCELLED',
  'BOOKING_NO_SHOW',
  'OVERSTAY_DETECTED',
  'OVERSTAY_CHARGE_CREATED',
  'OVERSTAY_PAYMENT_SUCCESSFUL',
  'OVERSTAY_CASH_COLLECTED',
  'SLOT_REASSIGNED_OVERSTAY',
  'BOOKING_CANCELLED_OVERSTAY_CONFLICT',
  'FULL_REFUND_INITIATED',
  'FULL_REFUND_COMPLETED',
  'BOOKING_COMPLETED',
  'MANUAL_ENTRY_APPROVED',
  'WALK_IN_BOOKING_CREATED',
] as const;

const bookingTimelineSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Booking',
      immutable: true,
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      immutable: true,
    },

    eventCode: {
      type: String,
      required: true,
      enum: eventCodeValues,
      immutable: true,
    },

    eventType: {
      type: String,
      required: true,
      enum: eventTypeValues,
      immutable: true,
    },

    eventTitle: {
      type: String,
      required: true,
      maxlength: 100,
      immutable: true,
    },

    eventDescription: {
      type: String,
      default: null,
      maxlength: 500,
      immutable: true,
    },

    eventSource: {
      type: String,
      required: true,
      enum: eventSourceValues,
      default: 'System',
      immutable: true,
    },

    eventTime: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      immutable: true,
    },
  },
  {
    collection: 'bookingTimeline',
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

bookingTimelineSchema.index({ bookingId: 1 }, { name: 'IDX_Booking' });

bookingTimelineSchema.index({ bookingId: 1, eventTime: 1 }, { name: 'IDX_BookingTime' });

bookingTimelineSchema.index({ performedBy: 1 }, { name: 'IDX_User' });

bookingTimelineSchema.index({ eventType: 1 }, { name: 'IDX_Event' });

bookingTimelineSchema.index({ eventTime: -1 }, { name: 'IDX_Time' });

export type BookingTimeline = InferSchemaType<typeof bookingTimelineSchema>;

export const BookingTimelineModel =
  mongoose.models.BookingTimeline ??
  mongoose.model<BookingTimeline>('BookingTimeline', bookingTimelineSchema);
