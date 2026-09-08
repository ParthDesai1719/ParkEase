import mongoose, { type InferSchemaType } from 'mongoose';

const floorStatusValues = ['Active', 'Closed', 'Under Maintenance'] as const;

const parkingFloorSchema = new mongoose.Schema(
  {
    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingLot',
    },

    floorName: {
      type: String,
      required: true,
      maxlength: 50,
      trim: true,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: 'floorName cannot be empty or whitespace-only.',
      },
    },

    floorNumber: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    description: {
      type: String,
      default: null,
      maxlength: 300,
    },

    totalZones: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    totalSlots: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    availableSlots: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    occupiedSlots: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    reservedSlots: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    occupancyPercentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },

    floorStatus: {
      type: String,
      required: true,
      enum: floorStatusValues,
      default: 'Active',
    },
  },
  {
    collection: 'parkingFloors',
    timestamps: true,
  },
);

parkingFloorSchema.index({ parkingLotId: 1 }, { name: 'IDX_ParkingLot' });

parkingFloorSchema.index(
  { parkingLotId: 1, floorNumber: 1 },
  {
    name: 'IDX_FloorNumber',
    unique: true,
  },
);

parkingFloorSchema.index(
  { parkingLotId: 1, floorName: 1 },
  {
    name: 'IDX_FloorName',
    unique: true,
  },
);

parkingFloorSchema.index({ floorStatus: 1 }, { name: 'IDX_Status' });

export type ParkingFloor = InferSchemaType<typeof parkingFloorSchema>;

export const ParkingFloorModel =
  mongoose.models.ParkingFloor ?? mongoose.model<ParkingFloor>('ParkingFloor', parkingFloorSchema);
