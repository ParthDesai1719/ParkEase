import mongoose, { type InferSchemaType } from 'mongoose';

export const layoutElementTypeValues = [
  'ParkingSlot',
  'DrivingLane',
  'Entrance',
  'Exit',
  'Pillar',
  'Wall',
  'RestrictedArea',
  'ReservedArea',
  'Ramp',
  'RampPortal',
  'Lift',
  'Staircase',
  'LiftStaircase',
  'BuildingEntrance',
] as const;

export const laneDirectionValues = [
  'Two-Way',
  'One-Way-Forward',
  'One-Way-Backward',
] as const;

export const rampDirectionValues = [
  'Up',
  'Down',
  'Two-Way',
] as const;

export const portalTypeValues = [
  'Entry',
  'Exit',
  'Two-Way',
] as const;

export const layoutStatusValues = [
  'Draft',
  'Validated',
  'Published',
  'Archived',
] as const;

/**
 * Embedded Schema for physical 2D layout elements.
 * Slots point directly to official ParkingSlot records via `slotId`.
 */
export const layoutElementSchema = new mongoose.Schema(
  {
    elementId: {
      type: String,
      required: true,
      trim: true,
    },
    elementType: {
      type: String,
      required: true,
      enum: layoutElementTypeValues,
    },
    // Associated official ParkingSlot (if elementType === 'ParkingSlot')
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
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingZone',
      default: null,
    },
    zoneCode: {
      type: String,
      default: null,
      trim: true,
    },
    // Virtual coordinates & dimensions in normalized grid units (1 unit ~ 10cm)
    // Note: Raw SVG origin x and y can be negative when elements are rotated (e.g. 90deg or 270deg)
    // while their visual bounding boxes remain strictly inside the canvas boundary walls.
    x: {
      type: Number,
      required: true,
      min: -5000,
    },
    y: {
      type: Number,
      required: true,
      min: -5000,
    },
    width: {
      type: Number,
      required: true,
      min: 1,
    },
    height: {
      type: Number,
      required: true,
      min: 1,
    },
    rotation: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 360,
    },
    zIndex: {
      type: Number,
      required: true,
      default: 1,
    },
    label: {
      type: String,
      default: null,
      maxlength: 60,
      trim: true,
    },
    color: {
      type: String,
      default: null,
      maxlength: 30,
      trim: true,
    },
    // Lane-specific properties
    laneDirection: {
      type: String,
      enum: laneDirectionValues,
      default: null,
    },
    // Ramp-specific properties
    rampDirection: {
      type: String,
      enum: rampDirectionValues,
      default: null,
    },
    // Ramp Portal / Floor transition properties
    portalType: {
      type: String,
      enum: portalTypeValues,
      default: null,
    },
    targetFloorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingFloor',
      default: null,
    },
    targetFloorName: {
      type: String,
      default: null,
      maxlength: 60,
      trim: true,
    },
    // Physical restrictions/reservations
    restrictedReason: {
      type: String,
      default: null,
      maxlength: 200,
    },
    reservedFor: {
      type: String,
      default: null,
      maxlength: 100,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    // Multi-storey vertical shaft properties (Lifts, Staircases, Core areas)
    occupiesAllFloors: {
      type: Boolean,
      default: false,
    },
    syncAcrossAllFloors: {
      type: Boolean,
      default: false,
    },
    shaftGroupId: {
      type: String,
      default: null,
      trim: true,
    },
    // Multi-storey vehicular ramp cross-floor coupling
    rampGroupId: {
      type: String,
      default: null,
      trim: true,
    },
    autoPlaceOnTargetFloor: {
      type: Boolean,
      default: true,
    },
    // Complex / Building entrance properties (Mall, Hospital, Commercial Plaza)
    buildingType: {
      type: String,
      default: null,
      trim: true,
    },
    connectedLaneIds: {
      type: [String],
      default: [],
    },
    navPointers: {
      type: [
        {
          id: { type: String, required: true },
          targetLaneId: { type: String, default: null },
          curbX: { type: Number, default: null },
          curbY: { type: Number, default: null },
        },
      ],
      default: undefined,
    },
  },
  {
    _id: false,
  },
);

const canvasConfigSchema = new mongoose.Schema(
  {
    width: {
      type: Number,
      required: true,
      default: 1600,
      min: 400,
      max: 10000,
    },
    height: {
      type: Number,
      required: true,
      default: 1000,
      min: 400,
      max: 10000,
    },
    gridSize: {
      type: Number,
      required: true,
      default: 20,
      min: 5,
      max: 100,
    },
    snapToGrid: {
      type: Boolean,
      required: true,
      default: true,
    },
    backgroundColor: {
      type: String,
      required: true,
      default: '#0f172a',
    },
  },
  {
    _id: false,
  },
);

const layoutStatsSchema = new mongoose.Schema(
  {
    totalSlotsCount: { type: Number, default: 0, min: 0 },
    placedSlotsCount: { type: Number, default: 0, min: 0 },
    unplacedSlotsCount: { type: Number, default: 0, min: 0 },
    lanesCount: { type: Number, default: 0, min: 0 },
    pillarsCount: { type: Number, default: 0, min: 0 },
    wallsCount: { type: Number, default: 0, min: 0 },
    entrancesCount: { type: Number, default: 0, min: 0 },
    exitsCount: { type: Number, default: 0, min: 0 },
    rampsCount: { type: Number, default: 0, min: 0 },
  },
  {
    _id: false,
  },
);

const parkingLayoutSchema = new mongoose.Schema(
  {
    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingLot',
      index: true,
    },
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingFloor',
      index: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      required: true,
      enum: layoutStatusValues,
      default: 'Draft',
    },
    canvasConfig: {
      type: canvasConfigSchema,
      required: true,
      default: () => ({}),
    },
    elements: {
      type: [layoutElementSchema],
      default: [],
    },
    stats: {
      type: layoutStatsSchema,
      default: () => ({}),
    },
    isValidated: {
      type: Boolean,
      required: true,
      default: false,
    },
    validationErrors: {
      type: [String],
      default: [],
    },
    validatedAt: {
      type: Date,
      default: null,
    },
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isPublished: {
      type: Boolean,
      required: true,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
  },
  {
    collection: 'parkingLayouts',
    timestamps: true,
  },
);

// Indexes
parkingLayoutSchema.index(
  { parkingLotId: 1, floorId: 1, version: 1 },
  { name: 'IDX_LotFloorVersion', unique: true },
);

parkingLayoutSchema.index(
  { parkingLotId: 1, floorId: 1, status: 1 },
  { name: 'IDX_LotFloorStatus' },
);

parkingLayoutSchema.index(
  { parkingLotId: 1, floorId: 1, isPublished: 1 },
  { name: 'IDX_LotFloorPublished' },
);

export type ParkingLayout = InferSchemaType<typeof parkingLayoutSchema>;
export type ParkingLayoutElement = InferSchemaType<typeof layoutElementSchema>;

export const ParkingLayoutModel =
  mongoose.models.ParkingLayout ??
  mongoose.model<ParkingLayout>('ParkingLayout', parkingLayoutSchema);

