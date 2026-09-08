import mongoose, { type InferSchemaType } from 'mongoose';

const notificationTypeValues = [
  'Booking',
  'Payment',
  'Refund',
  'No Show',
  'Overstay',
  'Walk-in',
  'Parking Owner Registration',
  'Review',
  'Incident',
  'Account',
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

const priorityValues = ['Low', 'Normal', 'High', 'Critical'] as const;

const deliveryChannelValues = ['In-App', 'Email', 'Push Notification'] as const;

const deliveryStatusValues = ['Pending', 'Delivered', 'Failed'] as const;

const notificationSchema = new mongoose.Schema(
  {
    notificationReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      immutable: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      immutable: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      immutable: true,
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
      immutable: true,
    },

    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NotificationTemplate',
      default: null,
      immutable: true,
    },

    notificationType: {
      type: String,
      required: true,
      enum: notificationTypeValues,
      immutable: true,
    },

    eventType: {
      type: String,
      required: true,
      enum: eventTypeValues,
      immutable: true,
    },

    title: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
      immutable: true,
    },

    message: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
      immutable: true,
    },

    priority: {
      type: String,
      required: true,
      enum: priorityValues,
      default: 'Normal',
      immutable: true,
    },

    deliveryChannel: {
      type: String,
      required: true,
      enum: deliveryChannelValues,
      default: 'In-App',
      immutable: true,
    },

    deliveryStatus: {
      type: String,
      required: true,
      enum: deliveryStatusValues,
      default: 'Pending',
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    isRead: {
      type: Boolean,
      required: true,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },

    actionUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      immutable: true,
    },

    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'notifications',
    timestamps: true,
  },
);

notificationSchema.index({ notificationReference: 1 }, { name: 'IDX_Reference', unique: true });

notificationSchema.index({ userId: 1 }, { name: 'IDX_User' });

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 }, { name: 'IDX_UserReadTime' });

notificationSchema.index({ bookingId: 1 }, { name: 'IDX_Booking' });

notificationSchema.index({ paymentId: 1 }, { name: 'IDX_Payment' });

notificationSchema.index({ templateId: 1 }, { name: 'IDX_Template' });

notificationSchema.index({ priority: 1 }, { name: 'IDX_Priority' });

notificationSchema.index({ deliveryStatus: 1 }, { name: 'IDX_DeliveryStatus' });

notificationSchema.index({ createdAt: -1 }, { name: 'IDX_Created' });

export type Notification = InferSchemaType<typeof notificationSchema>;

export const NotificationModel =
  mongoose.models.Notification ?? mongoose.model<Notification>('Notification', notificationSchema);
