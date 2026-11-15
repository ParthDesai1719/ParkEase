import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdValidator = z
  .string()
  .trim()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId format.',
  });

const optionalObjectIdValidator = z
  .union([
    z.string().trim().refine((val) => !val || mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid ObjectId format.',
    }),
    z.null(),
    z.undefined(),
  ])
  .transform((val) => (val && mongoose.Types.ObjectId.isValid(val) ? val : null))
  .optional()
  .nullable();

export const layoutElementTypeEnum = z.enum([
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
]);

export const laneDirectionEnum = z.enum([
  'Two-Way',
  'One-Way-Forward',
  'One-Way-Backward',
]);

export const rampDirectionEnum = z.enum([
  'Up',
  'Down',
  'Two-Way',
]);

export const portalTypeEnum = z.enum([
  'Entry',
  'Exit',
  'Two-Way',
]);

export const canvasConfigInputSchema = z.object({
  width: z.number().min(400).max(10000).default(1600),
  height: z.number().min(400).max(10000).default(1000),
  gridSize: z.number().min(5).max(100).default(20),
  snapToGrid: z.boolean().default(true),
  backgroundColor: z.string().trim().default('#0f172a'),
});

export const layoutElementInputSchema = z
  .object({
    elementId: z.string().trim().min(1, 'elementId is required.'),
    elementType: layoutElementTypeEnum,
    slotId: optionalObjectIdValidator,
    slotNumber: z.string().trim().nullable().optional(),
    zoneId: optionalObjectIdValidator,
    zoneCode: z.string().trim().nullable().optional(),
    x: z.number().min(-5000, 'x coordinate is out of bounds.'),
    y: z.number().min(-5000, 'y coordinate is out of bounds.'),
    width: z.number().min(1, 'width must be at least 1 unit.'),
    height: z.number().min(1, 'height must be at least 1 unit.'),
    rotation: z.number().min(0).max(360).default(0),
    zIndex: z.number().default(1),
    label: z.string().trim().max(60).nullable().optional(),
    color: z.string().trim().max(30).nullable().optional(),
    laneDirection: laneDirectionEnum.nullable().optional(),
    rampDirection: rampDirectionEnum.nullable().optional(),
    portalType: portalTypeEnum.nullable().optional(),
    targetFloorId: optionalObjectIdValidator,
    targetFloorName: z.string().trim().max(60).nullable().optional(),
    restrictedReason: z.string().trim().max(200).nullable().optional(),
    reservedFor: z.string().trim().max(100).nullable().optional(),
    isLocked: z.boolean().default(false),
    occupiesAllFloors: z.boolean().default(false).optional(),
    syncAcrossAllFloors: z.boolean().default(false).optional(),
    shaftGroupId: z.string().trim().nullable().optional(),
    rampGroupId: z.string().trim().nullable().optional(),
    autoPlaceOnTargetFloor: z.boolean().default(true).optional(),
    buildingType: z.string().trim().nullable().optional(),
    connectedLaneIds: z.array(z.string().trim()).optional().nullable(),
    navPointers: z
      .array(
        z.object({
          id: z.string().trim(),
          targetLaneId: z.string().trim().nullable().optional(),
          curbX: z.number().nullable().optional(),
          curbY: z.number().nullable().optional(),
        }),
      )
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.elementType === 'ParkingSlot' && !data.slotId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'slotId is required for ParkingSlot element type.',
        path: ['slotId'],
      });
    }
  });

export const saveLayoutElementsSchema = z.object({
  elements: z.array(layoutElementInputSchema),
  canvasConfig: canvasConfigInputSchema.partial().optional(),
});

export const floorLayoutParamSchema = z.object({
  id: objectIdValidator,
  floorId: objectIdValidator,
});

export const removeElementParamSchema = z.object({
  id: objectIdValidator,
  floorId: objectIdValidator,
  elementId: z.string().trim().min(1),
});

export const replicateLaneNetworkSchema = z.object({
  targetFloorIds: z
    .array(z.string().trim().min(1, 'Target floor ID cannot be empty.'))
    .min(1, 'At least one target floor must be selected.'),
  replaceExisting: z.boolean().optional().default(true),
});

