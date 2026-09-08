import mongoose, { type InferSchemaType } from 'mongoose';

const moduleValues = [
  'Authentication',
  'User Management',
  'Account Management',
  'Vehicle Management',
  'Parking Management',
  'Booking Management',
  'Payment Management',
  'Review Moderation',
  'Incident Management',
  'Notification Management',
  'Email Management',
  'Owner Application Management',
  'Staff Management',
  'System Configuration',
  'Security',
  'Audit Management',
] as const;

const actionStatusValues = ['Success', 'Failed', 'Blocked'] as const;

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      immutable: true,
    },

    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      default: null,
      immutable: true,
    },

    actionCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: /^[A-Z][A-Z0-9_]*$/,
      immutable: true,
    },

    module: {
      type: String,
      required: true,
      enum: moduleValues,
      immutable: true,
    },

    actionTitle: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
      immutable: true,
    },

    description: {
      type: String,
      default: null,
      maxlength: 1000,
      trim: true,
      immutable: true,
    },

    targetCollection: {
      type: String,
      default: null,
      trim: true,
      immutable: true,
    },

    targetDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
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

    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLot',
      default: null,
      immutable: true,
    },

    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      default: null,
      immutable: true,
    },

    beforeData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      immutable: true,
    },

    afterData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      immutable: true,
    },

    changedFields: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      immutable: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      immutable: true,
    },

    ipAddress: {
      type: String,
      default: null,
      trim: true,
      immutable: true,
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

    deviceInfo: {
      type: String,
      default: null,
      maxlength: 300,
      trim: true,
      immutable: true,
    },

    actionStatus: {
      type: String,
      required: true,
      enum: actionStatusValues,
      default: 'Success',
      immutable: true,
    },
  },
  {
    collection: 'auditLogs',
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

auditLogSchema.index({ userId: 1 }, { name: 'IDX_User' });

auditLogSchema.index({ roleId: 1 }, { name: 'IDX_Role' });

auditLogSchema.index({ module: 1 }, { name: 'IDX_Module' });

auditLogSchema.index({ actionStatus: 1 }, { name: 'IDX_Status' });

auditLogSchema.index({ bookingId: 1 }, { name: 'IDX_Booking' });

auditLogSchema.index({ paymentId: 1 }, { name: 'IDX_Payment' });

auditLogSchema.index({ parkingLotId: 1 }, { name: 'IDX_ParkingLot' });

auditLogSchema.index({ incidentId: 1 }, { name: 'IDX_Incident' });

auditLogSchema.index({ targetCollection: 1, targetDocumentId: 1 }, { name: 'IDX_Target' });

auditLogSchema.index({ userId: 1, createdAt: 1 }, { name: 'IDX_UserTime' });

auditLogSchema.index({ actionCode: 1, createdAt: 1 }, { name: 'IDX_ActionTime' });

auditLogSchema.index({ module: 1, createdAt: 1 }, { name: 'IDX_ModuleTime' });

auditLogSchema.index({ actionStatus: 1, createdAt: 1 }, { name: 'IDX_StatusTime' });

auditLogSchema.index({ createdAt: -1 }, { name: 'IDX_Time' });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel =
  mongoose.models.AuditLog ?? mongoose.model<AuditLog>('AuditLog', auditLogSchema);
