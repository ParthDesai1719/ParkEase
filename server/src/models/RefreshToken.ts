import mongoose, { type InferSchemaType } from 'mongoose';

const tokenStatusValues = ['Active', 'Rotated', 'Revoked', 'Expired'] as const;

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },

    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Session',
      immutable: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },

    tokenFamilyId: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },

    tokenStatus: {
      type: String,
      required: true,
      enum: tokenStatusValues,
      default: 'Active',
    },

    issuedAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedReason: {
      type: String,
      default: null,
      maxlength: 200,
      trim: true,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },

    rotatedAt: {
      type: Date,
      default: null,
    },

    replacedByTokenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RefreshToken',
      default: null,
    },
  },
  {
    collection: 'refreshTokens',
    timestamps: true,
  },
);

refreshTokenSchema.index(
  { sessionId: 1 },
  {
    name: 'IDX_Session',
  },
);

refreshTokenSchema.index(
  { sessionId: 1 },
  {
    name: 'IDX_ActiveSessionToken',
    unique: true,
    partialFilterExpression: {
      tokenStatus: 'Active',
    },
  },
);

refreshTokenSchema.index(
  { tokenHash: 1 },
  {
    name: 'IDX_TokenHash',
    unique: true,
  },
);

refreshTokenSchema.index(
  { userId: 1 },
  {
    name: 'IDX_User',
  },
);

refreshTokenSchema.index(
  { userId: 1, tokenStatus: 1 },
  {
    name: 'IDX_UserStatus',
  },
);

refreshTokenSchema.index(
  { tokenFamilyId: 1 },
  {
    name: 'IDX_TokenFamily',
  },
);

refreshTokenSchema.index(
  { tokenStatus: 1 },
  {
    name: 'IDX_Status',
  },
);

refreshTokenSchema.index(
  { expiresAt: 1 },
  {
    name: 'IDX_Expiry',
  },
);

refreshTokenSchema.index(
  { replacedByTokenId: 1 },
  {
    name: 'IDX_ReplacedBy',
  },
);

refreshTokenSchema.index(
  { tokenFamilyId: 1, tokenStatus: 1 },
  {
    name: 'IDX_FamilyStatus',
  },
);

export type RefreshToken = InferSchemaType<typeof refreshTokenSchema>;

export const RefreshTokenModel =
  mongoose.models.RefreshToken ?? mongoose.model<RefreshToken>('RefreshToken', refreshTokenSchema);
