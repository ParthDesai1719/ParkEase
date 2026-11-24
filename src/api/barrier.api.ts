import { apiClient } from './client';

export interface BarrierFacility {
  _id: string;
  parkingName: string;
  address: string;
  city: string;
  totalCapacity: number;
}

export interface BarrierReaderInfo {
  _id: string;
  readerId: string;
  readerType: 'ENTRY' | 'SLOT' | 'EXIT';
  parkingLotId: string;
  floorId?: string | null;
  slotId?: string | null;
  slotNumber?: string | null;
  barrierState: 'CLOSED' | 'ACCESS_VALIDATING' | 'OPENING' | 'OPEN' | 'CLOSING' | 'ERROR';
  barrierOpenedAt?: string | null;
  autoCloseDeadline?: string | null;
  autoCloseTimerActive: boolean;
  isObstructed: boolean;
  activeBookingId?: string | null;
  isActive: boolean;
  lastEvent: string;
  lastEventAt: string;
}

export interface BarrierScanResponse {
  authorized: boolean;
  action: 'ENTRY' | 'BAY_ENTRY' | 'BAY_DEPARTURE' | 'EXIT' | 'NONE';
  readerId: string;
  readerType: 'ENTRY' | 'SLOT' | 'EXIT';
  barrierState: string;
  message: string;
  errorCode?: string;
  booking?: {
    _id: string;
    bookingReference: string;
    bookingStatus: string;
    customerId: string;
    vehicleNumber?: string;
    currentSlotId?: string;
    currentSlotNumber?: string;
    originalSlotNumber?: string;
    isReassigned?: boolean;
    reassignmentReason?: string;
  };
  assignedSlot?: {
    slotId: string;
    slotNumber: string;
    slotType?: string;
    floorName?: string;
    zoneCode?: string;
  };
  overstayInfo?: {
    isOverstay: boolean;
    unpaidOverstayCharge: number;
  };
}

export interface BarrierEventItem {
  _id: string;
  readerId: string;
  readerType: string;
  eventType: string;
  eventOutcome: string;
  source: string;
  controllerType: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export const barrierApi = {
  getFacilities: async (): Promise<{ facilities: BarrierFacility[] }> => {
    const res = await apiClient.get('/barrier/facilities');
    return res.data.data;
  },

  getFacilityLayoutAndState: async (parkingLotId: string): Promise<any> => {
    const res = await apiClient.get(`/barrier/facilities/${parkingLotId}/layout`);
    return res.data.data;
  },

  getFacilityBookings: async (parkingLotId: string): Promise<{ bookings: any[] }> => {
    const res = await apiClient.get(`/barrier/facilities/${parkingLotId}/bookings`);
    return res.data.data;
  },

  getBarrierEvents: async (parkingLotId: string): Promise<{ events: BarrierEventItem[] }> => {
    const res = await apiClient.get(`/barrier/facilities/${parkingLotId}/events`);
    return res.data.data;
  },

  scanQr: async (params: {
    parkingLotId: string;
    readerId: string;
    qrPayload: string;
    source?: 'SIMULATOR' | 'PHYSICAL_CONTROLLER';
  }): Promise<BarrierScanResponse> => {
    const res = await apiClient.post('/barrier/scan', params);
    return res.data.data;
  },

  confirmPassage: async (params: {
    parkingLotId: string;
    readerId: string;
    bookingId: string;
    direction: 'IN' | 'OUT';
    source?: 'SIMULATOR';
  }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post('/barrier/confirm-passage', params);
    return res.data.data;
  },

  sendCommand: async (params: {
    readerId: string;
    command: 'OPEN' | 'CLOSE';
    source?: 'SIMULATOR';
  }): Promise<{ reader: BarrierReaderInfo }> => {
    const res = await apiClient.post('/barrier/command', params);
    return res.data.data;
  },

  setObstruction: async (params: {
    readerId: string;
    isObstructed: boolean;
  }): Promise<{ readerId: string; isObstructed: boolean }> => {
    const res = await apiClient.post('/barrier/safety-obstruction', params);
    return res.data.data;
  },

  forceAutoClose: async (
    params: { readerId: string; parkingLotId?: string } | string,
  ): Promise<{ readerId: string; closed: boolean }> => {
    const payload = typeof params === 'string' ? { readerId: params } : params;
    const res = await apiClient.post('/barrier/force-auto-close', payload);
    return res.data.data;
  },

  setAcceleratedTimer: async (multiplier: number): Promise<{ multiplier: number }> => {
    const res = await apiClient.post('/barrier/timer/accelerate', { multiplier });
    return res.data.data;
  },

  simulateOverstayScenario: async (params: {
    parkingLotId: string;
    mode: 'WITH_REPLACEMENT' | 'WITHOUT_REPLACEMENT';
  }): Promise<{ message: string; occupiedSlotNumber: string; mode: string }> => {
    const res = await apiClient.post('/barrier/simulate-overstay-scenario', params);
    return res.data.data;
  },
};
