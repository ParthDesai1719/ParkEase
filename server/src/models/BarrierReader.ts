import mongoose, { type InferSchemaType } from 'mongoose';

export const barrierReaderTypeValues = ['ENTRY', 'SLOT', 'EXIT'] as const;
export const barrierStateValues = [
  'CLOSED',
  'ACCESS_VALIDATING',
  'OPENING',
  'OPEN',
  'CLOSING',
  'ERROR',
] as const;

const barrierReaderSchema = new mongoose.Schema(
  {
    readerId: {
      type: String,
      required: true,
      trim: true,
    },
    readerType: {
      type: String,
      required: true,
      enum: barrierReaderTypeValues,
    },
    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingLot',
    },
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingFloor',
      default: null,
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      default: null,
    },
    slotNumber: {
      type: String,
      default: null,
      trim: true,
    },
    barrierState: {
      type: String,
      required: true,
      enum: barrierStateValues,
      default: 'CLOSED',
    },
    barrierOpenedAt: {
      type: Date,
      default: null,
    },
    autoCloseDeadline: {
      type: Date,
      default: null,
    },
    autoCloseTimerActive: {
      type: Boolean,
      default: false,
    },
    isObstructed: {
      type: Boolean,
      default: false,
    },
    activeBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastEvent: {
      type: String,
      default: 'INITIALIZED',
    },
    lastEventAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'barrierReaders',
    timestamps: true,
  },
);

barrierReaderSchema.index({ parkingLotId: 1, readerId: 1 }, { unique: true });
barrierReaderSchema.index({ parkingLotId: 1, readerType: 1 });
barrierReaderSchema.index({ slotId: 1 });
barrierReaderSchema.index({ autoCloseTimerActive: 1, autoCloseDeadline: 1 });

export type BarrierReader = InferSchemaType<typeof barrierReaderSchema>;

export const BarrierReaderModel =
  mongoose.models.BarrierReader ??
  mongoose.model<BarrierReader>('BarrierReader', barrierReaderSchema);
