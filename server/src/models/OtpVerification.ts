import mongoose, { type InferSchemaType } from 'mongoose';

const verificationTypeValues = [
  'REGISTRATION_EMAIL',
  'REGISTRATION_MOBILE',
  'LOGIN',
  'FORGOT_PASSWORD',
  'CHANGE_EMAIL',
  'CHANGE_MOBILE',
  'ACCOUNT_RECOVERY',
] as const;

const deliveryMethodValues = ['Email', 'SMS'] as const;

const verificationStatusValues = ['Pending', 'Verified', 'Expired', 'Failed', 'Cancelled'] as const;

const otpVerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },

    mobileNumber: {
      type: String,
      default: null,
      trim: true,
      match: /^\+91\d{10}$/,
    },

    verificationType: {
      type: String,
      required: true,
      enum: verificationTypeValues,
    },

    deliveryMethod: {
      type: String,
      required: true,
      enum: deliveryMethodValues,
    },

    otpCodeHash: {
      type: String,
      required: true,
      trim: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    consumedAt: {
      type: Date,
      default: null,
    },

    attemptCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 3,
      validate: {
        validator: (value: number) => Number.isInteger(value),
        message: 'attemptCount must be an integer.',
      },
    },

    maxAttempts: {
      type: Number,
      required: true,
      default: 3,
      min: 1,
      max: 3,
      validate: {
        validator: (value: number) => Number.isInteger(value),
        message: 'maxAttempts must be an integer.',
      },
    },

    resendCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: (value: number) => Number.isInteger(value),
        message: 'resendCount must be an integer.',
      },
    },

    lastSentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    verificationStatus: {
      type: String,
      required: true,
      enum: verificationStatusValues,
      default: 'Pending',
    },
  },
  {
    collection: 'otpVerifications',
    timestamps: true,
  },
);

otpVerificationSchema.index({ userId: 1 }, { name: 'IDX_User' });

otpVerificationSchema.index({ email: 1 }, { name: 'IDX_Email' });

otpVerificationSchema.index({ mobileNumber: 1 }, { name: 'IDX_Mobile' });

otpVerificationSchema.index({ verificationStatus: 1 }, { name: 'IDX_Status' });

otpVerificationSchema.index({ expiresAt: 1 }, { name: 'IDX_Expiry' });

otpVerificationSchema.index(
  { userId: 1, verificationType: 1, verificationStatus: 1 },
  { name: 'IDX_UserTypeStatus' },
);

otpVerificationSchema.index(
  { email: 1, verificationType: 1, verificationStatus: 1 },
  { name: 'IDX_EmailTypeStatus' },
);

otpVerificationSchema.index(
  { mobileNumber: 1, verificationType: 1, verificationStatus: 1 },
  { name: 'IDX_MobileTypeStatus' },
);

export type OtpVerification = InferSchemaType<typeof otpVerificationSchema>;

export const OtpVerificationModel =
  mongoose.models.OtpVerification ??
  mongoose.model<OtpVerification>('OtpVerification', otpVerificationSchema);
