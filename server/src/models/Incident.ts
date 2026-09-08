import mongoose, { type InferSchemaType } from 'mongoose';

const incidentSourceValues = [
  'Customer Report',
  'Security Staff Report',
  'Parking Owner Report',
  'Administrator Report',
  'System Detection',
  'Manual',
] as const;

const incidentTypeValues = [
  'Vehicle Damage',
  'Parking Dispute',
  'Unauthorized Entry',
  'Unauthorized Exit',
  'Vehicle Breakdown',
  'Incorrect Parking',
  'Lost Ticket / QR',
  'Security Concern',
  'Emergency',
  'Other',
] as const;

const severityValues = ['Low', 'Medium', 'High', 'Critical'] as const;

const incidentStatusValues = ['Open', 'Under Investigation', 'Resolved', 'Closed'] as const;

const incidentSchema = new mongoose.Schema(
  {
    incidentReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },

    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingLot',
      immutable: true,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      immutable: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    incidentSource: {
      type: String,
      required: true,
      enum: incidentSourceValues,
      default: 'Manual',
    },

    incidentType: {
      type: String,
      required: true,
      enum: incidentTypeValues,
    },

    severity: {
      type: String,
      required: true,
      enum: severityValues,
      default: 'Medium',
    },

    incidentStatus: {
      type: String,
      required: true,
      enum: incidentStatusValues,
      default: 'Open',
    },

    title: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      maxlength: 2000,
      trim: true,
    },

    attachments: {
      type: [String],
      default: [],
    },

    location: {
      type: String,
      default: null,
      maxlength: 100,
      trim: true,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    resolutionNotes: {
      type: String,
      default: null,
      maxlength: 1000,
      trim: true,
    },

    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'incidents',
    timestamps: true,
  },
);

incidentSchema.index({ incidentReference: 1 }, { name: 'IDX_Reference', unique: true });

incidentSchema.index({ parkingLotId: 1 }, { name: 'IDX_Parking' });

incidentSchema.index({ bookingId: 1 }, { name: 'IDX_Booking' });

incidentSchema.index({ customerId: 1 }, { name: 'IDX_Customer' });

incidentSchema.index({ vehicleId: 1 }, { name: 'IDX_Vehicle' });

incidentSchema.index({ reportedBy: 1 }, { name: 'IDX_Reporter' });

incidentSchema.index({ assignedTo: 1 }, { name: 'IDX_Assigned' });

incidentSchema.index({ incidentType: 1 }, { name: 'IDX_Type' });

incidentSchema.index({ incidentStatus: 1 }, { name: 'IDX_Status' });

incidentSchema.index({ severity: 1 }, { name: 'IDX_Severity' });

incidentSchema.index({ createdAt: -1 }, { name: 'IDX_Created' });

incidentSchema.index({ parkingLotId: 1, incidentStatus: 1 }, { name: 'IDX_ParkingStatus' });

incidentSchema.index({ severity: 1, incidentStatus: 1 }, { name: 'IDX_SeverityStatus' });

export type Incident = InferSchemaType<typeof incidentSchema>;

export const IncidentModel =
  mongoose.models.Incident ?? mongoose.model<Incident>('Incident', incidentSchema);
