import { apiClient } from './client';

export interface AdminBookingOverview {
  totalBookings: number;
  confirmedBookings: number;
  activeBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  overstayBookings: number;
  totalRevenue: number;
  totalRefunded: number;
}

export interface AdminBookingItem {
  _id: string;
  bookingReference: string;
  bookingType: 'ONLINE' | 'WALK_IN';
  bookingStatus: 'Pending Payment' | 'Confirmed' | 'Active' | 'Completed' | 'Cancelled' | 'No Show' | 'Overstay';
  vehicleNumber: string;
  vehicleType: string;
  vehicleId?: {
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    vehicleBrand: string;
    vehicleModel: string;
    vehicleColor?: string;
  };
  customerId: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber: string;
  } | null;
  parkingLotId: {
    _id: string;
    parkingName: string;
    address: string;
    city: string;
    ownerId?: string;
  } | null;
  currentSlotId: {
    _id: string;
    slotNumber: string;
    slotLabel?: string;
  } | null;
  floorId: {
    _id: string;
    floorName: string;
  } | null;
  zoneId: {
    _id: string;
    zoneName: string;
    zoneCode: string;
  } | null;
  scheduledEntryTime: string;
  scheduledExitTime: string;
  actualEntryTime?: string | null;
  actualExitTime?: string | null;
  bookingDurationMinutes: number;
  baseAmount: number;
  platformBookingFee: number;
  totalAmount: number;
  refundAmount?: number;
  cancellationReason?: string | null;
  cancellationBy?: string | null;
  cancellableByAdmin: boolean;
  ineligibilityReason?: string;
  createdAt: string;
  payment: {
    _id: string;
    paymentReference: string;
    paymentMethod: 'RAZORPAY' | 'CASH';
    paymentStatus: string;
    amount: number;
    paidAt?: string;
    refundAmount?: number;
  } | null;
}

export interface AdminBookingsResponse {
  bookings: AdminBookingItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminBookingDetailData {
  booking: AdminBookingItem & {
    originalSlotId?: {
      _id: string;
      slotNumber: string;
    };
    parkingRateAtBooking: number;
    overstayRateAtBooking: number;
    additionalCharges: number;
    overstayCharge: number;
    qrCode?: string;
    entryVerifiedBy?: {
      _id: string;
      fullName: string;
      employeeId?: string;
    };
    exitVerifiedBy?: {
      _id: string;
      fullName: string;
      employeeId?: string;
    };
  };
  owner: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber: string;
    businessName?: string;
  } | null;
  payments: Array<{
    _id: string;
    paymentReference: string;
    paymentType: string;
    paymentMethod: string;
    paymentStatus: string;
    amount: number;
    refundAmount?: number;
    transactionId?: string;
    gatewayPaymentId?: string;
    gatewayOrderId?: string;
    createdAt: string;
    refunds?: Array<{
      refundReference: string;
      refundAmount: number;
      refundStatus: string;
      refundReason: string;
      initiatedAt: string;
      completedAt?: string;
      remarks?: string;
    }>;
  }>;
  timeline: Array<{
    _id: string;
    eventCode: string;
    eventType: string;
    eventTitle: string;
    eventDescription?: string;
    eventSource: string;
    eventTime: string;
    performedBy?: {
      _id: string;
      fullName: string;
      role?: string;
    };
  }>;
  movementLogs: Array<{
    _id: string;
    entryMethod: string;
    exitMethod?: string;
    entryTime: string;
    exitTime?: string;
    movementStatus: string;
    stayDurationMinutes: number;
    overstayMinutes: number;
    verifiedBy?: {
      _id: string;
      fullName: string;
      employeeId?: string;
    };
  }>;
  cancellableByAdmin: boolean;
  ineligibilityReason?: string;
}

export interface AdminCancellationDetails {
  bookingId: string;
  bookingReference: string;
  parkingLot: {
    _id: string;
    parkingName: string;
    address: string;
    city: string;
  } | null;
  customer: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber: string;
  } | null;
  bookingStatus: string;
  cancellationBy: string;
  cancellationReason: string;
  cancelledAt: string;
  refundAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  refunds: Array<{
    refundReference: string;
    refundAmount: number;
    refundStatus: string;
    refundReason: string;
    initiatedAt: string;
    completedAt?: string;
    remarks?: string;
  }>;
}

export interface AdminLiveVehicleOverview {
  vehiclesCurrentlyInside: number;
  vehiclesEnteredToday: number;
  vehiclesExitedToday: number;
  averageParkingDurationMinutes: number;
  longestParkedVehicle: {
    vehicleNumber: string;
    entryTime: string | null;
    durationMinutes: number;
    parkingName: string;
    slotNumber: string;
  } | null;
  availableSlots: number;
  occupiedSlots: number;
  overstayedVehicles: number;
}

export interface AdminLiveVehicleItem {
  _id: string;
  bookingId: string;
  bookingReference: string;
  bookingType: 'ONLINE' | 'WALK_IN';
  vehicleNumber: string;
  vehicleType: string;
  customer: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber: string;
  } | null;
  parkingLot: {
    _id: string;
    parkingName: string;
    address: string;
    city: string;
  } | null;
  slot: {
    _id: string;
    slotNumber: string;
    slotLabel?: string;
    slotStatus: string;
  } | null;
  floor: {
    _id: string;
    floorName: string;
  } | null;
  zone: {
    _id: string;
    zoneName: string;
    zoneCode: string;
  } | null;
  entryTime: string;
  scheduledExitTime: string;
  liveDurationMinutes: number;
  remainingMinutes: number;
  isOverstay: boolean;
  overstayMinutes: number;
  trackingStatus: 'Inside Parking' | 'Overstayed';
  bookingStatus: string;
  paymentStatus: string;
  securityStaff: {
    _id: string;
    fullName: string;
    employeeId?: string;
  } | null;
}

export interface AdminLiveVehiclesResponse {
  vehicles: AdminLiveVehicleItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminLiveVehicleDetailData {
  booking: any;
  customer: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber: string;
  } | null;
  parkingLot: {
    _id: string;
    parkingName: string;
    address: string;
    city: string;
    contactNumber?: string;
  } | null;
  bayLocation: {
    slot: {
      _id: string;
      slotNumber: string;
      slotLabel?: string;
      slotType?: string;
      slotStatus?: string;
    } | null;
    floor: {
      _id: string;
      floorName: string;
      floorNumber?: number;
    } | null;
    zone: {
      _id: string;
      zoneName: string;
      zoneCode: string;
    } | null;
  };
  timing: {
    entryTime: string;
    scheduledExitTime: string;
    liveDurationMinutes: number;
    remainingMinutes: number;
    isOverstay: boolean;
    overstayMinutes: number;
  };
  payment: {
    _id: string;
    paymentReference: string;
    paymentMethod: string;
    paymentStatus: string;
    amount: number;
    paidAt?: string;
  } | null;
  securityOfficer: {
    _id: string;
    fullName: string;
    employeeId?: string;
    mobileNumber?: string;
  } | null;
  movementLogs: any[];
  timeline: any[];
}

export const adminOperationsApi = {
  // Booking Management
  getBookingOverview: async (): Promise<AdminBookingOverview> => {
    const res = await apiClient.get<{ success: boolean; data: AdminBookingOverview }>('/admin/bookings/overview');
    return res.data.data;
  },

  getBookings: async (params?: Record<string, any>): Promise<AdminBookingsResponse> => {
    const res = await apiClient.get<{
      success: boolean;
      data: AdminBookingItem[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>('/admin/bookings', { params });
    return {
      bookings: res.data.data,
      total: res.data.meta.total,
      page: res.data.meta.page,
      limit: res.data.meta.limit,
      totalPages: res.data.meta.totalPages,
    };
  },

  getBookingById: async (bookingId: string): Promise<AdminBookingDetailData> => {
    const res = await apiClient.get<{ success: boolean; data: AdminBookingDetailData }>(`/admin/bookings/${bookingId}`);
    return res.data.data;
  },

  cancelBooking: async (bookingId: string, payload: { reason: string }): Promise<{
    message: string;
    booking: any;
    refundAmount: number;
    refundStatus: string;
  }> => {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      data: { booking: any; refundAmount: number; refundStatus: string };
    }>(`/admin/bookings/${bookingId}/cancel`, payload);
    return {
      message: res.data.message,
      booking: res.data.data.booking,
      refundAmount: res.data.data.refundAmount,
      refundStatus: res.data.data.refundStatus,
    };
  },

  getBookingCancellationDetails: async (bookingId: string): Promise<AdminCancellationDetails> => {
    const res = await apiClient.get<{ success: boolean; data: AdminCancellationDetails }>(
      `/admin/bookings/${bookingId}/cancellation`,
    );
    return res.data.data;
  },

  // Live Vehicle Locator
  getLiveVehiclesOverview: async (): Promise<AdminLiveVehicleOverview> => {
    const res = await apiClient.get<{ success: boolean; data: AdminLiveVehicleOverview }>('/admin/live-vehicles/overview');
    return res.data.data;
  },

  getLiveVehicles: async (params?: Record<string, any>): Promise<AdminLiveVehiclesResponse> => {
    const res = await apiClient.get<{
      success: boolean;
      data: AdminLiveVehicleItem[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>('/admin/live-vehicles', { params });
    return {
      vehicles: res.data.data,
      total: res.data.meta.total,
      page: res.data.meta.page,
      limit: res.data.meta.limit,
      totalPages: res.data.meta.totalPages,
    };
  },

  getLiveVehicleDetails: async (bookingId: string): Promise<AdminLiveVehicleDetailData> => {
    const res = await apiClient.get<{ success: boolean; data: AdminLiveVehicleDetailData }>(
      `/admin/live-vehicles/${bookingId}`,
    );
    return res.data.data;
  },
};
