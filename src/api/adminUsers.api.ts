import { apiClient } from './client';

export interface CustomerListItem {
  _id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  gender: string;
  accountStatus: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  preferredLanguage: string;
  timezone: string;
  lastLogin: string | null;
  createdAt: string;
  bookingCount: number;
  suspensionReason?: string | null;
  suspendedAt?: string | null;
  suspendedBy?: { _id: string; fullName: string; email: string } | null;
}

export interface CustomerSummaryCounters {
  totalCustomers: number;
  activeCustomers: number;
  suspendedCustomers: number;
  deactivatedCustomers: number;
}

export interface CustomerListResponse {
  users: CustomerListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: CustomerSummaryCounters;
}

export interface CustomerDetails {
  user: CustomerListItem & {
    updatedAt?: string;
  };
  bookingSummary: {
    totalBookings: number;
    activeBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    noShowBookings: number;
    overstayBookings: number;
  };
  vehicles: Array<{
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    vehicleBrand: string;
    vehicleModel: string;
    vehicleColor?: string | null;
    isPrimary: boolean;
    vehicleStatus: string;
  }>;
  recentSessions: Array<{
    sessionId: string;
    loginTime: string;
    lastActivity: string;
    logoutTime: string | null;
    logoutReason: string | null;
    sessionStatus: string;
    ipAddress: string | null;
    deviceName: string | null;
  }>;
}

export interface CustomerBooking {
  _id: string;
  bookingReference: string;
  parkingLotId: {
    _id: string;
    facilityName?: string;
    parkingName?: string;
    address?: string;
  } | null;
  vehicleId: {
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    vehicleModel: string;
  } | null;
  slotId?: {
    _id: string;
    slotNumber: string;
  } | null;
  bookingType: string;
  bookingStatus: string;
  startTime: string;
  endTime: string;
  actualCheckInTime?: string | null;
  actualCheckOutTime?: string | null;
  totalHours: number;
  totalAmount: number;
  createdAt: string;
  payment: {
    paymentReference: string;
    paymentStatus: string;
    paymentMethod: string;
    amount?: number;
    totalAmount?: number;
  } | null;
}

export interface CustomerBookingsResponse {
  bookings: CustomerBooking[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UpdateCustomerProfilePayload {
  fullName?: string;
  mobileNumber?: string;
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer Not To Say';
  preferredLanguage?: 'English' | 'Hindi' | 'Gujarati';
  timezone?: string;
}

export interface CustomerListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  bookingActivity?: 'ALL' | 'HAS_BOOKINGS' | 'NO_BOOKINGS';
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'fullName' | 'lastLogin' | 'bookingCount';
  sortOrder?: 'asc' | 'desc';
}

export const adminUsersApi = {
  getCustomers: async (params: CustomerListQueryParams): Promise<CustomerListResponse> => {
    const res = await apiClient.get<{ success: boolean; data: CustomerListResponse }>('/admin/users', {
      params,
    });
    return res.data.data;
  },

  getCustomerDetails: async (userId: string): Promise<CustomerDetails> => {
    const res = await apiClient.get<{ success: boolean; data: CustomerDetails }>(`/admin/users/${userId}`);
    return res.data.data;
  },

  getCustomerBookings: async (
    userId: string,
    params: { page?: number; limit?: number; status?: string },
  ): Promise<CustomerBookingsResponse> => {
    const res = await apiClient.get<{ success: boolean; data: CustomerBookingsResponse }>(
      `/admin/users/${userId}/bookings`,
      { params },
    );
    return res.data.data;
  },

  updateProfile: async (
    userId: string,
    payload: UpdateCustomerProfilePayload,
  ): Promise<CustomerListItem> => {
    const res = await apiClient.patch<{
      success: boolean;
      message: string;
      data: CustomerListItem;
    }>(`/admin/users/${userId}`, payload);
    return res.data.data;
  },

  suspendCustomer: async (
    userId: string,
    reason: string,
  ): Promise<CustomerListItem> => {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      data: CustomerListItem;
    }>(`/admin/users/${userId}/suspend`, { reason });
    return res.data.data;
  },

  activateCustomer: async (
    userId: string,
    remarks?: string,
  ): Promise<CustomerListItem> => {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      data: CustomerListItem;
    }>(`/admin/users/${userId}/activate`, { remarks });
    return res.data.data;
  },

  deleteCustomer: async (userId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ success: boolean; message: string }>(
      `/admin/users/${userId}`,
    );
    return { message: res.data.message };
  },
};
