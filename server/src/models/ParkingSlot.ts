import mongoose, { type InferSchemaType } from 'mongoose';

const slotTypeValues = [
  'Standard',
  'Compact',
  'Premium',
  'EV Charging',
  'Accessible',
  'Reserved',
] as const;

const supportedVehicleTypeValues = ['Bike', 'Car', 'SUV', 'EV'] as const;

const slotStatusValues = ['Available', 'Reserved', 'Occupied', 'Under Maintenance'] as const;

const parkingSlotSchema = new mongoose.Schema(
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

    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingZone',
    },

    slotNumber: {
      type: String,
      required: true,
      trim: true,
    },

    slotLabel: {
      type: String,
      required: true,
      maxlength: 30,
      trim: true,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: 'slotLabel cannot be empty or whitespace-only.',
      },
    },

    slotType: {
      type: String,
      required: true,
      enum: slotTypeValues,
      default: 'Standard',
    },

    supportedVehicleType: {
      type: String,
      required: true,
      enum: supportedVehicleTypeValues,
      default: 'Car',
    },

    slotStatus: {
      type: String,
      required: true,
      enum: slotStatusValues,
      default: 'Available',
    },

    currentBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },

    qrIdentifier: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    remarks: {
      type: String,
      default: null,
      maxlength: 250,
    },
  },
  {
    collection: 'parkingSlots',
    timestamps: true,
  },
);

parkingSlotSchema.index({ parkingLotId: 1 }, { name: 'IDX_ParkingLot' });

parkingSlotSchema.index({ floorId: 1 }, { name: 'IDX_Floor' });

parkingSlotSchema.index({ zoneId: 1 }, { name: 'IDX_Zone' });

parkingSlotSchema.index(
  { parkingLotId: 1, slotNumber: 1 },
  {
    name: 'IDX_SlotNumber',
    unique: true,
  },
);

parkingSlotSchema.index(
  { qrIdentifier: 1 },
  {
    name: 'IDX_QR',
    unique: true,
  },
);

parkingSlotSchema.index({ slotStatus: 1 }, { name: 'IDX_Status' });

parkingSlotSchema.index({ currentBookingId: 1 }, { name: 'IDX_Booking' });

export type ParkingSlot = InferSchemaType<typeof parkingSlotSchema>;

export const ParkingSlotModel =
  mongoose.models.ParkingSlot ?? mongoose.model<ParkingSlot>('ParkingSlot', parkingSlotSchema);
