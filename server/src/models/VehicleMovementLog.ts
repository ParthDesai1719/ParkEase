import mongoose, { type InferSchemaType } from 'mongoose';

const entryMethodValues = ['QR Code', 'Manual Verification', 'Walk-in'] as const;

const exitMethodValues = ['QR Code', 'Manual Verification'] as const;

const movementStatusValues = [
  'Entry Pending',
  'Vehicle Inside',
  'Vehicle Exited',
  'Overstayed',
  'Cancelled',
] as const;

const vehicleMovementLogSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Booking',
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },

    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Vehicle',
    },

    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingLot',
    },

    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingFloor',
    },

    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingZone',
    },

    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingSlot',
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    exitVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    entryMethod: {
      type: String,
      required: true,
      enum: entryMethodValues,
    },

    exitMethod: {
      type: String,
      enum: exitMethodValues,
      default: null,
    },

    entryTime: {
      type: Date,
      required: true,
    },

    exitTime: {
      type: Date,
      default: null,
    },

    gracePeriodEndsAt: {
      type: Date,
      required: true,
    },

    stayDurationMinutes: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    overstayMinutes: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    movementStatus: {
      type: String,
      required: true,
      enum: movementStatusValues,
      default: 'Entry Pending',
    },

    remarks: {
      type: String,
      default: null,
      maxlength: 300,
    },
  },
  {
    collection: 'vehicleMovementLogs',
    timestamps: true,
  },
);

vehicleMovementLogSchema.index({ bookingId: 1 }, { name: 'IDX_Booking' });

vehicleMovementLogSchema.index({ customerId: 1 }, { name: 'IDX_Customer' });

vehicleMovementLogSchema.index({ vehicleId: 1 }, { name: 'IDX_Vehicle' });

vehicleMovementLogSchema.index({ parkingLotId: 1 }, { name: 'IDX_Parking' });

vehicleMovementLogSchema.index({ slotId: 1 }, { name: 'IDX_Slot' });

vehicleMovementLogSchema.index({ movementStatus: 1 }, { name: 'IDX_Status' });

vehicleMovementLogSchema.index({ entryTime: -1 }, { name: 'IDX_Entry' });

vehicleMovementLogSchema.index({ exitTime: -1 }, { name: 'IDX_Exit' });

export type VehicleMovementLog = InferSchemaType<typeof vehicleMovementLogSchema>;

export const VehicleMovementLogModel =
  mongoose.models.VehicleMovementLog ??
  mongoose.model<VehicleMovementLog>('VehicleMovementLog', vehicleMovementLogSchema);
