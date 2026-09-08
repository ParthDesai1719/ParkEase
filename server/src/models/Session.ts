import mongoose, { type InferSchemaType } from 'mongoose';

const loginMethodValues = ['Email', 'Mobile Number'] as const;

const sessionTypeValues = ['Standard'] as const;

const logoutReasonValues = [
  'User Logout',
  'Session Expired',
  'Administrator Revoked',
  'Account Suspended',
  'Security Action',
  'Refresh Token Reuse Detected',
] as const;

const sessionStatusValues = ['Active', 'Expired', 'Logged Out', 'Revoked'] as const;

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },

    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },

    refreshTokenId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'RefreshToken',
    },

    tokenFamilyId: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },

    loginMethod: {
      type: String,
      required: true,
      enum: loginMethodValues,
      immutable: true,
    },

    sessionType: {
      type: String,
      required: true,
      enum: sessionTypeValues,
      default: 'Standard',
      immutable: true,
    },

    loginTime: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },

    lastActivity: {
      type: Date,
      required: true,
      default: Date.now,
    },

    logoutTime: {
      type: Date,
      default: null,
    },

    logoutReason: {
      type: String,
      enum: logoutReasonValues,
      default: null,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    ipAddress: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator: (value: string | null) => {
          if (value === null) return true;

          const ipv4 =
            /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

          const ipv6 =
            /^(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}$|^(?:[A-Fa-f0-9]{1,4}:){1,7}:$|^(?:[A-Fa-f0-9]{1,4}:){1,6}:[A-Fa-f0-9]{1,4}$/;

          return ipv4.test(value) || ipv6.test(value);
        },
        message: 'ipAddress must be a valid IPv4 or IPv6 address.',
      },
    },

    deviceName: {
      type: String,
      default: null,
      maxlength: 100,
      trim: true,
    },

    operatingSystem: {
      type: String,
      default: null,
      maxlength: 100,
      trim: true,
    },

    browser: {
      type: String,
      default: null,
      maxlength: 100,
      trim: true,
    },

    location: {
      type: String,
      default: null,
      maxlength: 150,
      trim: true,
    },

    sessionStatus: {
      type: String,
      required: true,
      enum: sessionStatusValues,
      default: 'Active',
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    collection: 'sessions',
    timestamps: true,
  },
);

sessionSchema.index(
  { sessionId: 1 },
  {
    name: 'IDX_Session',
    unique: true,
  },
);

sessionSchema.index(
  { refreshTokenId: 1 },
  {
    name: 'IDX_RefreshToken',
    unique: true,
  },
);

sessionSchema.index(
  { userId: 1 },
  {
    name: 'IDX_User',
  },
);

sessionSchema.index(
  { tokenFamilyId: 1 },
  {
    name: 'IDX_TokenFamily',
  },
);

sessionSchema.index(
  { sessionStatus: 1 },
  {
    name: 'IDX_Status',
  },
);

sessionSchema.index(
  { userId: 1, sessionStatus: 1 },
  {
    name: 'IDX_UserStatus',
  },
);

sessionSchema.index(
  { lastActivity: -1 },
  {
    name: 'IDX_LastActivity',
  },
);

sessionSchema.index(
  { expiresAt: 1 },
  {
    name: 'IDX_Expiry',
  },
);

sessionSchema.index(
  { userId: 1, createdAt: -1 },
  {
    name: 'IDX_UserCreated',
  },
);

sessionSchema.index(
  { ipAddress: 1 },
  {
    name: 'IDX_IP',
  },
);

export type Session = InferSchemaType<typeof sessionSchema>;

export const SessionModel =
  mongoose.models.Session ?? mongoose.model<Session>('Session', sessionSchema);
