export type DesignerMode = 'edit' | 'preview' | 'booking';

export type ToolType = 'select' | 'pan' | 'measure';

export interface UnplacedSlotItem {
  _id: string;
  slotNumber: string;
  slotLabel: string;
  slotType: string;
  supportedVehicleType: string;
  slotStatus: string;
  qrIdentifier: string;
  zoneId: {
    _id: string;
    zoneName: string;
    zoneCode: string;
  } | string;
}

export interface CanvasTransform {
  zoom: number; // e.g. 1.0 = 100%
  panX: number;
  panY: number;
}

export interface DraggingElementState {
  elementId: string;
  startX: number;
  startY: number;
  initialElemX: number;
  initialElemY: number;
  hasMoved: boolean;
}

export interface FrameResizeState {
  handle: 'corner' | 'right' | 'bottom';
  startX: number;
  startY: number;
  initialWidth: number;
  initialHeight: number;
}

export type ResizeHandlePosition =
  | 'e'
  | 'w'
  | 's'
  | 'n'
  | 'se'
  | 'sw'
  | 'ne'
  | 'nw'
  | 'corner'
  | 'width'
  | 'height';

export interface ElementResizeState {
  elementId: string;
  handle?: ResizeHandlePosition;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
  initialRotation?: number;
}

export type LaneConnectionType = 'forward' | 'backward' | 'turn-left' | 'turn-right';

export interface PropDimensionDefaults {
  // Driving Lanes
  straightLane: { width: number; height: number };
  cornerTurn: { width: number; height: number };
  tJunction: { width: number; height: number };
  squareConnector: { width: number; height: number };

  // Parking Slots
  parkingSlot: { width: number; height: number };

  // Gates & Physical Structures
  entranceGate: { width: number; height: number };
  exitGate: { width: number; height: number };
  pillar: { width: number; height: number };
  wall: { width: number; height: number };
  ramp: { width: number; height: number };

  // Vertical Circulation & Pedestrian Access
  lift: { width: number; height: number };
  staircase: { width: number; height: number };
  liftStaircase: { width: number; height: number };

  // Building & Complex Access (Mall, Hospital, Plaza)
  buildingEntrance: { width: number; height: number };

  // Smart Guides & Placement Assister
  enableSlotAssister?: boolean;
}

export type DimensionPropKey =
  | 'straightLane'
  | 'cornerTurn'
  | 'tJunction'
  | 'squareConnector'
  | 'parkingSlot'
  | 'entranceGate'
  | 'exitGate'
  | 'pillar'
  | 'wall'
  | 'ramp'
  | 'lift'
  | 'staircase'
  | 'liftStaircase'
  | 'buildingEntrance';

export const DEFAULT_PROP_DIMENSIONS: PropDimensionDefaults = {
  straightLane: { width: 480, height: 100 },
  cornerTurn: { width: 140, height: 140 },
  tJunction: { width: 180, height: 120 },
  squareConnector: { width: 100, height: 100 },
  parkingSlot: { width: 70, height: 120 },
  entranceGate: { width: 140, height: 50 },
  exitGate: { width: 140, height: 50 },
  pillar: { width: 40, height: 40 },
  wall: { width: 240, height: 16 },
  ramp: { width: 160, height: 100 },
  lift: { width: 80, height: 80 },
  staircase: { width: 100, height: 70 },
  liftStaircase: { width: 150, height: 80 },
  buildingEntrance: { width: 140, height: 60 },
  enableSlotAssister: true,
};

/**
 * Robustly merges user-saved or partial prop dimension configurations with
 * system defaults, ensuring newly introduced props never crash with undefined fields.
 */
export function mergePropDefaults(
  customDefaults?: Partial<PropDimensionDefaults> | null,
): PropDimensionDefaults {
  if (!customDefaults) return { ...DEFAULT_PROP_DIMENSIONS };
  return {
    ...DEFAULT_PROP_DIMENSIONS,
    ...customDefaults,
    straightLane: { ...DEFAULT_PROP_DIMENSIONS.straightLane, ...(customDefaults.straightLane || {}) },
    cornerTurn: { ...DEFAULT_PROP_DIMENSIONS.cornerTurn, ...(customDefaults.cornerTurn || {}) },
    tJunction: { ...DEFAULT_PROP_DIMENSIONS.tJunction, ...(customDefaults.tJunction || {}) },
    squareConnector: { ...DEFAULT_PROP_DIMENSIONS.squareConnector, ...(customDefaults.squareConnector || {}) },
    parkingSlot: { ...DEFAULT_PROP_DIMENSIONS.parkingSlot, ...(customDefaults.parkingSlot || {}) },
    entranceGate: { ...DEFAULT_PROP_DIMENSIONS.entranceGate, ...(customDefaults.entranceGate || {}) },
    exitGate: { ...DEFAULT_PROP_DIMENSIONS.exitGate, ...(customDefaults.exitGate || {}) },
    pillar: { ...DEFAULT_PROP_DIMENSIONS.pillar, ...(customDefaults.pillar || {}) },
    wall: { ...DEFAULT_PROP_DIMENSIONS.wall, ...(customDefaults.wall || {}) },
    ramp: { ...DEFAULT_PROP_DIMENSIONS.ramp, ...(customDefaults.ramp || {}) },
    lift: { ...DEFAULT_PROP_DIMENSIONS.lift, ...(customDefaults.lift || {}) },
    staircase: { ...DEFAULT_PROP_DIMENSIONS.staircase, ...(customDefaults.staircase || {}) },
    liftStaircase: { ...DEFAULT_PROP_DIMENSIONS.liftStaircase, ...(customDefaults.liftStaircase || {}) },
    buildingEntrance: { ...DEFAULT_PROP_DIMENSIONS.buildingEntrance, ...(customDefaults.buildingEntrance || {}) },
    enableSlotAssister:
      customDefaults.enableSlotAssister !== undefined
        ? customDefaults.enableSlotAssister
        : DEFAULT_PROP_DIMENSIONS.enableSlotAssister,
  };
}

/**
 * Clamps any element's coordinates so its visual bounding box
 * (accounting for any rotation angle) strictly stays within the canvas
 * and inside the facility boundary walls.
 */
export function clampElementInsideBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number = 0,
  canvasWidth: number = 1600,
  canvasHeight: number = 1000,
  isGate: boolean = false,
  wallThickness: number = 14,
): { x: number; y: number } {
  const rad = (rotation * Math.PI) / 180;
  const absCos = Math.abs(Math.cos(rad));
  const absSin = Math.abs(Math.sin(rad));

  // Half-extents of the rotated visual bounding box
  const halfW = (width * absCos + height * absSin) / 2;
  const halfH = (width * absSin + height * absCos) / 2;

  // Inset: gates breach the wall (inset 0), other props must stay inside the facility walls
  const inset = isGate ? 0 : wallThickness;
  const minAllowedX = inset;
  const maxAllowedX = Math.max(inset + 20, canvasWidth - inset);
  const minAllowedY = inset;
  const maxAllowedY = Math.max(inset + 20, canvasHeight - inset);

  // Center coordinates
  const cx = x + width / 2;
  const cy = y + height / 2;

  // Clamp center so the entire visual bounding box stays inside the boundary wall
  const clampedCx = Math.max(minAllowedX + halfW, Math.min(maxAllowedX - halfW, cx));
  const clampedCy = Math.max(minAllowedY + halfH, Math.min(maxAllowedY - halfH, cy));

  return {
    x: Math.round((clampedCx - width / 2) * 10) / 10,
    y: Math.round((clampedCy - height / 2) * 10) / 10,
  };
}

