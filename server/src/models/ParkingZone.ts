import mongoose, { type InferSchemaType } from 'mongoose';

const vehicleTypeValues = ['Bike', 'Car', 'SUV', 'EV', 'Accessible'] as const;

const zoneStatusValues = ['Active', 'Closed', 'Under Maintenance'] as const;

const parkingZoneSchema = new mongoose.Schema(
  {
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

    zoneName: {
      type: String,
      required: true,
      maxlength: 50,
      trim: true,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: 'zoneName cannot be empty or whitespace-only.',
      },
    },

    zoneCode: {
      type: String,
      required: true,
      maxlength: 50,
      trim: true,
    },

    description: {
      type: String,
      default: null,
      maxlength: 250,
    },

    vehicleType: {
      type: String,
      enum: vehicleTypeValues,
      default: null,
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

    zoneStatus: {
      type: String,
      required: true,
      enum: zoneStatusValues,
      default: 'Active',
    },
  },
  {
    collection: 'parkingZones',
    timestamps: true,
  },
);

parkingZoneSchema.index({ parkingLotId: 1 }, { name: 'IDX_ParkingLot' });

parkingZoneSchema.index({ floorId: 1 }, { name: 'IDX_Floor' });

parkingZoneSchema.index(
  { floorId: 1, zoneCode: 1 },
  {
    name: 'IDX_Zone',
    unique: true,
  },
);

parkingZoneSchema.index(
  { floorId: 1, zoneName: 1 },
  {
    name: 'IDX_ZoneName',
    unique: true,
  },
);

parkingZoneSchema.index({ vehicleType: 1 }, { name: 'IDX_VehicleType' });

parkingZoneSchema.index({ zoneStatus: 1 }, { name: 'IDX_Status' });

export type ParkingZone = InferSchemaType<typeof parkingZoneSchema>;

export const ParkingZoneModel =
  mongoose.models.ParkingZone ?? mongoose.model<ParkingZone>('ParkingZone', parkingZoneSchema);
