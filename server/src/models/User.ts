import mongoose, { type InferSchemaType } from 'mongoose';

const genderValues = ['Male', 'Female', 'Other', 'Prefer Not To Say'] as const;

const accountStatusValues = [
  'Pending Verification',
  'Pending Approval',
  'Active',
  'Suspended',
  'Deactivated',
  'Deleted',
] as const;

const preferredLanguageValues = ['English', 'Hindi', 'Gujarati'] as const;

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
    },

    mobileNumber: {
      type: String,
      required: true,
      match: /^\+91\d{10}$/,
    },

    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Role',
    },

    profileImage: {
      type: String,
      default: null,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: genderValues,
      default: 'Prefer Not To Say',
    },

    accountStatus: {
      type: String,
      required: true,
      enum: accountStatusValues,
      default: 'Pending Verification',
    },

    emailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },

    mobileVerified: {
      type: Boolean,
      required: true,
      default: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    preferredLanguage: {
      type: String,
      required: true,
      enum: preferredLanguageValues,
      default: 'English',
    },

    timezone: {
      type: String,
      required: true,
      default: 'Asia/Kolkata',
    },
  },
  {
    collection: 'users',
    timestamps: true,
  },
);

userSchema.index(
  { email: 1 },
  {
    unique: true,
    name: 'IDX_Email',
  },
);

userSchema.index(
  { mobileNumber: 1 },
  {
    unique: true,
    name: 'IDX_Mobile',
  },
);

userSchema.index(
  { roleId: 1 },
  {
    name: 'IDX_Role',
  },
);

userSchema.index(
  { accountStatus: 1 },
  {
    name: 'IDX_Status',
  },
);

userSchema.index(
  { createdAt: -1 },
  {
    name: 'IDX_Created',
  },
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = mongoose.models.User ?? mongoose.model<User>('User', userSchema);
