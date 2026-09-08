import mongoose, { type InferSchemaType } from 'mongoose';

const assignmentStatusValues = ['Active', 'Inactive'] as const;

const securityStaffAssignmentSchema = new mongoose.Schema(
  {
    securityStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },

    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingLot',
    },

    assignmentStatus: {
      type: String,
      required: true,
      enum: assignmentStatusValues,
      default: 'Active',
    },

    assignedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },

    unassignedAt: {
      type: Date,
      default: null,
    },

    unassignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    assignmentReason: {
      type: String,
      default: null,
      maxlength: 500,
      trim: true,
    },
  },
  {
    collection: 'securityStaffAssignments',
    timestamps: true,
  },
);

securityStaffAssignmentSchema.index({ securityStaffId: 1 }, { name: 'IDX_SecurityStaff' });

securityStaffAssignmentSchema.index({ ownerId: 1 }, { name: 'IDX_Owner' });

securityStaffAssignmentSchema.index({ parkingLotId: 1 }, { name: 'IDX_ParkingLot' });

securityStaffAssignmentSchema.index({ assignmentStatus: 1 }, { name: 'IDX_Status' });

securityStaffAssignmentSchema.index(
  { securityStaffId: 1, assignmentStatus: 1 },
  { name: 'IDX_StaffStatus' },
);

securityStaffAssignmentSchema.index(
  { parkingLotId: 1, assignmentStatus: 1 },
  { name: 'IDX_LotStatus' },
);

securityStaffAssignmentSchema.index(
  { ownerId: 1, assignmentStatus: 1 },
  { name: 'IDX_OwnerStatus' },
);

securityStaffAssignmentSchema.index(
  { securityStaffId: 1, parkingLotId: 1 },
  {
    name: 'UQ_ActiveStaffLotAssignment',
    unique: true,
    partialFilterExpression: {
      assignmentStatus: 'Active',
    },
  },
);

export type SecurityStaffAssignment = InferSchemaType<typeof securityStaffAssignmentSchema>;

export const SecurityStaffAssignmentModel =
  mongoose.models.SecurityStaffAssignment ??
  mongoose.model<SecurityStaffAssignment>('SecurityStaffAssignment', securityStaffAssignmentSchema);
