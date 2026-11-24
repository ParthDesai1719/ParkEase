import mongoose, { type InferSchemaType } from 'mongoose';

export const barrierEventOutcomeValues = [
  'GRANTED',
  'DENIED',
  'SUCCESS',
  'FAILED',
  'TIMEOUT',
] as const;

export const barrierEventSourceValues = ['SIMULATOR', 'PHYSICAL_CONTROLLER'] as const;

export const barrierControllerTypeValues = ['SIMULATED', 'PHYSICAL'] as const;

const barrierEventSchema = new mongoose.Schema(
  {
    readerId: {
      type: String,
      required: true,
      trim: true,
    },
    readerType: {
      type: String,
      required: true,
    },
    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingLot',
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      default: null,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    eventOutcome: {
      type: String,
      required: true,
      enum: barrierEventOutcomeValues,
    },
    source: {
      type: String,
      required: true,
      enum: barrierEventSourceValues,
      default: 'SIMULATOR',
    },
    controllerType: {
      type: String,
      required: true,
      enum: barrierControllerTypeValues,
      default: 'SIMULATED',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'barrierEvents',
    timestamps: false,
  },
);

barrierEventSchema.index({ parkingLotId: 1, timestamp: -1 });
barrierEventSchema.index({ readerId: 1, timestamp: -1 });
barrierEventSchema.index({ bookingId: 1, timestamp: -1 });

export type BarrierEvent = InferSchemaType<typeof barrierEventSchema>;

export const BarrierEventModel =
  mongoose.models.BarrierEvent ?? mongoose.model<BarrierEvent>('BarrierEvent', barrierEventSchema);
