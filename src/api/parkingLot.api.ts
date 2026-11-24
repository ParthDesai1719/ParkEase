import { apiClient } from './client';
import type { ApiResponse } from '../types/auth';

export interface OfficialParkingLot {
  _id: string;
  ownerId:
    | {
        _id: string;
        fullName: string;
        email: string;
        mobileNumber?: string;
      }
    | string;
  submissionId?:
    | {
        _id: string;
        submissionReference: string;
        facilityName: string;
        facilityType: string;
      }
    | string
    | null;
  parkingName: string;
  parkingType?: string;
  address?:
    | string
    | {
        street?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        landmark?: string;
      };
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  totalFloors: number;
  totalCapacity?: number;
  overflowCapacity?: number;
  overflowSlotCount?: number;
  totalSlots?: number;
  availableCapacity?: number;
  availableSlots?: number;
  occupiedSlots?: number;
  reservedSlots?: number;
  occupancyPercentage?: number;
  description?: string | null;
  contactNumber?: string;
  supportEmail?: string | null;
  gracePeriodMinutes?: number;
  operatingHours?: {
    open24x7?: boolean;
    openTime?: string | null;
    closeTime?: string | null;
  };
  isOpen24Hours?: boolean;
  openingTime?: string;
  closingTime?: string;
  pricingModel?: string;
  hourlyRate?: number;
  amenities?: string[];
  parkingStatus: string;
  isVerified?: boolean;
  layoutReviewStatus?: 'Draft' | 'Pending Owner Review' | 'Owner Changes Requested' | 'Owner Confirmed';
  layoutReviewNotes?: string | null;
  layoutReviewFloorId?: string | null;
  layoutReviewFloorName?: string | null;
  layoutConfirmedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OfficialHierarchySlot {
  _id: string;
  slotNumber: string;
  slotLabel: string;
  slotType: 'Standard' | 'EV Charging' | 'Accessible' | 'VIP' | 'Large Vehicle' | 'Compact';
  supportedVehicleType: 'Two-Wheeler' | 'Car' | 'Bus/Truck';
  slotStatus: 'Available' | 'Occupied' | 'Reserved' | 'Out of Service' | 'Under Maintenance' | 'Overstay' | 'Barrier Open';
  qrIdentifier: string;
  remarks?: string | null;
  isOverflow?: boolean;
}

export interface OfficialHierarchyZone {
  _id: string;
  zoneName: string;
  zoneCode: string;
  vehicleType: 'Car' | 'Two-Wheeler' | 'EV' | 'Accessible' | 'Heavy Vehicle' | 'Mixed' | null;
  totalSlots: number;
  availableSlots: number;
  zoneStatus: 'Active' | 'Inactive' | 'Maintenance';
  slots: OfficialHierarchySlot[];
}

export interface OfficialHierarchyFloor {
  _id: string;
  floorName: string;
  floorNumber: number;
  description?: string | null;
  totalZones: number;
  totalSlots: number;
  availableSlots: number;
  floorStatus: 'Active' | 'Inactive' | 'Maintenance';
  zones: OfficialHierarchyZone[];
}

export interface OfficialParkingLotHierarchy {
  parkingLot: OfficialParkingLot;
  floors: OfficialHierarchyFloor[];
  stats: {
    totalFloors: number;
    totalZones: number;
    totalSlots: number;
    availableSlots: number;
    occupiedSlots: number;
    reservedSlots: number;
  };
}

export interface LayoutCanvasConfig {
  width: number;
  height: number;
  gridSize: number;
  snapToGrid: boolean;
  backgroundColor: string;
}

export interface LayoutElementData {
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
  slotId?: string | null;
  slotNumber?: string | null;
  isOverflow?: boolean;
  zoneId?: string | null;
  zoneCode?: string | null;
  zoneName?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  label?: string | null;
  color?: string | null;
  laneDirection?: 'Two-Way' | 'One-Way-Forward' | 'One-Way-Backward' | null;
  rampDirection?: 'Up' | 'Down' | 'Two-Way' | null;
  portalType?: 'Entry' | 'Exit' | 'Two-Way' | null;
  targetFloorId?: string | null;
  targetFloorName?: string | null;
  restrictedReason?: string | null;
  reservedFor?: string | null;
  isLocked?: boolean;
  occupiesAllFloors?: boolean;
  syncAcrossAllFloors?: boolean;
  shaftGroupId?: string | null;
  rampGroupId?: string | null;
  autoPlaceOnTargetFloor?: boolean;
  buildingType?: string | null;
  connectedLaneIds?: string[] | null;
  navPointers?: Array<{
    id: string;
    targetLaneId: string | null;
    curbX?: number | null;
    curbY?: number | null;
  }> | null;
  // Customer Booking Mode dynamic fields
  slotType?: string | null;
  supportedVehicleType?: 'Bike' | 'Car' | 'SUV' | 'EV' | string | null;
  effectiveStatus?: 'Available' | 'Reserved' | 'Occupied' | 'Under Maintenance' | 'Overstay' | 'Barrier Open' | null;
  isVehicleCompatible?: boolean;
  isEligible?: boolean;
  ineligibilityReason?: string | null;
  expectedAvailableAt?: string | null;
  expectedAvailableMinutes?: number | null;
}

export interface ParkingLayoutData {
  _id: string;
  parkingLotId: string;
  floorId: string;
  version: number;
  status: 'Draft' | 'Validated' | 'Published' | 'Archived';
  canvasConfig: LayoutCanvasConfig;
  elements: LayoutElementData[];
  stats?: {
    totalSlotsCount: number;
    placedSlotsCount: number;
    unplacedSlotsCount: number;
    lanesCount: number;
    pillarsCount: number;
    wallsCount: number;
    entrancesCount: number;
    exitsCount: number;
    rampsCount?: number;
  };
  isValidated: boolean;
  validationErrors: string[];
  validatedAt?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FloorLayoutResponse {
  floor: {
    _id: string;
    floorName: string;
    floorNumber: number;
    totalSlots: number;
    floorStatus: string;
  };
  zones?: unknown[];
  layout: ParkingLayoutData | null;
  isDraft?: boolean;
  hasDraft?: boolean;
  hasPublishedLayout?: boolean;
  hasPublishedVersion?: boolean;
  publishedVersionNumber?: number | null;
  totalFloorSlots?: number;
  unplacedSlots?: unknown[];
}

export interface PaginatedParkingLotsResponse {
  parkingLots: OfficialParkingLot[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateOfficialParkingLotResult {
  parkingLot: OfficialParkingLot;
  floorsCount: number;
  zonesCount: number;
  slotsCount: number;
}

export interface GetOfficialParkingLotsParams {
  search?: string;
  status?: string;
  ownerId?: string;
  page?: number;
  limit?: number;
}

/**
 * Retrieve approved facility submissions eligible for official Parking Lot creation
 */
export async function getEligibleSubmissions(search?: string): Promise<ApiResponse<unknown[]>> {
  const params: Record<string, string> = {};
  if (search) params.search = search;

  const response = await apiClient.get<ApiResponse<unknown[]>>(
    '/admin/parking-lots/eligible-submissions',
    { params },
  );
  return response.data;
}

/**
 * Convert an approved Owner Facility Submission into an official Parking Lot with Floors, Zones, and Slots
 */
export async function createOfficialParkingLot(
  submissionId: string,
): Promise<ApiResponse<CreateOfficialParkingLotResult>> {
  const response = await apiClient.post<ApiResponse<CreateOfficialParkingLotResult>>(
    `/admin/parking-lots/from-submission/${submissionId}`,
  );
  return response.data;
}

/**
 * Retrieve paginated official parking lots (search & status filters)
 */
export async function getOfficialParkingLots(
  params?: GetOfficialParkingLotsParams,
): Promise<ApiResponse<PaginatedParkingLotsResponse>> {
  const response = await apiClient.get<ApiResponse<PaginatedParkingLotsResponse>>(
    '/admin/parking-lots',
    { params },
  );
  return response.data;
}

/**
 * Retrieve single official parking lot details
 */
export async function getOfficialParkingLotById(
  id: string,
): Promise<ApiResponse<OfficialParkingLot>> {
  const response = await apiClient.get<ApiResponse<OfficialParkingLot>>(
    `/admin/parking-lots/${id}`,
  );
  return response.data;
}

/**
 * Retrieve complete official structural hierarchy: Lot -> Floors -> Zones -> Slots
 */
export async function getOfficialParkingLotHierarchy(
  id: string,
): Promise<ApiResponse<OfficialParkingLotHierarchy>> {
  const response = await apiClient.get<ApiResponse<OfficialParkingLotHierarchy>>(
    `/admin/parking-lots/${id}/hierarchy`,
  );
  return response.data;
}

/**
 * 2D Layout API — Retrieve Floor Layout (Admin Draft or Published)
 */
export async function getFloorLayout(
  lotId: string,
  floorId: string,
): Promise<ApiResponse<FloorLayoutResponse>> {
  const response = await apiClient.get<ApiResponse<FloorLayoutResponse>>(
    `/admin/parking-lots/${lotId}/floors/${floorId}/layout`,
  );
  return response.data;
}

/**
 * 2D Layout API — Initialize Draft Layout for Floor
 */
export async function initDraftLayout(
  lotId: string,
  floorId: string,
): Promise<ApiResponse<{ layout: ParkingLayoutData; isNew: boolean; unplacedSlots: unknown[] }>> {
  const response = await apiClient.post<
    ApiResponse<{ layout: ParkingLayoutData; isNew: boolean; unplacedSlots: unknown[] }>
  >(`/admin/parking-lots/${lotId}/floors/${floorId}/layout/init-draft`);
  return response.data;
}

/**
 * 2D Layout API — Save Elements to Draft Layout
 */
export async function saveLayoutElements(
  lotId: string,
  floorId: string,
  payload: { elements: LayoutElementData[]; canvasConfig?: Partial<LayoutCanvasConfig> },
): Promise<ApiResponse<{ layout: ParkingLayoutData; unplacedSlots: unknown[] }>> {
  const response = await apiClient.put<
    ApiResponse<{ layout: ParkingLayoutData; unplacedSlots: unknown[] }>
  >(`/admin/parking-lots/${lotId}/floors/${floorId}/layout/elements`, payload);
  return response.data;
}

/**
 * 2D Layout API — Remove Element from Draft Layout
 */
export async function removeLayoutElement(
  lotId: string,
  floorId: string,
  elementId: string,
): Promise<ApiResponse<{ layout: ParkingLayoutData; unplacedSlots: unknown[] }>> {
  const response = await apiClient.delete<
    ApiResponse<{ layout: ParkingLayoutData; unplacedSlots: unknown[] }>
  >(`/admin/parking-lots/${lotId}/floors/${floorId}/layout/elements/${elementId}`);
  return response.data;
}

/**
 * 2D Layout API — Validate Draft Layout
 */
export async function validateDraftLayout(
  lotId: string,
  floorId: string,
): Promise<ApiResponse<{ isValid: boolean; errors: string[]; layout: ParkingLayoutData }>> {
  const response = await apiClient.post<
    ApiResponse<{ isValid: boolean; errors: string[]; layout: ParkingLayoutData }>
  >(`/admin/parking-lots/${lotId}/floors/${floorId}/layout/validate`);
  return response.data;
}

/**
 * 2D Layout API — Publish Validated Layout
 */
export async function publishDraftLayout(
  lotId: string,
  floorId: string,
): Promise<ApiResponse<{ layout: ParkingLayoutData }>> {
  const response = await apiClient.post<ApiResponse<{ layout: ParkingLayoutData }>>(
    `/admin/parking-lots/${lotId}/floors/${floorId}/layout/publish`,
  );
  return response.data;
}

/**
 * 2D Layout API — Discard Draft Layout
 */
export async function discardDraftLayout(
  lotId: string,
  floorId: string,
): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/admin/parking-lots/${lotId}/floors/${floorId}/layout/draft`,
  );
  return response.data;
}

/**
 * 2D Layout API — Owner Read-Only Published Layout
 */
export async function getOwnerFloorLayout(
  lotId: string,
  floorId: string,
): Promise<ApiResponse<FloorLayoutResponse>> {
  const response = await apiClient.get<ApiResponse<FloorLayoutResponse>>(
    `/owner/parking-lots/${lotId}/floors/${floorId}/layout`,
  );
  return response.data;
}

export interface ReplicateLanesResult {
  message: string;
  sourceFloorName: string;
  lanesCount: number;
  targetFloors: Array<{ floorId: string; floorName: string; lanesCount: number }>;
}

/**
 * 2D Layout API — Replicate Lane Network to Upper Floors
 */
export async function replicateLaneNetwork(
  lotId: string,
  floorId: string,
  data: { targetFloorIds: string[]; replaceExisting?: boolean },
): Promise<ApiResponse<ReplicateLanesResult>> {
  const response = await apiClient.post<ApiResponse<ReplicateLanesResult>>(
    `/admin/parking-lots/${lotId}/floors/${floorId}/layout/replicate-lanes`,
    data,
  );
  return response.data;
}

/**
 * 2D Layout API — Update Facility Canvas Boundary across all floors
 */
export async function updateFacilityCanvasBoundary(
  lotId: string,
  data: { width: number; height: number },
): Promise<ApiResponse<{ width: number; height: number; message: string }>> {
  const response = await apiClient.patch<ApiResponse<{ width: number; height: number; message: string }>>(
    `/admin/parking-lots/${lotId}/layout/canvas-boundary`,
    data,
  );
  return response.data;
}

/**
 * 2D Layout API — Update Facility Overflow Capacity Threshold
 */
export async function updateOverflowConfig(
  lotId: string,
  overflowCapacity: number,
): Promise<ApiResponse<{ overflowCapacity: number; overflowSlotCount: number; message: string }>> {
  const response = await apiClient.patch<
    ApiResponse<{ overflowCapacity: number; overflowSlotCount: number; message: string }>
  >(`/admin/parking-lots/${lotId}/overflow-config`, { overflowCapacity });
  return response.data;
}

/**
 * Owner API — Get Parking Lots owned by the authenticated owner
 */
export async function getOwnerParkingLots(
  params: GetOfficialParkingLotsParams = {},
): Promise<ApiResponse<PaginatedParkingLotsResponse>> {
  const response = await apiClient.get<ApiResponse<PaginatedParkingLotsResponse>>(
    '/owner/parking-lots',
    { params },
  );
  return response.data;
}

/**
 * Owner API — Get single Parking Lot owned by the authenticated owner
 */
export async function getOwnerParkingLotById(
  lotId: string,
): Promise<ApiResponse<OfficialParkingLot>> {
  const response = await apiClient.get<ApiResponse<OfficialParkingLot>>(
    `/owner/parking-lots/${lotId}`,
  );
  return response.data;
}

/**
 * Owner API — Get Parking Lot Hierarchy (floors, zones, slots) for owned facility
 */
export async function getOwnerParkingLotHierarchy(
  lotId: string,
): Promise<ApiResponse<OfficialParkingLotHierarchy>> {
  const response = await apiClient.get<ApiResponse<OfficialParkingLotHierarchy>>(
    `/owner/parking-lots/${lotId}/hierarchy`,
  );
  return response.data;
}

/**
 * Owner API — Confirm and approve 2D Layout Plan
 */
export async function ownerConfirmLayout(
  lotId: string,
  notes?: string,
): Promise<ApiResponse<OfficialParkingLot>> {
  const response = await apiClient.post<ApiResponse<OfficialParkingLot>>(
    `/owner/parking-lots/${lotId}/layout/confirm`,
    { notes },
  );
  return response.data;
}

/**
 * Owner API — Request changes on 2D Layout Plan
 */
export async function ownerRequestLayoutChanges(
  lotId: string,
  notes: string,
  floorId?: string,
): Promise<ApiResponse<OfficialParkingLot>> {
  const response = await apiClient.post<ApiResponse<OfficialParkingLot>>(
    `/owner/parking-lots/${lotId}/layout/request-changes`,
    { notes, floorId },
  );
  return response.data;
}

/**
 * Facility Activation — Go Live (Owner or Admin)
 */
export async function activateFacility(
  lotId: string,
  asAdmin = false,
): Promise<ApiResponse<OfficialParkingLot>> {
  const endpoint = asAdmin
    ? `/admin/parking-lots/${lotId}/activate`
    : `/owner/parking-lots/${lotId}/activate`;
  const response = await apiClient.post<ApiResponse<OfficialParkingLot>>(endpoint);
  return response.data;
}



