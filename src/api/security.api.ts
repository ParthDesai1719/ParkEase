import { apiClient } from './client';

export interface SecurityAssignedFacility {
  assignmentId: string;
  parkingLotId: string;
  parkingName: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  parkingStatus: string;
  isOpen24Hours: boolean;
  openingTime: string | null;
  closingTime: string | null;
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  totalEvSlots?: number;
  amenities: string[];
  assignedAt: string;
  employeeId: string | null;
}

export interface SecurityDashboardStatsData {
  facility: {
    parkingLotId: string;
    parkingName: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    isOpen24Hours: boolean;
    openingTime: string | null;
    closingTime: string | null;
    totalSlots: number;
  };
  metrics: {
    vehiclesCurrentlyInside: number;
    entriesToday: number;
    exitsToday: number;
    availableSlots: number;
    occupiedSlots: number;
    walkinBookingsToday: number;
    currentOverstays: number;
  };
  recentActivity: Array<{
    id: string;
    eventCode: string;
    eventType: string;
    eventTitle: string;
    eventDescription: string;
    bookingReference: string;
    eventSource: string;
    eventTime: string;
    performedByName: string | null;
  }>;
}

export interface QrVerificationResult {
  isAuthentic: boolean;
  eligibleForEntry: boolean;
  entryIneligibilityReason: string | null;
  eligibleForExit: boolean;
  exitIneligibilityReason: string | null;
  availableActions: Array<'ALLOW_ENTRY' | 'REJECT' | 'CANCEL' | 'VERIFY_EXIT' | 'COLLECT_OVERSTAY_CASH'>;
  booking: {
    bookingId: string;
    bookingReference: string;
    bookingType: 'ONLINE' | 'WALK_IN';
    bookingStatus: string;
    customer: {
      id: string;
      fullName: string;
      email: string;
      mobileNumber: string;
    };
    vehicle: {
      id: string;
      vehicleNumber: string;
      vehicleType: string;
      vehicleBrand: string;
      vehicleModel: string;
    };
    facility: {
      parkingLotId: string;
      parkingName: string;
      address: string;
      city: string;
      state: string;
      isOpen24Hours: boolean;
      openingTime: string | null;
      closingTime: string | null;
    };
    hierarchy: {
      floorId: string;
      floorName: string;
      floorNumber: number;
      zoneId: string;
      zoneName: string;
      zoneCode: string;
      slotId: string;
      slotNumber: string;
      slotLabel: string;
      slotType: string;
      slotStatus: string;
    };
    timing: {
      scheduledEntryTime: string;
      scheduledExitTime: string;
      actualEntryTime: string | null;
      actualExitTime: string | null;
      gracePeriodMinutes: number;
      bookingDurationMinutes: number;
    };
    payment: {
      baseAmount: number;
      additionalCharges: number;
      totalAmount: number;
      primaryPaymentStatus: string;
      paymentMethod: string;
    };
    cancellation: {
      isCancelled: boolean;
      cancellationType: string | null;
      cancellationReason: string | null;
      cancelledAt: string | null;
    };
  };
  overstay: {
    overstayDetected: boolean;
    overstayDurationMinutes: number;
    overstayCharge: number;
    additionalChargePaymentStatus: 'NOT_APPLICABLE' | 'UNPAID' | 'PAID';
  };
}

export interface EntryVerificationResult {
  success: boolean;
  message: string;
  bookingId: string;
  bookingReference: string;
  bookingStatus: 'Active';
  actualEntryTime: string;
  slot: {
    slotId: string;
    slotNumber: string;
    slotLabel: string;
    slotStatus: 'Occupied';
    floorName: string;
    zoneName: string;
    zoneCode: string;
  };
  movementLogId: string;
}

export interface ExitVerificationResult {
  success: boolean;
  message: string;
  bookingId: string;
  bookingReference: string;
  bookingStatus: 'Completed';
  actualExitTime: string;
  stayDurationMinutes: number;
  slot: {
    slotId: string;
    slotNumber: string;
    slotStatus: string;
  };
  overstaySettled: boolean;
  movementLogId: string;
}

export interface CollectOverstayCashResult {
  success: boolean;
  message: string;
  bookingId: string;
  bookingReference: string;
  paymentReference: string;
  amountCollected: number;
  paymentStatus: 'SUCCESSFUL';
  paymentMethod: 'CASH';
}

export interface ManualBookingItem {
  bookingId: string;
  bookingReference: string;
  bookingType: string;
  bookingStatus: string;
  customer: {
    customerId: string;
    fullName: string;
    email: string;
    mobileNumber: string;
  };
  vehicle: {
    vehicleId: string;
    vehicleNumber: string;
    vehicleType: string;
    make: string | null;
    model: string | null;
    color: string | null;
  };
  facility: {
    parkingLotId: string;
    parkingName: string;
    floorName: string;
    zoneName: string;
    slotNumber: string;
    slotIdentifier: string;
  };
  timing: {
    scheduledEntryTime: string;
    scheduledExitTime: string;
    actualEntryTime: string | null;
    actualExitTime: string | null;
    durationMinutes: number;
    stayDurationMinutes: number | null;
  };
  payment: {
    baseAmount: number;
    totalAmount: number;
    paymentStatus: string;
    paymentMethod: string | null;
  };
  overstay: {
    isOverstay: boolean;
    overstayDurationMinutes: number;
    overstayCharge: number;
    overstayPaymentStatus: 'NOT_APPLICABLE' | 'UNPAID' | 'PAID';
  };
  qrStatus: {
    hasQr: boolean;
    qrStatus: string;
  };
  allowedActions: {
    canAllowEntry: boolean;
    canRejectEntry: boolean;
    canCompleteExit: boolean;
    canRejectExit: boolean;
    canCollectCash: boolean;
  };
}

export interface ManualSearchBookingsResult {
  bookings: ManualBookingItem[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
  summary: {
    total: number;
    confirmed: number;
    active: number;
    overstay: number;
    completed: number;
  };
}

export interface ManualBookingDetailData extends ManualBookingItem {
  timeline: Array<{
    _id: string;
    eventCode: string;
    eventType: string;
    eventTitle: string;
    eventDescription: string;
    eventSource: string;
    eventTime: string;
    performedByName?: string | null;
  }>;
  movementLogs: Array<{
    _id: string;
    entryTime?: string;
    exitTime?: string;
    entryMethod?: string;
    exitMethod?: string;
    stayDurationMinutes?: number;
    vehicleNumberSnapshot?: string;
  }>;
  payments: Array<{
    _id: string;
    paymentReference: string;
    paymentType: string;
    paymentMethod: string;
    paymentStatus: string;
    amount: number;
    createdAt: string;
  }>;
}

export const securityApi = {
  getAssignedFacilities: async (): Promise<SecurityAssignedFacility[]> => {
    const res = await apiClient.get<{ success: boolean; data: SecurityAssignedFacility[] }>(
      '/security/facilities',
    );
    return res.data.data;
  },

  getDashboardStats: async (parkingLotId: string): Promise<SecurityDashboardStatsData> => {
    const res = await apiClient.get<{ success: boolean; data: SecurityDashboardStatsData }>(
      `/security/dashboard/stats?parkingLotId=${encodeURIComponent(parkingLotId)}`,
    );
    return res.data.data;
  },

  verifyQrPass: async (payload: {
    parkingLotId: string;
    qrPayload: string;
  }): Promise<QrVerificationResult> => {
    const res = await apiClient.post<{ success: boolean; data: QrVerificationResult }>(
      '/security/qr/verify',
      payload,
    );
    return res.data.data;
  },

  recordVehicleEntry: async (payload: {
    parkingLotId: string;
    bookingId: string;
    entryMethod?: 'QR Code' | 'Manual Verification';
    notes?: string;
  }): Promise<EntryVerificationResult> => {
    const res = await apiClient.post<{ success: boolean; data: EntryVerificationResult }>(
      '/security/entry/verify',
      payload,
    );
    return res.data.data;
  },

  completeVehicleExit: async (payload: {
    parkingLotId: string;
    bookingId: string;
    exitMethod?: 'QR Code' | 'Manual Verification';
    notes?: string;
  }): Promise<ExitVerificationResult> => {
    const res = await apiClient.post<{ success: boolean; data: ExitVerificationResult }>(
      '/security/exit/verify',
      payload,
    );
    return res.data.data;
  },

  collectOverstayCash: async (payload: {
    parkingLotId: string;
    bookingId: string;
    amount: number;
    notes?: string;
  }): Promise<CollectOverstayCashResult> => {
    const res = await apiClient.post<{ success: boolean; data: CollectOverstayCashResult }>(
      '/security/overstay/collect-cash',
      payload,
    );
    return res.data.data;
  },

  searchManualBookings: async (params: {
    parkingLotId: string;
    query?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ManualSearchBookingsResult> => {
    const queryParams = new URLSearchParams();
    queryParams.set('parkingLotId', params.parkingLotId);
    if (params.query) queryParams.set('query', params.query);
    if (params.status && params.status !== 'All') queryParams.set('status', params.status);
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());

    const res = await apiClient.get<{ success: boolean; data: ManualSearchBookingsResult }>(
      `/security/manual-lookup?${queryParams.toString()}`,
    );
    return res.data.data;
  },

  getManualBookingDetails: async (params: {
    parkingLotId: string;
    bookingId: string;
  }): Promise<ManualBookingDetailData> => {
    const res = await apiClient.get<{ success: boolean; data: ManualBookingDetailData }>(
      `/security/manual-lookup/${encodeURIComponent(params.bookingId)}?parkingLotId=${encodeURIComponent(params.parkingLotId)}`,
    );
    return res.data.data;
  },

  recordManualEntry: async (payload: {
    parkingLotId: string;
    bookingId: string;
    reason: string;
    notes?: string;
  }): Promise<EntryVerificationResult> => {
    const res = await apiClient.post<{ success: boolean; data: EntryVerificationResult }>(
      '/security/manual-lookup/entry',
      payload,
    );
    return res.data.data;
  },

  completeManualExit: async (payload: {
    parkingLotId: string;
    bookingId: string;
    reason: string;
    notes?: string;
  }): Promise<ExitVerificationResult> => {
    const res = await apiClient.post<{ success: boolean; data: ExitVerificationResult }>(
      '/security/manual-lookup/exit',
      payload,
    );
    return res.data.data;
  },

  recordManualRejection: async (payload: {
    parkingLotId: string;
    bookingId: string;
    actionType: 'ENTRY' | 'EXIT';
    reason: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post<{ success: boolean; message: string; data: any }>(
      '/security/manual-lookup/reject',
      payload,
    );
    return res.data;
  },

  getWalkInAvailableSlots: async (params: {
    parkingLotId: string;
    vehicleType: string;
    durationHours?: number;
    entryTime?: string;
    exitTime?: string;
  }): Promise<WalkInAvailableSlotsResult> => {
    const query = new URLSearchParams({
      parkingLotId: params.parkingLotId,
      vehicleType: params.vehicleType,
    });
    if (params.durationHours !== undefined) query.set('durationHours', String(params.durationHours));
    if (params.entryTime) query.set('entryTime', params.entryTime);
    if (params.exitTime) query.set('exitTime', params.exitTime);

    const res = await apiClient.get<{ success: boolean; data: WalkInAvailableSlotsResult }>(
      `/security/walk-in/available-slots?${query.toString()}`,
    );
    return res.data.data;
  },

  calculateWalkInTariff: async (payload: {
    parkingLotId: string;
    vehicleType: string;
    durationHours?: number;
    entryTime?: string;
    exitTime?: string;
  }): Promise<WalkInTariffResult> => {
    const res = await apiClient.post<{ success: boolean; data: WalkInTariffResult }>(
      '/security/walk-in/calculate-tariff',
      payload,
    );
    return res.data.data;
  },

  createWalkInBooking: async (
    payload: CreateWalkInBookingInput,
  ): Promise<WalkInBookingConfirmation> => {
    const res = await apiClient.post<{ success: boolean; data: WalkInBookingConfirmation }>(
      '/security/walk-in/create',
      payload,
    );
    return res.data.data;
  },

  // Incident Reports APIs (Phase 6)
  getIncidents: async (params: {
    parkingLotId: string;
    status?: string;
    severity?: string;
    incidentType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<SecurityIncidentListResult> => {
    const query = new URLSearchParams({
      parkingLotId: params.parkingLotId,
      page: String(params.page || 1),
      limit: String(params.limit || 10),
    });
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.severity && params.severity !== 'ALL') query.set('severity', params.severity);
    if (params.incidentType && params.incidentType !== 'ALL') query.set('incidentType', params.incidentType);
    if (params.search && params.search.trim()) query.set('search', params.search.trim());

    const res = await apiClient.get<{ success: boolean; data: SecurityIncidentListResult }>(
      `/security/incidents?${query.toString()}`,
    );
    return res.data.data;
  },

  getIncidentDetail: async (
    incidentId: string,
    parkingLotId: string,
  ): Promise<SecurityIncident> => {
    const res = await apiClient.get<{ success: boolean; data: SecurityIncident }>(
      `/security/incidents/${incidentId}?parkingLotId=${encodeURIComponent(parkingLotId)}`,
    );
    return res.data.data;
  },

  createIncident: async (
    payload: CreateIncidentPayload,
  ): Promise<SecurityIncident> => {
    const res = await apiClient.post<{ success: boolean; data: SecurityIncident }>(
      '/security/incidents',
      payload,
      {
        params: { parkingLotId: payload.parkingLotId },
      },
    );
    return res.data.data;
  },

  updateIncidentStatus: async (
    incidentId: string,
    parkingLotId: string,
    payload: UpdateIncidentStatusPayload,
  ): Promise<SecurityIncident> => {
    const res = await apiClient.patch<{ success: boolean; data: SecurityIncident }>(
      `/security/incidents/${incidentId}/status`,
      payload,
      {
        params: { parkingLotId },
      },
    );
    return res.data.data;
  },

  uploadIncidentImages: async (
    images: File[],
    parkingLotId: string,
  ): Promise<{ urls: string[]; filenames: string[] }> => {
    const formData = new FormData();
    for (const img of images) {
      formData.append('images', img);
    }
    const res = await apiClient.post<{ success: boolean; data: { urls: string[]; filenames: string[] } }>(
      '/security/incidents/upload-images',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { parkingLotId },
      },
    );
    return res.data.data;
  },

  getMovementLogs: async (params: MovementLogsQueryParams): Promise<MovementLogsListResult> => {
    const query = new URLSearchParams({
      parkingLotId: params.parkingLotId,
    });
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.movementType && params.movementType !== 'ALL') query.set('movementType', params.movementType);
    if (params.vehicleNumber) query.set('vehicleNumber', params.vehicleNumber);
    if (params.customerName) query.set('customerName', params.customerName);
    if (params.staffId && params.staffId !== 'ALL') query.set('staffId', params.staffId);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const res = await apiClient.get<{ success: boolean; data: MovementLogsListResult }>(
      `/security/movement-logs?${query.toString()}`,
    );
    return res.data.data;
  },

  getMovementLogDetail: async (
    movementLogId: string,
    parkingLotId: string,
  ): Promise<MovementLogDetailResult> => {
    const res = await apiClient.get<{ success: boolean; data: MovementLogDetailResult }>(
      `/security/movement-logs/${encodeURIComponent(movementLogId)}?parkingLotId=${encodeURIComponent(parkingLotId)}`,
    );
    return res.data.data;
  },

  exportMovementLogsCsv: async (params: MovementLogsQueryParams): Promise<Blob> => {
    const query = new URLSearchParams({
      parkingLotId: params.parkingLotId,
    });
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.movementType && params.movementType !== 'ALL') query.set('movementType', params.movementType);
    if (params.vehicleNumber) query.set('vehicleNumber', params.vehicleNumber);
    if (params.customerName) query.set('customerName', params.customerName);
    if (params.staffId && params.staffId !== 'ALL') query.set('staffId', params.staffId);
    if (params.search) query.set('search', params.search);

    const res = await apiClient.get(`/security/movement-logs/export/csv?${query.toString()}`, {
      responseType: 'blob',
    });
    return res.data;
  },
};

export interface WalkInSlotInfo {
  slotId: string;
  slotNumber: string;
  slotLabel?: string;
  floorId: string;
  floorName: string;
  floorNumber: number;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  supportedVehicleType: string;
  isAvailable: boolean;
}

export interface WalkInGroupedFloor {
  floorId: string;
  floorName: string;
  floorNumber: number;
  zones: Array<{
    zoneId: string;
    zoneCode: string;
    zoneName: string;
    slots: WalkInSlotInfo[];
  }>;
}

export interface WalkInAvailableSlotsResult {
  parkingLotId: string;
  vehicleType: string;
  durationHours: number;
  scheduledEntryTime: string;
  scheduledExitTime: string;
  totalAvailableCount: number;
  recommendedSlot: WalkInSlotInfo | null;
  availableSlots: WalkInSlotInfo[];
  groupedByFloor: WalkInGroupedFloor[];
}

export interface WalkInTariffResult {
  parkingLotId: string;
  vehicleType: string;
  durationHours: number;
  hourlyRate: number;
  baseAmount: number;
  additionalCharges: number;
  totalAmount: number;
  scheduledEntryTime: string;
  scheduledExitTime: string;
  gracePeriodMinutes: number;
}

export interface CreateWalkInBookingInput {
  parkingLotId: string;
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  vehicleNumber: string;
  vehicleType: string;
  durationHours?: number;
  entryTime?: string;
  exitTime?: string;
  slotSelectionMode: 'AUTO' | 'MANUAL';
  slotId?: string;
  cashCollected: boolean;
  cashAmountCollected: number;
  staffNotes?: string;
}

export interface WalkInBookingConfirmation {
  success: boolean;
  message: string;
  receiptNumber: string;
  booking: {
    bookingId: string;
    bookingReference: string;
    bookingType: 'WALK_IN';
    bookingStatus: 'Confirmed' | 'Active';
    scheduledEntryTime: string;
    scheduledExitTime: string;
    actualEntryTime?: string | null;
    durationHours: number;
    durationMinutes: number;
    hourlyRate: number;
    totalAmount: number;
    gracePeriodMinutes: number;
    createdAt: string;
  };
  customer: {
    customerId: string;
    fullName: string;
    mobileNumber: string;
    email: string;
  };
  vehicle: {
    vehicleId: string;
    vehicleNumber: string;
    vehicleType: string;
  };
  parkingLot: {
    parkingLotId: string;
    parkingName: string;
    address: string;
    city: string;
    state: string;
  };
  slot: {
    slotId: string;
    slotNumber: string;
    floorId: string;
    floorName: string;
    floorNumber: number;
    zoneId: string;
    zoneCode: string;
    zoneName: string;
  };
  payment: {
    paymentId: string;
    paymentReference: string;
    paymentMethod: 'CASH';
    paymentStatus: 'SUCCESSFUL';
    paymentType: string;
    amount: number;
    paymentDate: string;
  };
  qrPayload: string;
  qrCodeDataUrl: string;
}

export interface SecurityIncident {
  _id: string;
  incidentReference: string;
  parkingLotId: string;
  parkingName: string;
  bookingId: string | null;
  bookingReference?: string | null;
  vehicleId: string | null;
  vehicleNumber?: string | null;
  vehicleType?: string | null;
  customerId: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  reportedBy: {
    userId: string;
    fullName: string;
    role?: string;
  };
  incidentSource: string;
  incidentType: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  incidentStatus: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed';
  title: string;
  description: string;
  attachments: string[];
  location: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityIncidentListResult {
  incidents: SecurityIncident[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
  summary: {
    total: number;
    open: number;
    underInvestigation: number;
    resolved: number;
    closed: number;
    critical: number;
  };
}

export interface CreateIncidentPayload {
  parkingLotId: string;
  title: string;
  description: string;
  incidentType: string;
  severity?: 'Low' | 'Medium' | 'High' | 'Critical';
  vehicleNumber?: string;
  bookingReference?: string;
  attachments?: string[];
  location?: string;
}

export interface UpdateIncidentStatusPayload {
  status: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed';
  resolutionNotes?: string;
}

export type MovementType = 'Entry' | 'Exit' | 'Entry Denied' | 'Exit Denied';

export interface MovementLogItem {
  _id: string;
  movementReference: string;
  bookingId: string;
  bookingReference: string;
  bookingStatus: string;
  bookingType: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  vehicleId: string;
  vehicleNumber: string;
  vehicleType: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  parkingLotId: string;
  parkingName: string;
  floorId: string;
  floorName: string;
  floorNumber: number;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  slotId: string;
  slotNumber: string;
  slotLabel?: string;
  movementType: MovementType;
  movementStatus: string;
  entryMethod: string;
  entryTime: string;
  verifiedByName: string | null;
  verifiedById: string | null;
  exitMethod: string | null;
  exitTime: string | null;
  exitVerifiedByName: string | null;
  exitVerifiedById: string | null;
  stayDurationMinutes: number;
  formattedDuration: string;
  overstayMinutes: number;
  remarks: string | null;
  createdAt: string;
}

export interface MovementLogsListResult {
  logs: MovementLogItem[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
  summary: {
    total: number;
    entries: number;
    exits: number;
    denied: number;
    vehiclesInside: number;
  };
  facilityStaffList: Array<{
    staffId: string;
    staffName: string;
    employeeId: string | null;
  }>;
}

export interface MovementLogDetailResult extends MovementLogItem {
  booking: {
    bookingId: string;
    bookingReference: string;
    bookingStatus: string;
    bookingType: string;
    scheduledEntryTime: string;
    scheduledExitTime: string;
    actualEntryTime: string | null;
    actualExitTime: string | null;
    gracePeriodMinutes: number;
    baseAmount: number;
    additionalCharges: number;
    totalAmount: number;
    overstayCharge: number;
    overstayDetected: boolean;
  };
  timeline: Array<{
    _id: string;
    eventCode: string;
    eventType: string;
    eventTitle: string;
    eventDescription: string;
    eventSource: string;
    eventTime: string;
    performedByName?: string | null;
  }>;
  payments: Array<{
    _id: string;
    paymentReference: string;
    paymentType: string;
    paymentMethod: string;
    paymentStatus: string;
    amount: number;
    createdAt: string;
  }>;
}

export interface MovementLogsQueryParams {
  parkingLotId: string;
  startDate?: string;
  endDate?: string;
  movementType?: string;
  vehicleNumber?: string;
  customerName?: string;
  staffId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

