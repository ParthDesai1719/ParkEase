import mongoose from 'mongoose';
import {
  AuditLogModel,
  type AuditLog,
  ParkingFloorModel,
  type ParkingFloor,
  ParkingLayoutModel,
  type ParkingLayout,
  ParkingLotModel,
  type ParkingLot,
  ParkingSlotModel,
  type ParkingSlot,
  ParkingZoneModel,
  type ParkingZone,
  RoleModel,
  type Role,
  UserModel,
  type User,
  BookingModel,
  type Booking,
} from '../models/index.js';
import { notificationService } from './notification.service.js';
import { emailService } from './email.service.js';
import { AppError } from '../utils/AppError.js';
import { normalizeIp } from '../utils/ip.js';

export interface CanvasConfigInput {
  width?: number;
  height?: number;
  gridSize?: number;
  snapToGrid?: boolean;
  backgroundColor?: string;
}

export interface LayoutElementInput {
  elementId: string;
  elementType:
    | 'ParkingSlot'
    | 'DrivingLane'
    | 'Entrance'
    | 'Exit'
    | 'Pillar'
    | 'Wall'
    | 'RestrictedArea'
    | 'ReservedArea'
    | 'Ramp'
    | 'RampPortal'
    | 'Lift'
    | 'Staircase'
    | 'LiftStaircase'
    | 'BuildingEntrance';
  slotId?: string | null | undefined;
  slotNumber?: string | null | undefined;
  isOverflow?: boolean | undefined;
  zoneId?: string | null | undefined;
  zoneCode?: string | null | undefined;
  zoneName?: string | null | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number | undefined;
  zIndex?: number | undefined;
  label?: string | null | undefined;
  color?: string | null | undefined;
  laneDirection?: 'Two-Way' | 'One-Way-Forward' | 'One-Way-Backward' | null | undefined;
  rampDirection?: 'Up' | 'Down' | 'Two-Way' | null | undefined;
  portalType?: 'Entry' | 'Exit' | 'Two-Way' | null | undefined;
  targetFloorId?: string | null | undefined;
  targetFloorName?: string | null | undefined;
  restrictedReason?: string | null | undefined;
  reservedFor?: string | null | undefined;
  isLocked?: boolean | undefined;
  occupiesAllFloors?: boolean | undefined;
  syncAcrossAllFloors?: boolean | undefined;
  shaftGroupId?: string | null | undefined;
  rampGroupId?: string | null | undefined;
  autoPlaceOnTargetFloor?: boolean | undefined;
  buildingType?: string | null | undefined;
  connectedLaneIds?: string[] | null | undefined;
  navPointers?: Array<{
    id: string;
    targetLaneId: string | null;
    curbX?: number | null;
    curbY?: number | null;
  }> | null | undefined;
}

export interface SaveLayoutInput {
  elements: LayoutElementInput[];
  canvasConfig?: CanvasConfigInput | undefined;
}

/**
 * Calculates statistics for layout elements and floor slots.
 */
function calculateLayoutStats(
  elements: LayoutElementInput[],
  totalFloorSlotsCount: number,
) {
  const placedSlots = elements.filter((el) => el.elementType === 'ParkingSlot');
  const placedSlotsCount = placedSlots.length;
  const lanesCount = elements.filter((el) => el.elementType === 'DrivingLane').length;
  const pillarsCount = elements.filter((el) => el.elementType === 'Pillar').length;
  const wallsCount = elements.filter((el) => el.elementType === 'Wall').length;
  const entrancesCount = elements.filter((el) => el.elementType === 'Entrance').length;
  const exitsCount = elements.filter((el) => el.elementType === 'Exit').length;
  const rampsCount = elements.filter((el) => el.elementType === 'Ramp').length;

  return {
    totalSlotsCount: totalFloorSlotsCount,
    placedSlotsCount,
    unplacedSlotsCount: Math.max(0, totalFloorSlotsCount - placedSlotsCount),
    lanesCount,
    pillarsCount,
    wallsCount,
    entrancesCount,
    exitsCount,
    rampsCount,
  };
}

/**
 * Retrieves unplaced official slots for a given floor.
 */
async function getUnplacedSlots(
  parkingLotId: string | mongoose.Types.ObjectId,
  floorId: string | mongoose.Types.ObjectId,
  placedSlotIds: string[],
) {
  const allSlots = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
    .find({
      parkingLotId,
      floorId,
    })
    .populate('zoneId', 'zoneCode zoneName')
    .sort({ slotNumber: 1 })
    .lean()
    .exec();

  const placedSet = new Set(placedSlotIds.map((id) => id.toString()));

  return (allSlots as Array<any>).filter(
    (slot) => !placedSet.has(slot._id.toString()),
  );
}

/**
 * Computes the corresponding counterpart element on the connected floor
 * for a vehicular ramp or ramp portal.
 */
function getTargetRampCounterpart(
  sourceEl: LayoutElementInput,
  sourceFloorName: string,
  targetFloorName: string,
): {
  elementType: 'Ramp' | 'RampPortal';
  rampDirection?: 'Up' | 'Down' | 'Two-Way' | null;
  portalType?: 'Entry' | 'Exit' | 'Two-Way' | null;
  label: string;
} {
  if (sourceEl.elementType === 'Ramp') {
    if (sourceEl.rampDirection === 'Up') {
      // Vehicle ascends from source floor -> arrives onto target floor
      return {
        elementType: 'RampPortal',
        portalType: 'Entry',
        rampDirection: 'Up',
        label: `Ramp Arrival (From ${sourceFloorName})`,
      };
    }
    if (sourceEl.rampDirection === 'Down') {
      // Vehicle descends from source floor -> arrives onto target floor
      return {
        elementType: 'RampPortal',
        portalType: 'Entry',
        rampDirection: 'Down',
        label: `Ramp Arrival (From ${sourceFloorName})`,
      };
    }
    // Two-Way Ramp: exact same two-way ramp on the other floor
    return {
      elementType: 'Ramp',
      rampDirection: 'Two-Way',
      label: `Two-Way Ramp (To ${sourceFloorName})`,
    };
  }

  // sourceEl.elementType === 'RampPortal'
  if (sourceEl.portalType === 'Exit') {
    // Departure portal to ramp -> arrival on target floor
    return {
      elementType: 'RampPortal',
      portalType: 'Entry',
      label: `Ramp Arrival (From ${sourceFloorName})`,
    };
  }
  if (sourceEl.portalType === 'Entry') {
    // Arrival portal on this floor -> departure portal on target floor
    return {
      elementType: 'RampPortal',
      portalType: 'Exit',
      label: `Ramp Departure (To ${sourceFloorName})`,
    };
  }
  return {
    elementType: 'RampPortal',
    portalType: 'Two-Way',
    label: `Ramp Interchange (To ${sourceFloorName})`,
  };
}

/**
 * Helper to identify whether a given floor is Ground Floor across all common naming and numbering schemes
 * (e.g. floorNumber === 0, floorName "G", "G Floor", "Ground", "Ground Floor", or lowest floor in structure).
 */
export function isGroundFloorMatch(
  floor: { floorNumber?: number; floorName?: string; _id?: any } | null | undefined,
  allFloors?: Array<{ floorNumber?: number; floorName?: string; _id?: any }> | null,
): boolean {
  if (!floor) return false;
  if (floor.floorNumber === 0) return true;
  const name = (floor.floorName || '').trim().toLowerCase();
  if (
    name === 'g' ||
    name === 'ground' ||
    name === 'g floor' ||
    name === 'ground floor' ||
    name === 'floor g' ||
    name === 'level g' ||
    name.startsWith('g ') ||
    name.startsWith('g-') ||
    name.startsWith('g_') ||
    name.includes('ground')
  ) {
    return true;
  }
  if (allFloors && allFloors.length > 0) {
    const minFloorNumber = Math.min(
      ...allFloors.map((f) => (f.floorNumber != null ? f.floorNumber : 0)),
    );
    if (floor.floorNumber === minFloorNumber) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves the master canvas boundary configuration from Ground Floor (floorNumber === 0 or lowest floor).
 * In multi-level facilities, Ground Floor is the single physical boundary master of the entire structure.
 */
async function getMasterCanvasConfig(
  parkingLotId: string | mongoose.Types.ObjectId,
): Promise<{
  width: number;
  height: number;
  gridSize: number;
  snapToGrid: boolean;
  backgroundColor: string;
}> {
  const DEFAULT_CONFIG = {
    width: 1600,
    height: 1000,
    gridSize: 20,
    snapToGrid: true,
    backgroundColor: '#0f172a',
  };

  try {
    const floors = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
      .find({ parkingLotId: new mongoose.Types.ObjectId(parkingLotId) })
      .sort({ floorNumber: 1 })
      .lean()
      .exec();

    if (!floors || floors.length === 0) {
      return DEFAULT_CONFIG;
    }

    const groundFloor = floors.find((f) => isGroundFloorMatch(f, floors)) || floors[0];

    if (!groundFloor) {
      return DEFAULT_CONFIG;
    }

    const gDraft = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({
        parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
        floorId: groundFloor._id,
        status: { $in: ['Draft', 'Validated'] },
      })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    if (gDraft?.canvasConfig?.width && gDraft?.canvasConfig?.height) {
      return {
        width: gDraft.canvasConfig.width,
        height: gDraft.canvasConfig.height,
        gridSize: gDraft.canvasConfig.gridSize || 20,
        snapToGrid: gDraft.canvasConfig.snapToGrid ?? true,
        backgroundColor: gDraft.canvasConfig.backgroundColor || '#0f172a',
      };
    }

    const gPublished = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({
        parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
        floorId: groundFloor._id,
        isPublished: true,
      })
      .lean()
      .exec();

    if (gPublished?.canvasConfig?.width && gPublished?.canvasConfig?.height) {
      return {
        width: gPublished.canvasConfig.width,
        height: gPublished.canvasConfig.height,
        gridSize: gPublished.canvasConfig.gridSize || 20,
        snapToGrid: gPublished.canvasConfig.snapToGrid ?? true,
        backgroundColor: gPublished.canvasConfig.backgroundColor || '#0f172a',
      };
    }

    const anyLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({ parkingLotId: new mongoose.Types.ObjectId(parkingLotId) })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    if (anyLayout?.canvasConfig?.width && anyLayout?.canvasConfig?.height) {
      return {
        width: anyLayout.canvasConfig.width,
        height: anyLayout.canvasConfig.height,
        gridSize: anyLayout.canvasConfig.gridSize || 20,
        snapToGrid: anyLayout.canvasConfig.snapToGrid ?? true,
        backgroundColor: anyLayout.canvasConfig.backgroundColor || '#0f172a',
      };
    }

    return DEFAULT_CONFIG;
  } catch (err) {
    console.error('Error resolving master canvasConfig:', err);
    return DEFAULT_CONFIG;
  }
}

export class ParkingLayoutService {
  /**
   * Retrieves floor layout.
   * - Admins get draft layout (if exists) or published layout, plus unplaced slots and floor details.
   * - Owners only get published layout for their owned parking lot.
   */
  static async getFloorLayout(
    parkingLotId: string,
    floorId: string,
    options: {
      userRole?: string | undefined;
      userId?: string | undefined;
      includeDraft?: boolean | undefined;
    } = {},
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking lot ID format.', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(floorId)) {
      throw new AppError('Invalid floor ID format.', 400);
    }

    const parkingLot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(parkingLotId)
      .lean()
      .exec();
    if (!parkingLot) {
      throw new AppError('Parking lot not found.', 404);
    }

    const floor = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
      .findOne({
        _id: floorId,
        parkingLotId,
      })
      .lean()
      .exec();
    if (!floor) {
      throw new AppError('Floor not found or does not belong to this parking lot.', 404);
    }

    const { userRole, userId, includeDraft = true } = options;

    // Strict Owner Access Check: Owners only see published layout of their own lot
    if (userRole === 'OWNER' || userRole === 'PARKING_OWNER') {
      if (!userId || parkingLot.ownerId.toString() !== userId.toString()) {
        throw new AppError('Access denied: You do not own this parking facility.', 403);
      }

      const publishedLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
        .findOne({
          parkingLotId,
          floorId,
          isPublished: true,
        })
        .lean()
        .exec();

      return {
        floor: {
          _id: floor._id,
          floorName: floor.floorName,
          floorNumber: floor.floorNumber,
          totalSlots: floor.totalSlots,
          floorStatus: floor.floorStatus,
        },
        layout: publishedLayout,
        hasPublishedLayout: Boolean(publishedLayout),
      };
    }

    // Customer or unauthenticated: strictly published layout only
    if (userRole === 'CUSTOMER' || !userRole) {
      if (parkingLot.parkingStatus !== 'Active') {
        throw new AppError('Parking facility is not active.', 400);
      }

      const publishedLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
        .findOne({
          parkingLotId,
          floorId,
          isPublished: true,
        })
        .lean()
        .exec();

      if (!publishedLayout) {
        throw new AppError('No published layout available for this floor.', 404);
      }

      return {
        floor: {
          _id: floor._id,
          floorName: floor.floorName,
          floorNumber: floor.floorNumber,
        },
        layout: publishedLayout,
      };
    }

    // Administrator View: can retrieve draft, validate, or published
    let activeLayout: ParkingLayout | null = null;
    let isDraft = false;

    if (includeDraft) {
      activeLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
        .findOne({
          parkingLotId,
          floorId,
          status: { $in: ['Draft', 'Validated'] },
        })
        .lean()
        .exec();
      if (activeLayout) {
        isDraft = true;
      }
    }

    const latestPublished = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({
        parkingLotId,
        floorId,
        isPublished: true,
      })
      .lean()
      .exec();

    if (!activeLayout) {
      activeLayout = latestPublished;
    }

    // Single Source of Truth: All floors must strictly inherit Ground Floor master boundary
    const masterCanvas = await getMasterCanvasConfig(parkingLotId);
    if (activeLayout) {
      const needsSync =
        activeLayout.canvasConfig?.width !== masterCanvas.width ||
        activeLayout.canvasConfig?.height !== masterCanvas.height;

      if (needsSync) {
        activeLayout.canvasConfig = {
          ...activeLayout.canvasConfig,
          width: masterCanvas.width,
          height: masterCanvas.height,
        };
        // Normalize document in database so upper floor drafts never diverge in ratio
        await (ParkingLayoutModel as mongoose.Model<ParkingLayout>).updateOne(
          { _id: (activeLayout as any)._id },
          {
            $set: {
              'canvasConfig.width': masterCanvas.width,
              'canvasConfig.height': masterCanvas.height,
            },
          },
        );
      }
    }

    const totalFloorSlots = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .countDocuments({
        parkingLotId,
        floorId,
      })
      .exec();

    const placedSlotIds: string[] = activeLayout
      ? (activeLayout.elements || [])
          .filter((el) => el.elementType === 'ParkingSlot' && el.slotId)
          .map((el) => el.slotId!.toString())
      : [];

    const unplacedSlots = await getUnplacedSlots(parkingLotId, floorId, placedSlotIds);

    const zones = await (ParkingZoneModel as mongoose.Model<ParkingZone>)
      .find({ parkingLotId, floorId })
      .select('zoneName zoneCode vehicleType totalSlots')
      .lean()
      .exec();

    // Auto-enrich loaded layout elements with authoritative zoneCode and zoneName
    if (activeLayout && activeLayout.elements && activeLayout.elements.length > 0) {
      const officialSlots = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
        .find({ parkingLotId, floorId })
        .populate('zoneId', 'zoneCode zoneName')
        .lean()
        .exec();

      const slotMap = new Map(officialSlots.map((s) => [s._id.toString(), s]));
      const zoneIdMap = new Map(zones.map((z: any) => [z._id.toString(), z]));

      for (const el of activeLayout.elements) {
        if (el.elementType === 'ParkingSlot') {
          if (el.slotId && slotMap.has(el.slotId.toString())) {
            const sDoc = slotMap.get(el.slotId.toString())!;
            el.slotNumber = sDoc.slotNumber;
            const zDoc = sDoc.zoneId as any;
            if (zDoc && typeof zDoc === 'object') {
              el.zoneId = zDoc._id;
              el.zoneCode = zDoc.zoneCode;
              (el as any).zoneName = zDoc.zoneName;
            }
          } else if (el.zoneId && zoneIdMap.has(el.zoneId.toString())) {
            const zDoc = zoneIdMap.get(el.zoneId.toString())!;
            el.zoneCode = zDoc.zoneCode;
            (el as any).zoneName = zDoc.zoneName;
          } else if (!el.zoneCode && el.slotNumber) {
            const letterMatch = el.slotNumber.match(/^([A-Za-z]+)/);
            if (letterMatch && letterMatch[1]) {
              el.zoneCode = letterMatch[1].toUpperCase();
              (el as any).zoneName = `Zone ${el.zoneCode}`;
            }
          }
        }
      }
    }

    return {
      floor: {
        _id: floor._id,
        floorName: floor.floorName,
        floorNumber: floor.floorNumber,
        totalSlots: floor.totalSlots,
        totalZones: floor.totalZones,
        floorStatus: floor.floorStatus,
      },
      zones,
      layout: activeLayout,
      isDraft,
      hasDraft: isDraft,
      hasPublishedVersion: Boolean(latestPublished),
      publishedVersionNumber: latestPublished?.version || null,
      totalFloorSlots,
      unplacedSlots,
    };
  }

  /**
   * Initializes a draft layout for a floor.
   * If a draft already exists, returns it idempotently without modifying it.
   * If a published layout exists, clones elements to start draft version = published.version + 1.
   * Otherwise initializes a clean draft version 1.
   */
  static async initDraftLayout(
    parkingLotId: string,
    floorId: string,
    adminUserId: string,
    ipAddress?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId) || !mongoose.Types.ObjectId.isValid(floorId)) {
      throw new AppError('Invalid parking lot ID or floor ID.', 400);
    }

    const parkingLot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(parkingLotId)
      .exec();
    if (!parkingLot) {
      throw new AppError('Parking lot not found.', 404);
    }

    const floor = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
      .findOne({ _id: floorId, parkingLotId })
      .exec();
    if (!floor) {
      throw new AppError('Floor not found or does not belong to this parking lot.', 404);
    }

    // Check if an active draft/validated layout already exists
    const existingDraft = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({
        parkingLotId,
        floorId,
        status: { $in: ['Draft', 'Validated'] },
      })
      .exec();

    if (existingDraft) {
      const placedSlotIds: string[] = (existingDraft.elements || [])
        .filter((el) => el.elementType === 'ParkingSlot' && el.slotId)
        .map((el) => el.slotId!.toString());
      const unplacedSlots = await getUnplacedSlots(parkingLotId, floorId, placedSlotIds);

      return {
        layout: existingDraft,
        isNew: false,
        message: 'Existing draft layout loaded.',
        unplacedSlots,
      };
    }

    // Check for existing published layout
    const publishedLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({
        parkingLotId,
        floorId,
        isPublished: true,
      })
      .exec();

    const totalFloorSlots = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .countDocuments({
        parkingLotId,
        floorId,
      })
      .exec();

    let draftLayout: mongoose.HydratedDocument<ParkingLayout>;

    if (publishedLayout) {
      // Clone from published layout for a new revision
      const newVersion = (publishedLayout.version || 1) + 1;
      const clonedElements = JSON.parse(JSON.stringify(publishedLayout.elements || []));

      draftLayout = (await (ParkingLayoutModel as mongoose.Model<ParkingLayout>).create({
        parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
        floorId: new mongoose.Types.ObjectId(floorId),
        version: newVersion,
        status: 'Draft',
        canvasConfig: publishedLayout.canvasConfig,
        elements: clonedElements,
        stats: calculateLayoutStats(clonedElements, totalFloorSlots),
        isValidated: false,
        validationErrors: [],
        isPublished: false,
        publishedAt: null,
        publishedBy: null,
        createdBy: new mongoose.Types.ObjectId(adminUserId),
        lastModifiedBy: new mongoose.Types.ObjectId(adminUserId),
      })) as unknown as mongoose.HydratedDocument<ParkingLayout>;
    } else {
      // Pre-set any multi-storey shaft elements (Lift, Staircase, Pillar) defined on other floors of this parking lot
      const existingShaftLayouts = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
        .find({
          parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
          'elements.elementType': { $in: ['Lift', 'Staircase', 'LiftStaircase', 'Pillar'] },
        })
        .lean()
        .exec();

      const presetElements: any[] = [];
      const seenShaftKeys = new Set<string>();

      for (const layoutDoc of existingShaftLayouts) {
        for (const el of layoutDoc.elements || []) {
          if (
            ['Lift', 'Staircase', 'LiftStaircase', 'Pillar'].includes(el.elementType) &&
            (el.occupiesAllFloors || el.syncAcrossAllFloors)
          ) {
            const key = el.shaftGroupId || `${el.elementType}-${Math.round(el.x)}-${Math.round(el.y)}`;
            if (!seenShaftKeys.has(key)) {
              seenShaftKeys.add(key);
              presetElements.push({
                ...el,
                elementId: `STRUCT-${Date.now().toString(36)}-${Math.floor(Math.random() * 90 + 10)}`,
                occupiesAllFloors: true,
                syncAcrossAllFloors: true,
                shaftGroupId: el.shaftGroupId || el.elementId,
              });
            }
          }
        }
      }

      // Pre-set any connected vehicular ramps/portals targeting this floor from other levels
      try {
        const allLotFloors = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
          .find({ parkingLotId: new mongoose.Types.ObjectId(parkingLotId) })
          .sort({ floorNumber: 1 })
          .lean()
          .exec();

        const currentFloorDoc = allLotFloors.find((f) => f._id.toString() === floorId);
        const currentFloorNumber = currentFloorDoc?.floorNumber ?? 0;
        const currentFloorName = currentFloorDoc?.floorName || 'Floor';

        const existingRampLayouts = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
          .find({
            parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
            floorId: { $ne: new mongoose.Types.ObjectId(floorId) },
            'elements.elementType': { $in: ['Ramp', 'RampPortal'] },
          })
          .lean()
          .exec();

        for (const layoutDoc of existingRampLayouts) {
          const otherFloorDoc = allLotFloors.find((f) => f._id.toString() === layoutDoc.floorId.toString());
          const otherFloorNumber = otherFloorDoc?.floorNumber ?? 0;
          const otherFloorName = otherFloorDoc?.floorName || 'Other Floor';

          for (const el of layoutDoc.elements || []) {
            if (['Ramp', 'RampPortal'].includes(el.elementType) && el.autoPlaceOnTargetFloor !== false) {
              const isTargeted =
                el.targetFloorId?.toString() === floorId ||
                (el.rampDirection === 'Up' && otherFloorNumber === currentFloorNumber - 1) ||
                (el.rampDirection === 'Down' && otherFloorNumber === currentFloorNumber + 1) ||
                (el.rampDirection === 'Two-Way' && Math.abs(otherFloorNumber - currentFloorNumber) === 1) ||
                (el.elementType === 'RampPortal' && el.portalType === 'Exit' && Math.abs(otherFloorNumber - currentFloorNumber) === 1);

              if (isTargeted) {
                const rKey = el.rampGroupId || `RAMP-${Math.round(el.x)}-${Math.round(el.y)}`;
                if (!seenShaftKeys.has(rKey)) {
                  seenShaftKeys.add(rKey);
                  const counterpart = getTargetRampCounterpart(
                    el as unknown as LayoutElementInput,
                    otherFloorName,
                    currentFloorName,
                  );
                  presetElements.push({
                    elementId: `RAMP-${Date.now().toString(36)}-${Math.floor(Math.random() * 90 + 10)}`,
                    elementType: counterpart.elementType,
                    rampDirection: counterpart.rampDirection ?? null,
                    portalType: counterpart.portalType ?? null,
                    label: counterpart.label,
                    x: el.x,
                    y: el.y,
                    width: el.width,
                    height: el.height,
                    rotation: el.rotation || 0,
                    zIndex: 2,
                    rampGroupId: el.rampGroupId || el.elementId,
                    autoPlaceOnTargetFloor: true,
                    targetFloorId: layoutDoc.floorId,
                    targetFloorName: otherFloorName,
                  });
                }
              }
            }
          }
        }
      } catch (rampPresetErr) {
        console.error('Multi-level ramp preset warning:', rampPresetErr);
      }

      // Inherit canvasConfig strictly from Ground Floor master boundary
      const initialCanvasConfig = await getMasterCanvasConfig(parkingLotId);

      // Initial draft from scratch (with pre-set multi-storey shafts/columns and inherited canvas boundary)
      draftLayout = (await (ParkingLayoutModel as mongoose.Model<ParkingLayout>).create({
        parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
        floorId: new mongoose.Types.ObjectId(floorId),
        version: 1,
        status: 'Draft',
        canvasConfig: initialCanvasConfig,
        elements: presetElements,
        stats: calculateLayoutStats(presetElements as unknown as LayoutElementInput[], totalFloorSlots),
        isValidated: false,
        validationErrors: [],
        isPublished: false,
        createdBy: new mongoose.Types.ObjectId(adminUserId),
        lastModifiedBy: new mongoose.Types.ObjectId(adminUserId),
      })) as unknown as mongoose.HydratedDocument<ParkingLayout>;
    }

    // Record Audit Log
    await (AuditLogModel as mongoose.Model<AuditLog>).create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      actionCode: 'LAYOUT_DRAFT_INITIALIZED',
      module: 'Parking Management',
      actionTitle: 'Parking Layout Draft Initialized',
      description: `Administrator initialized 2D layout draft (v${draftLayout.version}) for floor "${floor.floorName}" of lot "${parkingLot.parkingName}".`,
      targetCollection: 'parkingLayouts',
      targetDocumentId: draftLayout._id,
      parkingLotId: parkingLot._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        floorId: floor._id.toString(),
        floorNumber: floor.floorNumber,
        version: draftLayout.version,
      },
    });

    const placedSlotIds: string[] = (draftLayout.elements || [])
      .filter((el) => el.elementType === 'ParkingSlot' && el.slotId)
      .map((el) => el.slotId!.toString());
    const unplacedSlots = await getUnplacedSlots(parkingLotId, floorId, placedSlotIds);

    return {
      layout: draftLayout,
      isNew: true,
      message: 'Draft layout initialized successfully.',
      unplacedSlots,
    };
  }

  /**
   * Saves elements and canvas configuration to the active draft layout.
   * Strictly validates that:
   * 1. Slot elements reference valid existing official ParkingSlots.
   * 2. Slots belong to the specified parkingLotId and floorId (no cross-lot or cross-floor slots).
   * 3. No duplicate slot references within the layout.
   * 4. NEVER modifies or deletes official ParkingSlot documents!
   */
  static async saveLayoutElements(
    parkingLotId: string,
    floorId: string,
    data: SaveLayoutInput,
    adminUserId: string,
    ipAddress?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId) || !mongoose.Types.ObjectId.isValid(floorId)) {
      throw new AppError('Invalid parking lot ID or floor ID.', 400);
    }

    const parkingLot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(parkingLotId)
      .exec();
    if (!parkingLot) {
      throw new AppError('Parking lot not found.', 404);
    }

    const floor = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
      .findOne({ _id: floorId, parkingLotId })
      .exec();
    if (!floor) {
      throw new AppError('Floor not found or does not belong to this parking lot.', 404);
    }

    // Ensure an active draft exists, or initialize one
    let draftLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({
        parkingLotId,
        floorId,
        status: { $in: ['Draft', 'Validated'] },
      })
      .exec();

    if (!draftLayout) {
      const initResult = await this.initDraftLayout(parkingLotId, floorId, adminUserId, ipAddress);
      draftLayout = initResult.layout as mongoose.HydratedDocument<ParkingLayout>;
    }

    if (!draftLayout) {
      throw new AppError('Unable to initialize draft layout.', 500);
    }

    const { elements = [], canvasConfig } = data;

    // Check for duplicate elementId within submission
    const elementIdSet = new Set<string>();
    for (const el of elements) {
      if (elementIdSet.has(el.elementId)) {
        throw new AppError(`Duplicate elementId detected in layout: "${el.elementId}".`, 400);
      }
      elementIdSet.add(el.elementId);
    }

    // Slot validation
    const slotElements = elements.filter((el) => el.elementType === 'ParkingSlot');
    const slotIdMap = new Map<string, LayoutElementInput>();

    for (const el of slotElements) {
      if (!el.slotId) {
        throw new AppError(`Slot element "${el.elementId}" is missing required slotId.`, 400);
      }
      const slotIdStr = el.slotId.toString();
      if (slotIdMap.has(slotIdStr)) {
        throw new AppError(
          `Duplicate slot reference: Parking slot "${slotIdStr}" is placed more than once on this layout.`,
          400,
        );
      }
      slotIdMap.set(slotIdStr, el);
    }

    if (slotElements.length > 0) {
      const slotObjectIds = slotElements.map((el) => new mongoose.Types.ObjectId(el.slotId!));
      const officialSlots = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
        .find({
          _id: { $in: slotObjectIds },
        })
        .populate('zoneId', 'zoneCode zoneName')
        .lean()
        .exec();

      if (officialSlots.length !== slotElements.length) {
        const foundIds = new Set(officialSlots.map((s) => s._id.toString()));
        const missingIds = slotElements
          .filter((el) => !foundIds.has(el.slotId!.toString()))
          .map((el) => el.slotId);
        throw new AppError(
          `Invalid slot reference: One or more slots do not exist (${missingIds.join(', ')}).`,
          400,
        );
      }

      // Check cross-lot and cross-floor integrity
      for (const slot of officialSlots) {
        if (slot.parkingLotId.toString() !== parkingLotId.toString()) {
          throw new AppError(
            `Cross-lot reference violation: Slot "${slot.slotNumber}" belongs to a different parking lot.`,
            400,
          );
        }
        if (slot.floorId.toString() !== floorId.toString()) {
          throw new AppError(
            `Cross-floor reference violation: Slot "${slot.slotNumber}" belongs to a different floor.`,
            400,
          );
        }

        // Auto-enrich element with canonical slot number and zone info
        const matchingEl = slotIdMap.get(slot._id.toString());
        if (matchingEl) {
          matchingEl.slotNumber = slot.slotNumber;
          const zDoc = slot.zoneId as any;
          if (zDoc && typeof zDoc === 'object') {
            matchingEl.zoneId = zDoc._id?.toString() || slot.zoneId.toString();
            matchingEl.zoneCode = zDoc.zoneCode || matchingEl.zoneCode;
            matchingEl.zoneName = zDoc.zoneName || matchingEl.zoneName;
          } else {
            matchingEl.zoneId = slot.zoneId.toString();
          }
        }
      }
    }

    const totalFloorSlots = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .countDocuments({
        parkingLotId,
        floorId,
      })
      .exec();

    const allLotFloors = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
      .find({ parkingLotId: new mongoose.Types.ObjectId(parkingLotId) })
      .sort({ floorNumber: 1 })
      .lean()
      .exec();

    const isGroundFloor = isGroundFloorMatch(floor, allLotFloors);

    // Canvas boundary (width & height) can ONLY be changed from Ground Floor
    let updatedCanvasConfig = draftLayout.canvasConfig;
    if (isGroundFloor && canvasConfig) {
      updatedCanvasConfig = {
        ...draftLayout.canvasConfig,
        ...canvasConfig,
      };
      // Synchronize facility canvas boundary across ALL other floors in this parking lot
      await (ParkingLayoutModel as mongoose.Model<ParkingLayout>).updateMany(
        {
          parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
          floorId: { $ne: new mongoose.Types.ObjectId(floorId) },
        },
        {
          $set: {
            'canvasConfig.width': updatedCanvasConfig.width,
            'canvasConfig.height': updatedCanvasConfig.height,
          },
        },
      );
    } else if (!isGroundFloor) {
      // Non-ground floors strictly preserve the Ground Floor master boundary
      const masterCanvas = await getMasterCanvasConfig(parkingLotId);
      updatedCanvasConfig = {
        ...draftLayout.canvasConfig,
        width: masterCanvas.width,
        height: masterCanvas.height,
      };
    }

    const computedStats = calculateLayoutStats(elements, totalFloorSlots);

    const savedLayout = (await (ParkingLayoutModel as mongoose.Model<ParkingLayout>).findByIdAndUpdate(
      draftLayout._id,
      {
        $set: {
          elements: elements as unknown as ParkingLayout['elements'],
          canvasConfig: updatedCanvasConfig,
          stats: computedStats as unknown as ParkingLayout['stats'],
          status: 'Draft',
          isValidated: false,
          validationErrors: [],
          lastModifiedBy: new mongoose.Types.ObjectId(adminUserId),
        },
      },
      { returnDocument: 'after', runValidators: true },
    )) as mongoose.HydratedDocument<ParkingLayout> | null;

    if (!savedLayout) {
      throw new AppError('Failed to save layout elements to database.', 500);
    }

    // Synchronize isOverflow property to official ParkingSlot records
    for (const el of slotElements) {
      if (el.slotId && el.isOverflow !== undefined) {
        await (ParkingSlotModel as mongoose.Model<ParkingSlot>).findByIdAndUpdate(
          el.slotId,
          { $set: { isOverflow: Boolean(el.isOverflow) } },
        );
      }
    }

    // Recompute total overflow slots across the facility
    const totalOverflowSlots = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .countDocuments({
        parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
        isOverflow: true,
      })
      .exec();

    await (ParkingLotModel as mongoose.Model<ParkingLot>).findByIdAndUpdate(
      parkingLotId,
      { $set: { overflowSlotCount: totalOverflowSlots } },
    );

    // Identify deleted linked props that previously existed in draftLayout before this save
    const prevStructuralElements = (draftLayout.elements || []).filter(
      (el: any) =>
        ['Lift', 'Staircase', 'LiftStaircase', 'Pillar'].includes(el.elementType) &&
        (el.occupiesAllFloors || el.syncAcrossAllFloors),
    );
    const prevRampElements = (draftLayout.elements || []).filter(
      (el: any) =>
        ['Ramp', 'RampPortal'].includes(el.elementType) &&
        el.autoPlaceOnTargetFloor !== false,
    );

    const currentStructuralGroupIds = new Set(
      (elements || [])
        .filter((el) => ['Lift', 'Staircase', 'LiftStaircase', 'Pillar'].includes(el.elementType))
        .map((el) => el.shaftGroupId || el.elementId),
    );
    const currentRampGroupIds = new Set(
      (elements || [])
        .filter((el) => ['Ramp', 'RampPortal'].includes(el.elementType))
        .map((el) => el.rampGroupId || el.elementId),
    );

    const deletedStructuralGroupIds = new Set(
      prevStructuralElements
        .map((el: any) => el.shaftGroupId || el.elementId)
        .filter((id: string) => !currentStructuralGroupIds.has(id)),
    );
    const deletedRampGroupIds = new Set(
      prevRampElements
        .map((el: any) => el.rampGroupId || el.elementId)
        .filter((id: string) => !currentRampGroupIds.has(id)),
    );

    // Synchronize multi-storey vertical structural elements (Lift, Staircase, Column/Pillar)
    const multiStoreyStructural = (elements || []).filter(
      (el) =>
        ['Lift', 'Staircase', 'LiftStaircase', 'Pillar'].includes(el.elementType) &&
        (el.occupiesAllFloors || el.syncAcrossAllFloors),
    );

    try {
      const otherFloorDrafts = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
        .find({
          parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
          floorId: { $ne: new mongoose.Types.ObjectId(floorId) },
          status: { $in: ['Draft', 'Validated'] },
        })
        .exec();

      for (const otherDraft of otherFloorDrafts) {
        let otherElements = (otherDraft.elements || []).map((e) =>
          typeof (e as any).toObject === 'function' ? (e as any).toObject() : e,
        );
        let hasChanges = false;

        // Propagate deletions of structural elements removed on active floor
        if (deletedStructuralGroupIds.size > 0) {
          const originalLength = otherElements.length;
          otherElements = otherElements.filter((el: any) => {
            const gId = el.shaftGroupId || el.elementId;
            return !deletedStructuralGroupIds.has(gId);
          });
          if (otherElements.length !== originalLength) {
            hasChanges = true;
          }
        }

        // Propagate updates & additions of structural elements
        for (const item of multiStoreyStructural) {
          const sGroupId = item.shaftGroupId || item.elementId;
          const matchIndex = otherElements.findIndex(
            (el: any) =>
              (sGroupId && el.shaftGroupId === sGroupId) ||
              el.elementId === item.elementId ||
              (el.elementType === item.elementType &&
                Math.abs(el.x - item.x) < 30 &&
                Math.abs(el.y - item.y) < 30),
          );

          if (matchIndex >= 0) {
            // Update to identical spatial footprint across floors
            otherElements[matchIndex] = {
              ...otherElements[matchIndex],
              x: item.x,
              y: item.y,
              width: item.width,
              height: item.height,
              rotation: item.rotation || 0,
              occupiesAllFloors: true,
              syncAcrossAllFloors: true,
              shaftGroupId: sGroupId,
              label: item.label || otherElements[matchIndex].label,
            };
            hasChanges = true;
          } else {
            // Preset onto this floor
            otherElements.push({
              ...item,
              elementId: `STRUCT-${Date.now().toString(36)}-${Math.floor(Math.random() * 90 + 10)}`,
              occupiesAllFloors: true,
              syncAcrossAllFloors: true,
              shaftGroupId: sGroupId,
            });
            hasChanges = true;
          }
        }

        if (hasChanges) {
          await (ParkingLayoutModel as mongoose.Model<ParkingLayout>).findByIdAndUpdate(
            otherDraft._id,
            { $set: { elements: otherElements } },
          );
        }
      }
    } catch (syncErr) {
      console.error('Multi-storey structural cross-floor sync warning:', syncErr);
    }

    // Synchronize multi-level vehicular ramps & portals across floors
    const vehicularRamps = (elements || []).filter(
      (el) =>
        ['Ramp', 'RampPortal'].includes(el.elementType) &&
        el.autoPlaceOnTargetFloor !== false,
    );

    if (vehicularRamps.length > 0 || deletedRampGroupIds.size > 0) {
      try {
        const currentFloorDoc = allLotFloors.find((f) => f._id.toString() === floorId);
        const currentFloorNumber = currentFloorDoc?.floorNumber ?? 0;
        const currentFloorName = currentFloorDoc?.floorName || 'Ground Floor';

        const otherDrafts = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
          .find({
            parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
            floorId: { $ne: new mongoose.Types.ObjectId(floorId) },
            status: { $in: ['Draft', 'Validated'] },
          })
          .exec();

        for (const otherDraft of otherDrafts) {
          let targetFloorElements = (otherDraft.elements || []).map((e) =>
            typeof (e as any).toObject === 'function' ? (e as any).toObject() : e,
          );
          let hasChanges = false;

          // Propagate ramp deletions
          if (deletedRampGroupIds.size > 0) {
            const originalLength = targetFloorElements.length;
            targetFloorElements = targetFloorElements.filter((el: any) => {
              const gId = el.rampGroupId || el.elementId;
              return !deletedRampGroupIds.has(gId);
            });
            if (targetFloorElements.length !== originalLength) {
              hasChanges = true;
            }
          }

          // Check if this otherDraft is the target for any active ramp
          for (const ramp of vehicularRamps) {
            let targetFloorDoc = ramp.targetFloorId
              ? allLotFloors.find((f) => f._id.toString() === ramp.targetFloorId)
              : null;

            if (!targetFloorDoc) {
              if (ramp.rampDirection === 'Up') {
                targetFloorDoc = allLotFloors.find((f) => f.floorNumber === currentFloorNumber + 1);
              } else if (ramp.rampDirection === 'Down') {
                targetFloorDoc = allLotFloors.find((f) => f.floorNumber === currentFloorNumber - 1);
              } else if (ramp.elementType === 'RampPortal' && ramp.portalType === 'Exit') {
                targetFloorDoc =
                  allLotFloors.find((f) => f.floorNumber === currentFloorNumber + 1) ||
                  allLotFloors.find((f) => f.floorNumber === currentFloorNumber - 1);
              } else if (ramp.elementType === 'RampPortal' && ramp.portalType === 'Entry') {
                targetFloorDoc =
                  allLotFloors.find((f) => f.floorNumber === currentFloorNumber - 1) ||
                  allLotFloors.find((f) => f.floorNumber === currentFloorNumber + 1);
              } else {
                targetFloorDoc =
                  currentFloorNumber === 0
                    ? allLotFloors.find((f) => f.floorNumber === 1)
                    : allLotFloors.find((f) => f.floorNumber === 0);
              }
            }

            if (targetFloorDoc && targetFloorDoc._id.toString() === otherDraft.floorId.toString()) {
              const rGroupId = ramp.rampGroupId || ramp.elementId;
              const matchIndex = targetFloorElements.findIndex(
                (el: any) =>
                  (rGroupId && el.rampGroupId === rGroupId) ||
                  el.elementId === ramp.elementId ||
                  (['Ramp', 'RampPortal'].includes(el.elementType) &&
                    Math.abs(el.x - ramp.x) < 30 &&
                    Math.abs(el.y - ramp.y) < 30),
              );

              const counterpart = getTargetRampCounterpart(
                ramp,
                currentFloorName,
                targetFloorDoc.floorName,
              );

              if (matchIndex >= 0) {
                targetFloorElements[matchIndex] = {
                  ...targetFloorElements[matchIndex],
                  x: ramp.x,
                  y: ramp.y,
                  width: ramp.width,
                  height: ramp.height,
                  rotation: ramp.rotation || 0,
                  rampGroupId: rGroupId,
                  autoPlaceOnTargetFloor: true,
                  targetFloorId: new mongoose.Types.ObjectId(floorId),
                  targetFloorName: currentFloorName,
                };
                hasChanges = true;
              } else {
                targetFloorElements.push({
                  elementId: `RAMP-${Date.now().toString(36)}-${Math.floor(Math.random() * 90 + 10)}`,
                  elementType: counterpart.elementType,
                  rampDirection: counterpart.rampDirection ?? null,
                  portalType: counterpart.portalType ?? null,
                  label: counterpart.label,
                  x: ramp.x,
                  y: ramp.y,
                  width: ramp.width,
                  height: ramp.height,
                  rotation: ramp.rotation || 0,
                  zIndex: ramp.zIndex || 2,
                  rampGroupId: rGroupId,
                  autoPlaceOnTargetFloor: true,
                  targetFloorId: new mongoose.Types.ObjectId(floorId),
                  targetFloorName: currentFloorName,
                });
                hasChanges = true;
              }
            }
          }

          if (hasChanges) {
            await (ParkingLayoutModel as mongoose.Model<ParkingLayout>).findByIdAndUpdate(
              otherDraft._id,
              { $set: { elements: targetFloorElements } },
            );
          }
        }
      } catch (rampSyncErr) {
        console.error('Multi-level ramp cross-floor sync warning:', rampSyncErr);
      }
    }

    // Record Audit Log
    await (AuditLogModel as mongoose.Model<AuditLog>).create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      actionCode: 'LAYOUT_DRAFT_SAVED',
      module: 'Parking Management',
      actionTitle: 'Parking Layout Elements Saved',
      description: `Administrator saved ${elements.length} layout elements for floor "${floor.floorName}" of lot "${parkingLot.parkingName}".`,
      targetCollection: 'parkingLayouts',
      targetDocumentId: draftLayout._id,
      parkingLotId: parkingLot._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        floorId: floor._id.toString(),
        totalElements: elements.length,
        placedSlots: savedLayout.stats?.placedSlotsCount,
      },
    });

    const placedSlotIds: string[] = elements
      .filter((el) => el.elementType === 'ParkingSlot' && el.slotId)
      .map((el) => el.slotId!.toString());
    const unplacedSlots = await getUnplacedSlots(parkingLotId, floorId, placedSlotIds);

    return {
      layout: savedLayout,
      stats: savedLayout.stats,
      unplacedSlots,
      message: 'Draft layout elements saved successfully.',
    };
  }

  /**
   * Removes a specific element from the draft layout.
   */
  static async removeLayoutElement(
    parkingLotId: string,
    floorId: string,
    elementId: string,
    adminUserId: string,
    ipAddress?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId) || !mongoose.Types.ObjectId.isValid(floorId)) {
      throw new AppError('Invalid parking lot ID or floor ID.', 400);
    }

    const draftLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({
        parkingLotId,
        floorId,
        status: { $in: ['Draft', 'Validated'] },
      })
      .exec();

    if (!draftLayout) {
      throw new AppError('Active draft layout not found.', 404);
    }

    const existingIndex = (draftLayout.elements || []).findIndex(
      (el) => el.elementId === elementId,
    );
    if (existingIndex === -1) {
      throw new AppError(`Layout element "${elementId}" not found in draft.`, 404);
    }

    const removedElement = draftLayout.elements[existingIndex];
    if (!removedElement) {
      throw new AppError(`Layout element "${elementId}" not found in draft.`, 404);
    }
    draftLayout.elements.splice(existingIndex, 1);

    const totalFloorSlots = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .countDocuments({
        parkingLotId,
        floorId,
      })
      .exec();

    const currentElements: LayoutElementInput[] = (draftLayout.elements || []).map((el) => ({
      elementId: el.elementId,
      elementType: el.elementType,
      slotId: el.slotId?.toString(),
      slotNumber: el.slotNumber,
      zoneId: el.zoneId?.toString(),
      zoneCode: el.zoneCode,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      rotation: el.rotation,
      zIndex: el.zIndex,
      label: el.label,
      color: el.color,
      laneDirection: el.laneDirection,
      rampDirection: el.rampDirection,
      portalType: el.portalType,
      targetFloorId: el.targetFloorId?.toString(),
      targetFloorName: el.targetFloorName,
      restrictedReason: el.restrictedReason,
      reservedFor: el.reservedFor,
      isLocked: el.isLocked,
    }));

    draftLayout.stats = calculateLayoutStats(currentElements, totalFloorSlots) as unknown as ParkingLayout['stats'];
    draftLayout.status = 'Draft';
    draftLayout.isValidated = false;
    draftLayout.validationErrors = [];
    draftLayout.lastModifiedBy = new mongoose.Types.ObjectId(adminUserId);

    await draftLayout.save();

    await (AuditLogModel as mongoose.Model<AuditLog>).create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      actionCode: 'LAYOUT_ELEMENT_REMOVED',
      module: 'Parking Management',
      actionTitle: 'Parking Layout Element Removed',
      description: `Administrator removed layout element "${elementId}" (${removedElement.elementType}) from floor layout.`,
      targetCollection: 'parkingLayouts',
      targetDocumentId: draftLayout._id,
      parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        floorId,
        elementId,
        elementType: removedElement.elementType,
      },
    });

    const placedSlotIds: string[] = (draftLayout.elements || [])
      .filter((el) => el.elementType === 'ParkingSlot' && el.slotId)
      .map((el) => el.slotId!.toString());
    const unplacedSlots = await getUnplacedSlots(parkingLotId, floorId, placedSlotIds);

    return {
      layout: draftLayout,
      stats: draftLayout.stats,
      unplacedSlots,
      message: `Element "${elementId}" removed successfully.`,
    };
  }

  /**
   * Validates a draft layout against structural requirements:
   * - Must have at least 1 Entrance element.
   * - Must have at least 1 Exit element.
   * - Must contain all official ParkingSlots registered to this floor (or report unplaced slots).
   * - Slot references must belong to this floor and lot.
   */
  static async validateDraftLayout(
    parkingLotId: string,
    floorId: string,
    adminUserId: string,
    ipAddress?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId) || !mongoose.Types.ObjectId.isValid(floorId)) {
      throw new AppError('Invalid parking lot ID or floor ID.', 400);
    }

    const draftLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({
        parkingLotId,
        floorId,
        status: { $in: ['Draft', 'Validated'] },
      })
      .exec();

    if (!draftLayout) {
      throw new AppError('Active draft layout not found to validate.', 404);
    }

    const totalFloorSlots = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .countDocuments({
        parkingLotId,
        floorId,
      })
      .exec();

    const floor = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
      .findOne({ _id: floorId, parkingLotId })
      .exec();

    const isGroundFloor = !floor ||
      floor.floorNumber === 1 ||
      floor.floorName.toLowerCase().includes('ground');

    const errors: string[] = [];
    const elements = draftLayout.elements || [];

    // 1 & 2. Ingress & Egress Checks (Direct Entrance/Exit or Inter-Floor Ramps)
    const hasDirectEntrance = elements.some((el) => el.elementType === 'Entrance');
    const hasDirectExit = elements.some((el) => el.elementType === 'Exit');

    const rampElements = elements.filter(
      (el) => el.elementType === 'Ramp' || el.elementType === 'RampPortal',
    );
    const hasRamps = rampElements.length > 0;
    const hasTwoWayRamp = rampElements.some(
      (el) => el.rampDirection === 'Two-Way',
    );
    const hasEntryRamp = rampElements.some(
      (el) => el.rampDirection === 'Up' || el.rampDirection === 'Two-Way' || !el.rampDirection,
    );
    const hasExitRamp = rampElements.some(
      (el) => el.rampDirection === 'Down' || el.rampDirection === 'Two-Way' || !el.rampDirection,
    );

    if (isGroundFloor) {
      // Ground floor requires direct Entrance & Exit (or access ramp)
      const hasEntrance = hasDirectEntrance || hasTwoWayRamp || hasEntryRamp;
      const hasExit = hasDirectExit || hasTwoWayRamp || hasExitRamp;
      if (!hasEntrance) {
        errors.push('Ground floor layout must include at least one Entrance element (or access ramp).');
      }
      if (!hasExit) {
        errors.push('Ground floor layout must include at least one Exit element (or access ramp).');
      }
    } else {
      // Upper / Basement Floor: Physical exterior Entrance/Exit is NOT required as long as vehicular access ramps connect to lower floors!
      const hasEntryAccess = hasDirectEntrance || hasTwoWayRamp || hasEntryRamp || hasRamps;
      const hasExitAccess = hasDirectExit || hasTwoWayRamp || hasExitRamp || hasRamps;

      if (!hasEntryAccess && !hasExitAccess) {
        errors.push(
          'Upper floor layout must include vehicular access ramps (entry/exit or two-way ramp) connecting to lower floors, or entrance/exit elements.',
        );
      } else if (!hasEntryAccess) {
        errors.push(
          'Upper floor layout must include vehicular entry access via an entrance element or entry/two-way ramp from lower floors.',
        );
      } else if (!hasExitAccess) {
        errors.push(
          'Upper floor layout must include vehicular exit access via an exit element or exit/two-way ramp to lower floors.',
        );
      }
    }

    // 3. Slot Completeness Check
    const placedSlotIds: string[] = elements
      .filter((el) => el.elementType === 'ParkingSlot' && el.slotId)
      .map((el) => el.slotId!.toString());

    if (placedSlotIds.length !== totalFloorSlots) {
      const missingCount = totalFloorSlots - placedSlotIds.length;
      if (missingCount > 0) {
        errors.push(
          `Floor contains ${totalFloorSlots} official slots, but only ${placedSlotIds.length} are placed on the layout (${missingCount} unplaced).`,
        );
      }
    }

    // 4. Duplicate Check
    const duplicateIds = placedSlotIds.filter(
      (id: string, index: number) => placedSlotIds.indexOf(id) !== index,
    );
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate slot placements detected: ${duplicateIds.join(', ')}.`);
    }

    const isValid = errors.length === 0;

    draftLayout.isValidated = isValid;
    draftLayout.validationErrors = errors;
    if (isValid) {
      draftLayout.status = 'Validated';
      draftLayout.validatedAt = new Date();
      draftLayout.validatedBy = new mongoose.Types.ObjectId(adminUserId);
    } else {
      draftLayout.status = 'Draft';
      draftLayout.validatedAt = null;
      draftLayout.validatedBy = null;
    }
    draftLayout.lastModifiedBy = new mongoose.Types.ObjectId(adminUserId);

    await draftLayout.save();

    await (AuditLogModel as mongoose.Model<AuditLog>).create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      actionCode: isValid ? 'LAYOUT_VALIDATION_PASSED' : 'LAYOUT_VALIDATION_FAILED',
      module: 'Parking Management',
      actionTitle: isValid ? 'Parking Layout Validation Passed' : 'Parking Layout Validation Failed',
      description: isValid
        ? `Administrator validated layout for floor. All structural checks passed.`
        : `Administrator ran layout validation. Structural errors found: ${errors.join('; ')}`,
      targetCollection: 'parkingLayouts',
      targetDocumentId: draftLayout._id,
      parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
      ipAddress: normalizeIp(ipAddress),
      actionStatus: isValid ? 'Success' : 'Failed',
      metadata: {
        floorId,
        isValid,
        errorsCount: errors.length,
      },
    });

    return {
      isValid,
      errors,
      layout: draftLayout,
      message: isValid
        ? 'Layout validation passed successfully. Ready for publication.'
        : 'Layout validation failed. Please address the errors before publishing.',
    };
  }

  /**
   * Publishes the validated draft layout.
   * Rules:
   * 1. Must be validated first.
   * 2. Previous published version is archived, NOT overwritten.
   * 3. Draft becomes the official published version.
   * 4. CRITICAL RULE: "Publishing a layout must NEVER automatically activate the Parking Lot."
   */
  static async publishDraftLayout(
    parkingLotId: string,
    floorId: string,
    adminUserId: string,
    ipAddress?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId) || !mongoose.Types.ObjectId.isValid(floorId)) {
      throw new AppError('Invalid parking lot ID or floor ID.', 400);
    }

    const parkingLot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(parkingLotId)
      .exec();
    if (!parkingLot) {
      throw new AppError('Parking lot not found.', 404);
    }

    const floor = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
      .findOne({ _id: floorId, parkingLotId })
      .exec();
    if (!floor) {
      throw new AppError('Floor not found or does not belong to this parking lot.', 404);
    }

    let draftLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({
        parkingLotId,
        floorId,
        status: { $in: ['Draft', 'Validated'] },
      })
      .exec();

    if (!draftLayout) {
      throw new AppError('No active draft layout found to publish.', 404);
    }

    // Must pass validation before publishing
    if (!draftLayout.isValidated) {
      const validationResult = await this.validateDraftLayout(
        parkingLotId,
        floorId,
        adminUserId,
        ipAddress,
      );
      if (!validationResult.isValid) {
        throw new AppError(
          `Cannot publish layout with validation errors: ${validationResult.errors.join('; ')}`,
          400,
        );
      }
      draftLayout = validationResult.layout as unknown as mongoose.HydratedDocument<ParkingLayout>;
    }

    if (!draftLayout) {
      throw new AppError('No active draft layout found to publish.', 404);
    }

    // Archive previous published layout if any
    await (ParkingLayoutModel as mongoose.Model<ParkingLayout>).updateMany(
      {
        parkingLotId,
        floorId,
        isPublished: true,
      },
      {
        $set: {
          isPublished: false,
          status: 'Archived',
        },
      },
    );

    // Promote draft to published
    draftLayout.isPublished = true;
    draftLayout.status = 'Published';
    draftLayout.publishedAt = new Date();
    draftLayout.publishedBy = new mongoose.Types.ObjectId(adminUserId);
    draftLayout.lastModifiedBy = new mongoose.Types.ObjectId(adminUserId);

    await draftLayout.save();

    // Synchronize isOverflow on all slots from published elements
    const publishedSlotElements = (draftLayout.elements || []).filter(
      (el: any) => el.elementType === 'ParkingSlot' && el.slotId,
    );
    for (const el of publishedSlotElements) {
      if (el.isOverflow !== undefined) {
        await (ParkingSlotModel as mongoose.Model<ParkingSlot>).findByIdAndUpdate(
          el.slotId,
          { $set: { isOverflow: Boolean(el.isOverflow) } },
        );
      }
    }
    const finalOverflowCount = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .countDocuments({
        parkingLotId: parkingLot._id,
        isOverflow: true,
      })
      .exec();
    parkingLot.overflowSlotCount = finalOverflowCount;

    // NOTICE: We do NOT touch parkingLot.parkingStatus! Publishing NEVER activates the parking lot.
    // Instead, update layoutReviewStatus to 'Pending Owner Review' for Owner's final inspection & confirmation.
    parkingLot.layoutReviewStatus = 'Pending Owner Review';
    parkingLot.layoutReviewNotes = null;
    parkingLot.layoutReviewFloorId = null;
    parkingLot.layoutReviewFloorName = null;
    await parkingLot.save();

    // Notify Parking Owner via In-App Notification and Email
    try {
      const ownerUser = await (UserModel as mongoose.Model<User>).findById(parkingLot.ownerId).lean().exec();
      await notificationService.createNotification({
        userId: parkingLot.ownerId,
        senderId: adminUserId,
        notificationType: 'Parking Facility',
        eventType: 'Parking Facility Layout Published',
        title: '2D Parking Layout Ready for Review',
        message: `The official 2D parking layout for "${parkingLot.parkingName}" (Floor: ${floor.floorName}) has been published. Please review and confirm the layout to activate your facility.`,
        priority: 'High',
        actionUrl: `/owner/parking-lots/${parkingLot._id}/layout`,
        metadata: {
          parkingLotId: parkingLot._id.toString(),
          floorId: floor._id.toString(),
          floorName: floor.floorName,
          version: draftLayout.version,
        },
      });

      if (ownerUser && ownerUser.email) {
        await emailService.sendEmail({
          to: ownerUser.email,
          subject: `ParkEase — 2D Parking Layout Published for "${parkingLot.parkingName}"`,
          text: `Dear ${ownerUser.fullName},\n\nThe official 2D visual layout for floor "${floor.floorName}" of your facility "${parkingLot.parkingName}" has been published by the administration team.\n\nPlease log in to review the interactive plan and confirm it to activate your facility.\n\nBest regards,\nThe ParkEase Team`,
          html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #ea580c; margin-top: 0;">2D Layout Published for Review</h2>
            <p>Dear <strong>${ownerUser.fullName}</strong>,</p>
            <p>The official 2D visual layout for floor <strong>${floor.floorName}</strong> of your parking facility <strong>${parkingLot.parkingName}</strong> has been configured and published by the platform administration team.</p>
            <p>Please review the interactive floor plan, slot arrangements, and navigation flow in your Owner Portal. Once confirmed, you can activate your facility and go live.</p>
            <div style="margin: 24px 0;">
              <a href="/owner/parking-lots/${parkingLot._id}/layout" style="background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Review 2D Plan</a>
            </div>
            <p style="font-size: 13px; color: #64748b;">If you notice any adjustments needed, you can submit revision requests directly from the review page.</p>
          </div>`,
        });
      }
    } catch (notifErr) {
      console.error('Failed to dispatch layout published notification to owner:', notifErr);
    }

    // Record Audit Log
    await (AuditLogModel as mongoose.Model<AuditLog>).create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      actionCode: 'LAYOUT_PUBLISHED',
      module: 'Parking Management',
      actionTitle: 'Official Parking Layout Published',
      description: `Administrator published official 2D layout (v${draftLayout.version}) for floor "${floor.floorName}" of lot "${parkingLot.parkingName}".`,
      targetCollection: 'parkingLayouts',
      targetDocumentId: draftLayout._id,
      parkingLotId: parkingLot._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        floorId: floor._id.toString(),
        version: draftLayout.version,
        publishedElementsCount: draftLayout.elements.length,
      },
    });

    return {
      layout: draftLayout,
      message: 'Official 2D parking layout published successfully.',
    };
  }

  /**
   * Discards the active draft layout.
   */
  static async discardDraftLayout(
    parkingLotId: string,
    floorId: string,
    adminUserId: string,
    ipAddress?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId) || !mongoose.Types.ObjectId.isValid(floorId)) {
      throw new AppError('Invalid parking lot ID or floor ID.', 400);
    }

    const draftLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({
        parkingLotId,
        floorId,
        status: { $in: ['Draft', 'Validated'] },
      })
      .exec();

    if (!draftLayout) {
      throw new AppError('No active draft layout found to discard.', 404);
    }

    await (ParkingLayoutModel as mongoose.Model<ParkingLayout>).deleteOne({ _id: draftLayout._id });

    await (AuditLogModel as mongoose.Model<AuditLog>).create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      actionCode: 'LAYOUT_DRAFT_DISCARDED',
      module: 'Parking Management',
      actionTitle: 'Parking Layout Draft Discarded',
      description: `Administrator discarded active layout draft (v${draftLayout.version}) for floor.`,
      targetCollection: 'parkingLayouts',
      targetDocumentId: draftLayout._id,
      parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        floorId,
        discardedVersion: draftLayout.version,
      },
    });

    return {
      message: 'Active draft layout discarded successfully.',
    };
  }

  /**
   * Replicates all DrivingLane elements from a source floor (typically Ground Floor) to one or more upper floors.
   * Generates new elementIds for target floors while strictly preserving internal lane connection topologies,
   * positions, dimensions, rotation, and directions.
   */
  static async replicateLaneNetwork(
    parkingLotId: string,
    sourceFloorId: string,
    targetFloorIds: string[],
    options: {
      replaceExisting?: boolean;
      adminUserId: string;
      ipAddress?: string | undefined;
    },
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId) || !mongoose.Types.ObjectId.isValid(sourceFloorId)) {
      throw new AppError('Invalid parking lot ID or source floor ID format.', 400);
    }
    if (!Array.isArray(targetFloorIds) || targetFloorIds.length === 0) {
      throw new AppError('At least one target floor ID must be provided.', 400);
    }

    const { replaceExisting = true, adminUserId, ipAddress } = options;

    const sourceFloorDoc = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
      .findOne({ _id: sourceFloorId, parkingLotId })
      .lean()
      .exec();
    if (!sourceFloorDoc) {
      throw new AppError('Source floor not found or does not belong to this parking lot.', 404);
    }

    let sourceLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
      .findOne({
        parkingLotId,
        floorId: sourceFloorId,
        status: { $in: ['Draft', 'Validated'] },
      })
      .lean()
      .exec();

    if (!sourceLayout) {
      sourceLayout = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
        .findOne({
          parkingLotId,
          floorId: sourceFloorId,
          isPublished: true,
        })
        .lean()
        .exec();
    }

    if (!sourceLayout) {
      throw new AppError('Source floor does not have a layout with driving lanes to replicate.', 404);
    }

    const sourceLanes = (sourceLayout.elements || []).filter((el) => el.elementType === 'DrivingLane');
    if (sourceLanes.length === 0) {
      throw new AppError(`Source floor "${sourceFloorDoc.floorName}" has no driving lanes to replicate.`, 400);
    }

    const replicatedResults: Array<{ floorId: string; floorName: string; lanesCount: number }> = [];

    for (const tFloorId of targetFloorIds) {
      if (!mongoose.Types.ObjectId.isValid(tFloorId)) continue;
      if (tFloorId.toString() === sourceFloorId.toString()) continue;

      const targetFloorDoc = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
        .findOne({ _id: tFloorId, parkingLotId })
        .lean()
        .exec();
      if (!targetFloorDoc) continue;

      let targetDraft = await (ParkingLayoutModel as mongoose.Model<ParkingLayout>)
        .findOne({
          parkingLotId,
          floorId: tFloorId,
          status: { $in: ['Draft', 'Validated'] },
        })
        .exec();

      if (!targetDraft) {
        const initResult = await this.initDraftLayout(parkingLotId, tFloorId, adminUserId, ipAddress);
        targetDraft = initResult.layout as mongoose.HydratedDocument<ParkingLayout>;
      }

      if (!targetDraft) continue;

      // Generate unique IDs and map internal connections between lanes
      const idMap = new Map<string, string>();
      const clonedLanes = sourceLanes.map((lane) => {
        const newId = `LANE-${Date.now().toString(36)}-${Math.floor(Math.random() * 9000 + 1000)}`;
        idMap.set(lane.elementId, newId);
        return {
          ...lane,
          elementId: newId,
        };
      });

      const remappedLanes = clonedLanes.map((lane) => ({
        ...lane,
        connectedLaneIds: (lane.connectedLaneIds || []).map((oldId) => idMap.get(oldId) || oldId),
      }));

      let newElements = (targetDraft.elements || []).map((el: any) =>
        el.toObject ? el.toObject() : el,
      );

      if (replaceExisting) {
        newElements = newElements.filter((el: any) => el.elementType !== 'DrivingLane');
      }

      newElements.push(...remappedLanes);

      const totalSlots = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
        .countDocuments({ parkingLotId, floorId: tFloorId })
        .exec();

      targetDraft.elements = newElements as unknown as ParkingLayout['elements'];
      targetDraft.stats = calculateLayoutStats(newElements as unknown as LayoutElementInput[], totalSlots) as unknown as ParkingLayout['stats'];
      targetDraft.isValidated = false;
      targetDraft.validationErrors = [];
      targetDraft.lastModifiedBy = new mongoose.Types.ObjectId(adminUserId);
      await targetDraft.save();

      replicatedResults.push({
        floorId: tFloorId,
        floorName: targetFloorDoc.floorName,
        lanesCount: remappedLanes.length,
      });
    }

    // Record Audit Log
    await (AuditLogModel as mongoose.Model<AuditLog>).create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      actionCode: 'LANE_NETWORK_REPLICATED',
      module: 'Parking Management',
      actionTitle: 'Lane Network Replicated to Upper Floors',
      description: `Administrator replicated ${sourceLanes.length} driving lanes from floor "${sourceFloorDoc.floorName}" to ${replicatedResults.length} target floor(s).`,
      targetCollection: 'parkingLayouts',
      parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        sourceFloorId,
        sourceFloorName: sourceFloorDoc.floorName,
        lanesCount: sourceLanes.length,
        targetFloors: replicatedResults,
      },
    });

    return {
      message: `Replicated ${sourceLanes.length} driving lanes to ${replicatedResults.length} floor(s) successfully.`,
      sourceFloorName: sourceFloorDoc.floorName,
      lanesCount: sourceLanes.length,
      targetFloors: replicatedResults,
    };
  }

  /**
   * Updates facility canvas boundary (width & height) atomically across all floors of a parking lot.
   */
  static async updateFacilityCanvasBoundary(
    parkingLotId: string,
    width: number,
    height: number,
    adminUserId: string,
    ipAddress?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking lot ID format.', 400);
    }

    const cleanW = Math.max(400, Math.min(10000, Math.round(Number(width) || 1600)));
    const cleanH = Math.max(400, Math.min(10000, Math.round(Number(height) || 1000)));

    await (ParkingLayoutModel as mongoose.Model<ParkingLayout>).updateMany(
      { parkingLotId: new mongoose.Types.ObjectId(parkingLotId) },
      {
        $set: {
          'canvasConfig.width': cleanW,
          'canvasConfig.height': cleanH,
          lastModifiedBy: new mongoose.Types.ObjectId(adminUserId),
        },
      },
    );

    return {
      width: cleanW,
      height: cleanH,
      message: `Facility canvas boundary updated to ${cleanW} × ${cleanH} px across all floors.`,
    };
  }

  /**
   * Owner confirms and approves the 2D visual layout for their facility.
   */
  static async ownerConfirmLayout(
    parkingLotId: string,
    ownerUserId: string,
    notes?: string,
    ipAddress?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking lot ID format.', 400);
    }

    const parkingLot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(parkingLotId)
      .exec();
    if (!parkingLot) {
      throw new AppError('Parking lot not found.', 404);
    }

    if (parkingLot.ownerId.toString() !== ownerUserId.toString()) {
      throw new AppError('Access denied: You do not own this parking facility.', 403);
    }

    // Set confirmed state
    parkingLot.layoutReviewStatus = 'Owner Confirmed';
    parkingLot.layoutConfirmedAt = new Date();
    if (notes && notes.trim()) {
      parkingLot.layoutReviewNotes = notes.trim();
    }
    await parkingLot.save();

    // Audit Log
    await (AuditLogModel as mongoose.Model<AuditLog>).create({
      userId: new mongoose.Types.ObjectId(ownerUserId),
      actionCode: 'LAYOUT_CONFIRMED_BY_OWNER',
      module: 'Parking Management',
      actionTitle: 'Parking Layout Confirmed by Owner',
      description: `Parking Owner approved and confirmed the 2D layout for lot "${parkingLot.parkingName}".`,
      targetCollection: 'parkingLots',
      targetDocumentId: parkingLot._id,
      parkingLotId: parkingLot._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        confirmedAt: parkingLot.layoutConfirmedAt,
        notes: parkingLot.layoutReviewNotes,
      },
    });

    // Notify Admins
    try {
      await notificationService.notifyAdmins({
        title: 'Layout Confirmed by Owner',
        message: `Owner of "${parkingLot.parkingName}" has approved the 2D layout. The facility is now ready for go-live activation.`,
        notificationType: 'Parking Facility',
        eventType: 'Parking Facility Layout Confirmed',
        priority: 'Normal',
      });
    } catch (notifErr) {
      console.error('Failed to notify admins of owner layout confirmation:', notifErr);
    }

    return {
      parkingLot,
      message: 'Parking layout confirmed and approved successfully. Facility is ready for activation.',
    };
  }

  /**
   * Owner submits feedback / changes requested on the 2D visual layout.
   */
  static async ownerRequestLayoutChanges(
    parkingLotId: string,
    ownerUserId: string,
    notes: string,
    floorId?: string,
    ipAddress?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking lot ID format.', 400);
    }

    if (!notes || !notes.trim()) {
      throw new AppError('Feedback notes are required when requesting layout changes.', 400);
    }

    const parkingLot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(parkingLotId)
      .exec();
    if (!parkingLot) {
      throw new AppError('Parking lot not found.', 404);
    }

    if (parkingLot.ownerId.toString() !== ownerUserId.toString()) {
      throw new AppError('Access denied: You do not own this parking facility.', 403);
    }

    let targetFloor: (mongoose.HydratedDocument<ParkingFloor>) | null = null;
    if (floorId && mongoose.Types.ObjectId.isValid(floorId)) {
      targetFloor = await (ParkingFloorModel as mongoose.Model<ParkingFloor>)
        .findOne({ _id: floorId, parkingLotId })
        .exec();
    }

    // Set changes requested state
    parkingLot.layoutReviewStatus = 'Owner Changes Requested';
    parkingLot.layoutReviewNotes = notes.trim();
    parkingLot.layoutReviewFloorId = targetFloor ? targetFloor._id : null;
    parkingLot.layoutReviewFloorName = targetFloor ? targetFloor.floorName : null;
    await parkingLot.save();

    // Audit Log
    await (AuditLogModel as mongoose.Model<AuditLog>).create({
      userId: new mongoose.Types.ObjectId(ownerUserId),
      actionCode: 'LAYOUT_CHANGES_REQUESTED',
      module: 'Parking Management',
      actionTitle: 'Layout Revision Requested by Owner',
      description: `Parking Owner requested changes for lot "${parkingLot.parkingName}"${targetFloor ? ` (${targetFloor.floorName})` : ''}: "${notes.trim().slice(0, 150)}"`,
      targetCollection: 'parkingLots',
      targetDocumentId: parkingLot._id,
      parkingLotId: parkingLot._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        floorId: targetFloor ? targetFloor._id.toString() : null,
        floorName: targetFloor ? targetFloor.floorName : null,
        notes: notes.trim(),
      },
    });

    // Notify Admins
    try {
      const floorContext = targetFloor ? ` on floor "${targetFloor.floorName}"` : '';
      await notificationService.notifyAdmins({
        title: 'Layout Revision Requested',
        message: `Owner of "${parkingLot.parkingName}" requested layout changes${floorContext}: "${notes.trim().slice(0, 100)}"`,
        notificationType: 'Parking Facility',
        eventType: 'Parking Facility Layout Changes Requested',
        priority: 'High',
        actionUrl: `/admin/parking-lots/${parkingLot._id}/layout${targetFloor ? `?floorId=${targetFloor._id}` : ''}`,
      });
    } catch (notifErr) {
      console.error('Failed to notify admins of owner layout changes request:', notifErr);
    }

    return {
      parkingLot,
      message: 'Revision feedback submitted to the platform team successfully.',
    };
  }

  /**
   * Activates the facility (sets parkingStatus: 'Active', isVerified: true).
   * Can be invoked by Owner (if layoutReviewStatus === 'Owner Confirmed') or Admin.
   */
  static async activateFacility(
    parkingLotId: string,
    userId: string,
    roleId?: string,
    ipAddress?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking lot ID format.', 400);
    }

    const parkingLot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(parkingLotId)
      .exec();
    if (!parkingLot) {
      throw new AppError('Parking lot not found.', 404);
    }

    let userRole = 'User';
    if (roleId && mongoose.isValidObjectId(roleId)) {
      const role = await (RoleModel as mongoose.Model<Role>).findById(roleId).lean().exec();
      if (role?.roleName) {
        userRole = role.roleName;
      }
    }

    const isAdmin = ['Admin', 'SuperAdmin', 'Super Admin'].includes(userRole);
    const isOwner = parkingLot.ownerId.toString() === userId.toString();

    if (!isAdmin && !isOwner) {
      throw new AppError('Access denied: You do not have permission to activate this facility.', 403);
    }

    if (parkingLot.layoutReviewStatus !== 'Owner Confirmed') {
      throw new AppError(
        'Facility cannot be activated until the parking layout is confirmed and approved by the owner.',
        400,
      );
    }

    parkingLot.parkingStatus = 'Active';
    parkingLot.isVerified = true;
    await parkingLot.save();

    // Audit Log
    await (AuditLogModel as mongoose.Model<AuditLog>).create({
      userId: new mongoose.Types.ObjectId(userId),
      actionCode: 'PARKING_LOT_ACTIVATED',
      module: 'Parking Management',
      actionTitle: 'Parking Facility Activated (Live)',
      description: `Parking facility "${parkingLot.parkingName}" was activated and went LIVE by ${userRole}.`,
      targetCollection: 'parkingLots',
      targetDocumentId: parkingLot._id,
      parkingLotId: parkingLot._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        activatedByRole: userRole,
        activatedAt: new Date(),
      },
    });

    // Notify Owner or Admins
    try {
      if (isAdmin) {
        await notificationService.createNotification({
          userId: parkingLot.ownerId,
          senderId: userId,
          notificationType: 'Parking Facility',
          eventType: 'Parking Facility Activated',
          title: 'Parking Facility Is Now Live! 🚀',
          message: `Your parking facility "${parkingLot.parkingName}" has been activated by the platform team and is now live for bookings.`,
          priority: 'High',
          actionUrl: `/owner/dashboard`,
          metadata: { parkingLotId: parkingLot._id.toString() },
        });
      } else {
        await notificationService.notifyAdmins({
          title: 'Facility Activated & Live',
          message: `Owner has activated facility "${parkingLot.parkingName}". It is now LIVE for operations.`,
          notificationType: 'Parking Facility',
          eventType: 'Parking Facility Activated',
          priority: 'Normal',
        });
      }
    } catch (notifErr) {
      console.error('Failed to dispatch activation notification:', notifErr);
    }

    return {
      parkingLot,
      message: 'Parking facility activated successfully and is now LIVE!',
    };
  }

  /**
   * Updates the facility overflow capacity threshold.
   * Enforces that threshold cannot be set below active/reserved overflow bookings.
   */
  static async updateOverflowConfig(
    parkingLotId: string,
    overflowCapacity: number,
    adminUserId: string,
    ipAddress?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Invalid parking lot ID.', 400);
    }
    if (typeof overflowCapacity !== 'number' || overflowCapacity < 0) {
      throw new AppError('Overflow capacity must be a non-negative number.', 400);
    }

    const parkingLot = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .findById(parkingLotId)
      .exec();
    if (!parkingLot) {
      throw new AppError('Parking lot not found.', 404);
    }

    // Check active/confirmed bookings on overflow slots
    const overflowSlots = await (ParkingSlotModel as mongoose.Model<ParkingSlot>)
      .find({
        parkingLotId: parkingLot._id,
        isOverflow: true,
      })
      .select('_id')
      .lean()
      .exec();

    const overflowSlotIds = overflowSlots.map((s) => s._id);

    const activeOverflowBookingsCount = await (BookingModel as mongoose.Model<Booking>)
      .countDocuments({
        parkingLotId: parkingLot._id,
        currentSlotId: { $in: overflowSlotIds },
        bookingStatus: { $in: ['Confirmed', 'Active', 'Overstay'] },
      })
      .exec();

    if (overflowCapacity < activeOverflowBookingsCount) {
      throw new AppError(
        `Cannot reduce overflow capacity to ${overflowCapacity}. There are currently ${activeOverflowBookingsCount} active/confirmed bookings occupying overflow bays.`,
        400,
        'OVERFLOW_CAPACITY_CONFLICT',
      );
    }

    parkingLot.overflowCapacity = overflowCapacity;
    parkingLot.overflowSlotCount = overflowSlots.length;
    await parkingLot.save();

    await (AuditLogModel as mongoose.Model<AuditLog>).create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      actionCode: 'OVERFLOW_CONFIG_UPDATED',
      module: 'Parking Management',
      actionTitle: 'Overflow Capacity Threshold Updated',
      description: `Administrator updated overflow capacity threshold for "${parkingLot.parkingName}" to ${overflowCapacity} (Current overflow bays: ${overflowSlots.length}).`,
      targetCollection: 'parkingLots',
      targetDocumentId: parkingLot._id,
      parkingLotId: parkingLot._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        previousCapacity: parkingLot.overflowCapacity,
        newCapacity: overflowCapacity,
        overflowSlotCount: overflowSlots.length,
      },
    });

    return {
      overflowCapacity: parkingLot.overflowCapacity,
      overflowSlotCount: parkingLot.overflowSlotCount,
      message: 'Overflow capacity threshold updated successfully.',
    };
  }
}
