import { apiClient } from './client';
import type { OwnerLotOption } from './ownerRevenue.api';
export type { OwnerLotOption };

export interface OwnerVehiclesKpis {
  totalVehicles: number;
  vehiclesInside: number;
  vehiclesExpected: number;
  vehiclesOverstaying: number;
  vehiclesDeparted: number;
}

export interface OwnerVehiclesOverviewResponse {
  ownerLots: OwnerLotOption[];
  kpis: OwnerVehiclesKpis;
}

export interface OwnerVehicleListItem {
  _id: string;
  movementLogId: string;
  bookingId: string | null;
  bookingReference: string;
  bookingStatus: string;
  scheduledEntryTime: string | null;
  scheduledExitTime: string | null;
  vehicleNumber: string;
  vehicleType: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  parkingLotName: string;
  parkingLotId: string;
  floorName: string;
  zoneCode: string;
  slotNumber: string;
  slotId: string;
  entryTime: string | null;
  exitTime: string | null;
  movementStatus: 'Entry Pending' | 'Vehicle Inside' | 'Vehicle Exited' | 'Overstayed' | 'Cancelled';
  entryMethod: string;
  exitMethod: string | null;
  stayDurationMinutes: number;
  overstayMinutes: number;
  remarks: string | null;
}

export interface OwnerVehiclesListResponse {
  vehicles: OwnerVehicleListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  ownerLots: OwnerLotOption[];
}

export interface LocatorSlotItem {
  slotId: string;
  slotNumber: string;
  slotType: string;
  supportedVehicleType: string;
  floorId: string;
  floorName: string;
  zoneCode: string;
  zoneName: string;
  locatorStatus: 'AVAILABLE' | 'PARKED_INSIDE' | 'OVERSTAYING' | 'EXPECTED' | 'MAINTENANCE';
  isOccupied: boolean;
  isReserved: boolean;
  vehicle: {
    vehicleNumber: string;
    vehicleType: string;
    brand: string;
    model: string;
    color: string | null;
  } | null;
  customer: {
    fullName: string;
    phone: string | null;
    email: string | null;
  } | null;
  booking: {
    bookingReference: string;
    bookingStatus: string;
    scheduledEntryTime: string;
    scheduledExitTime: string;
  } | null;
  movement: {
    movementStatus: string;
    entryTime: string;
    stayDurationMinutes: number;
    overstayMinutes: number;
  } | null;
}

export interface OwnerLiveLocatorResponse {
  parkingLot: OwnerLotOption | null;
  floors: Array<{
    _id: string;
    floorName: string;
    floorNumber: number;
    totalSlots: number;
  }>;
  selectedFloor: {
    _id: string;
    floorName: string;
    floorNumber: number;
  } | null;
  slots: LocatorSlotItem[];
  summary: {
    totalSlots: number;
    occupiedCount: number;
    expectedCount: number;
    overstayCount: number;
    availableCount: number;
  };
}

export interface OwnerVehiclesOverviewParams {
  parkingLotId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface OwnerVehiclesListParams {
  parkingLotId?: string;
  movementStatus?: string;
  vehicleType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface OwnerLiveLocatorParams {
  parkingLotId: string;
  floorId?: string;
}

export async function getOwnerVehiclesOverview(
  params?: OwnerVehiclesOverviewParams,
): Promise<OwnerVehiclesOverviewResponse> {
  const response = await apiClient.get<{ success: boolean; data: OwnerVehiclesOverviewResponse }>(
    '/owner/vehicles/overview',
    { params },
  );
  return response.data.data;
}

export async function getOwnerVehiclesList(
  params?: OwnerVehiclesListParams,
): Promise<OwnerVehiclesListResponse> {
  const response = await apiClient.get<{ success: boolean; data: OwnerVehiclesListResponse }>(
    '/owner/vehicles/list',
    { params },
  );
  return response.data.data;
}

export async function getOwnerLiveVehicleLocator(
  params: OwnerLiveLocatorParams,
): Promise<OwnerLiveLocatorResponse> {
  const response = await apiClient.get<{ success: boolean; data: OwnerLiveLocatorResponse }>(
    '/owner/vehicles/live-locator',
    { params },
  );
  return response.data.data;
}
