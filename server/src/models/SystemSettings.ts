import mongoose, { type InferSchemaType } from 'mongoose';

const paymentGatewayValues = ['RAZORPAY_TEST'] as const;

const systemSettingsSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      default: 'GLOBAL',
      enum: ['GLOBAL'],
      immutable: true,
    },

    applicationName: {
      type: String,
      required: true,
      default: 'Smart Parking System',
      maxlength: 100,
      trim: true,
    },

    applicationVersion: {
      type: String,
      required: true,
      default: '1.0.0',
      trim: true,
    },

    maintenanceMode: {
      type: Boolean,
      required: true,
      default: false,
    },

    bookingGracePeriodMinutes: {
      type: Number,
      required: true,
      default: 15,
      min: 0,
    },

    noShowThresholdPercentage: {
      type: Number,
      required: true,
      default: 50,
      min: 1,
      max: 100,
    },

    noShowRefundPercentage: {
      type: Number,
      required: true,
      default: 40,
      min: 0,
      max: 100,
    },

    bookingAdvanceLimitDays: {
      type: Number,
      required: true,
      default: 30,
      min: 1,
    },

    defaultCurrency: {
      type: String,
      required: true,
      default: 'INR',
      trim: true,
    },

    ownerRegistrationFee: {
      type: Number,
      required: true,
      default: 999,
      min: 0,
    },

    paymentGateway: {
      type: String,
      required: true,
      enum: paymentGatewayValues,
      default: 'RAZORPAY_TEST',
    },

    allowWalkInBookings: {
      type: Boolean,
      required: true,
      default: true,
    },

    minimumBookingDurationHours: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },

    maximumBookingDurationHours: {
      type: Number,
      required: true,
      default: 24,
      min: 1,
      validate: {
        validator: function (this: unknown, value: number) {
          const doc = this as { minimumBookingDurationHours?: number } | undefined;
          const min = doc?.minimumBookingDurationHours ?? 1;
          return value >= min;
        },
        message:
          'maximumBookingDurationHours must be greater than or equal to minimumBookingDurationHours.',
      },
    },

    allowBookingExtensions: {
      type: Boolean,
      required: true,
      default: true,
    },

    refundPolicyEnabled: {
      type: Boolean,
      required: true,
      default: true,
    },

    emailNotificationsEnabled: {
      type: Boolean,
      required: true,
      default: true,
    },

    inAppNotificationsEnabled: {
      type: Boolean,
      required: true,
      default: true,
    },

    pushNotificationsEnabled: {
      type: Boolean,
      required: true,
      default: false,
    },

    sessionTimeoutMinutes: {
      type: Number,
      required: true,
      default: 60,
      min: 5,
    },

    dataRetentionDays: {
      type: Number,
      required: true,
      default: 365,
      min: 1,
    },

    auditLogRetentionDays: {
      type: Number,
      required: true,
      default: 3650,
      min: 365,
    },

    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    collection: 'systemSettings',
    timestamps: true,
  },
);

systemSettingsSchema.index(
  { singletonKey: 1 },
  { name: 'UQ_SystemSettingsSingleton', unique: true },
);

systemSettingsSchema.index({ lastModifiedBy: 1 }, { name: 'IDX_LastModifiedBy' });

systemSettingsSchema.index({ applicationVersion: 1 }, { name: 'IDX_ApplicationVersion' });

export type SystemSettings = InferSchemaType<typeof systemSettingsSchema>;

export const SystemSettingsModel =
  mongoose.models.SystemSettings ??
  mongoose.model<SystemSettings>('SystemSettings', systemSettingsSchema);
