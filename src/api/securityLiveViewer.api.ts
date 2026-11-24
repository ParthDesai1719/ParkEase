import { apiClient } from './client';
import type { LayoutCanvasConfig } from './parkingLot.api';

export interface SecurityAssignedFacility {
  parkingLotId: string;
  parkingName: string;
  address: string;
  city: string;
  floors: Array<{
    floorId: string;
    floorName: string;
    floorNumber: number;
    hasPublishedLayout: boolean;
  }>;
}

export interface SecurityEnrichedSlotElement {
  elementId: string;
  elementType: string;
  slotId?: string | undefined;
  slotNumber?: string | undefined;
  slotLabel?: string | undefined;
  slotType?: string | undefined;
  supportedVehicleType?: string | undefined;
  floorId?: string | undefined;
  zoneId?: string | undefined;
  zoneCode?: string | undefined;
  zoneName?: string | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number | undefined;
  effectiveStatus: 'Available' | 'Reserved' | 'Occupied' | 'Under Maintenance';
  isOverflow?: boolean | undefined;
  vehicleNumber?: string | null | undefined;
  vehicleType?: string | null | undefined;
  bookingReference?: string | null | undefined;
  scheduledExitTime?: string | null | undefined;
  isOverstay?: boolean | undefined;
}

export interface SecurityLiveFloorLayoutData {
  parkingLotId: string;
  parkingName: string;
  floor: {
    floorId: string;
    floorName: string;
    floorNumber: number;
  };
  canvasConfig: LayoutCanvasConfig;
  elements: SecurityEnrichedSlotElement[];
  stats: {
    totalSlots: number;
    availableSlots: number;
    reservedSlots: number;
    occupiedSlots: number;
    maintenanceSlots: number;
    overflowSlots: number;
    occupancyRate: number;
  };
}

export interface SecuritySlotDetailedInfo {
  slot: {
    _id: string;
    slotNumber: string;
    slotLabel: string;
    slotType: string;
    supportedVehicleType: string;
    slotStatus: string;
    isOverflow: boolean;
    remarks?: string | null | undefined;
  };
  floor: {
    _id: string;
    floorName: string;
    floorNumber: number;
  };
  zone: {
    _id: string;
    zoneName: string;
    zoneCode: string;
  };
  activeBooking?: {
    _id: string;
    bookingReference: string;
    bookingType: string;
    bookingStatus: string;
    scheduledEntryTime: string;
    scheduledExitTime: string;
    actualEntryTime?: string | null | undefined;
    customerName: string;
    customerPhone: string;
    vehicle: {
      vehicleNumber: string;
      vehicleType: string;
      vehicleBrand?: string | null | undefined;
      vehicleModel?: string | null | undefined;
    };
  } | null | undefined;
}

export const securityLiveViewerApi = {
  async getAssignedFacilities(): Promise<SecurityAssignedFacility[]> {
    const res = await apiClient.get('/security/live-viewer/facilities');
    return res.data.data;
  },

  async getLiveFloorLayout(params: {
    parkingLotId: string;
    floorId: string;
  }): Promise<SecurityLiveFloorLayoutData> {
    const res = await apiClient.get('/security/live-viewer/layout', { params });
    return res.data.data;
  },

  async getSlotDetails(params: {
    parkingLotId: string;
    slotId: string;
  }): Promise<SecuritySlotDetailedInfo> {
    const res = await apiClient.get('/security/live-viewer/slot-details', { params });
    return res.data.data;
  },

  async updateSlotStatus(params: {
    parkingLotId: string;
    slotId: string;
    slotStatus: string;
    remarks?: string | null | undefined;
  }): Promise<{
    success: boolean;
    message: string;
    slot: {
      _id: string;
      slotNumber: string;
      slotStatus: string;
      remarks: string | null;
    };
  }> {
    const res = await apiClient.patch(`/security/live-viewer/slots/${params.slotId}/status`, {
      parkingLotId: params.parkingLotId,
      slotStatus: params.slotStatus,
      remarks: params.remarks,
    });
    return res.data;
  },
};
