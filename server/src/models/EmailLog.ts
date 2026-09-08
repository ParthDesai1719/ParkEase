import mongoose, { type InferSchemaType } from 'mongoose';

const sourceValues = ['System', 'Owner'] as const;

const emailTypeValues = [
  'CUSTOMER_COMMUNICATION',
  'BOOKING_CONFIRMATION',
  'BOOKING_CANCELLATION',
  'WALK_IN_BOOKING',
  'PAYMENT_RECEIVED',
  'OWNER_REGISTRATION',
  'INCIDENT_NOTIFICATION',
  'SYSTEM_NOTIFICATION',
] as const;

const deliveryStatusValues = ['Pending', 'Sending', 'Sent', 'Failed', 'Retrying'] as const;

const emailLogSchema = new mongoose.Schema(
  {
    emailReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    source: {
      type: String,
      required: true,
      enum: sourceValues,
      default: 'System',
    },

    recipientIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },

    recipientEmails: {
      type: [String],
      required: true,
      default: [],
      trim: true,
      validate: {
        validator: (emails: string[]) =>
          emails.length > 0 && emails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
        message: 'At least one valid recipient email address is required.',
      },
    },

    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLot',
      default: null,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },

    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NotificationTemplate',
      default: null,
    },

    emailType: {
      type: String,
      required: true,
      enum: emailTypeValues,
    },

    subject: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },

    body: {
      type: String,
      required: true,
      maxlength: 5000,
    },

    deliveryStatus: {
      type: String,
      required: true,
      enum: deliveryStatusValues,
      default: 'Pending',
    },

    providerMessageId: {
      type: String,
      default: null,
      trim: true,
    },

    failureReason: {
      type: String,
      default: null,
      maxlength: 500,
      trim: true,
    },

    retryCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: (value: number) => Number.isInteger(value),
        message: 'retryCount must be an integer.',
      },
    },

    lastAttemptAt: {
      type: Date,
      default: null,
    },

    sentAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'emailLogs',
    timestamps: true,
  },
);

emailLogSchema.index({ emailReference: 1 }, { name: 'IDX_EmailReference', unique: true });

emailLogSchema.index({ senderId: 1 }, { name: 'IDX_Sender' });

emailLogSchema.index({ recipientIds: 1 }, { name: 'IDX_Recipient' });

emailLogSchema.index({ recipientEmails: 1 }, { name: 'IDX_RecipientEmail' });

emailLogSchema.index({ bookingId: 1 }, { name: 'IDX_Booking' });

emailLogSchema.index({ parkingLotId: 1 }, { name: 'IDX_ParkingLot' });

emailLogSchema.index({ templateId: 1 }, { name: 'IDX_Template' });

emailLogSchema.index({ deliveryStatus: 1 }, { name: 'IDX_Status' });

emailLogSchema.index({ emailType: 1 }, { name: 'IDX_EmailType' });

emailLogSchema.index({ source: 1 }, { name: 'IDX_Source' });

emailLogSchema.index({ createdAt: -1 }, { name: 'IDX_CreatedAt' });

export type EmailLog = InferSchemaType<typeof emailLogSchema>;

export const EmailLogModel =
  mongoose.models.EmailLog ?? mongoose.model<EmailLog>('EmailLog', emailLogSchema);
