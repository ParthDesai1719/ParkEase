import { apiClient } from './client';

export interface AdminStaffOverview {
  totalSecurityStaff: number;
  activeSecurityStaff: number;
  suspendedSecurityStaff: number;
  recentlyAddedStaff: number;
}

export interface AdminStaffItem {
  _id: string;
  employeeId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: 'Security Staff';
  accountStatus: string;
  lastLogin: string | null;
  createdAt: string;
  owner: {
    _id: string;
    fullName: string;
    email: string;
    businessName?: string;
  } | null;
  parkingLot: {
    _id: string;
    parkingName: string;
    address?: string;
    city?: string;
  } | null;
  activeAssignmentsCount: number;
  assignment: {
    _id: string;
    assignmentStatus: 'Active' | 'Inactive';
    assignedAt: string;
    assignmentReason?: string;
  } | null;
}

export interface AdminStaffResponseData {
  staff: AdminStaffItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminStaffDetailData {
  staff: {
    _id: string;
    employeeId: string;
    fullName: string;
    email: string;
    mobileNumber: string;
    role: 'Security Staff';
    accountStatus: string;
    emailVerified: boolean;
    mobileVerified: boolean;
    createdAt: string;
    lastLogin: string | null;
    preferredLanguage: string;
    timezone: string;
    suspensionReason?: string | null;
    suspendedAt?: string | null;
  };
  currentAssignment: {
    _id: string;
    parkingLotId: {
      _id: string;
      parkingName: string;
      address: string;
      city: string;
      totalCapacity?: number;
      parkingStatus?: string;
    };
    ownerId: {
      _id: string;
      fullName: string;
      email: string;
      mobileNumber?: string;
      businessName?: string;
    };
    assignedAt: string;
    assignedBy?: {
      _id: string;
      fullName: string;
      email: string;
    } | null;
    assignmentReason?: string;
    assignmentStatus: string;
  } | null;
  assignmentHistory: Array<{
    _id: string;
    parkingLotId: {
      _id: string;
      parkingName: string;
      address: string;
      city: string;
    };
    ownerId: {
      _id: string;
      fullName: string;
      email: string;
      businessName?: string;
    };
    assignmentStatus: string;
    assignedAt: string;
    unassignedAt?: string | null;
    assignmentReason?: string;
  }>;
  operationalMetrics: {
    totalCheckIns: number;
    totalCheckOuts: number;
    totalWalkIns: number;
    totalIncidents: number;
  };
  activityLogs: Array<{
    _id: string;
    action: string;
    module: string;
    description: string;
    createdAt: string;
    status: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface CreateStaffPayload {
  fullName: string;
  email: string;
  mobileNumber: string;
  ownerId: string;
  parkingLotId: string;
  employeeId?: string;
  assignmentReason?: string;
}

export interface UpdateStaffPayload {
  fullName?: string;
  mobileNumber?: string;
  employeeId?: string;
}

export interface TransferStaffPayload {
  newOwnerId: string;
  newParkingLotId: string;
  transferReason?: string;
}

export interface AdminStaffQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  ownerId?: string;
  parkingLotId?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface OwnerOption {
  _id: string;
  fullName: string;
  email: string;
  businessName: string;
}

export interface ParkingLotOption {
  _id: string;
  parkingName: string;
  address: string;
  city: string;
  ownerId: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const adminStaffApi = {
  /**
   * Fetch 4 live KPI dashboard metrics
   */
  async getStaffOverview(): Promise<AdminStaffOverview> {
    const res = await apiClient.get<ApiResponse<AdminStaffOverview>>('/admin/staff/overview');
    return res.data.data;
  },

  /**
   * Fetch paginated Security Staff list with search and filters
   */
  async getStaffList(params?: AdminStaffQueryParams): Promise<AdminStaffResponseData> {
    const res = await apiClient.get<ApiResponse<AdminStaffResponseData>>('/admin/staff', { params });
    return res.data.data;
  },

  /**
   * Fetch approved owners for dropdown selectors
   */
  async getOwnerOptions(): Promise<OwnerOption[]> {
    const res = await apiClient.get<ApiResponse<OwnerOption[]>>('/admin/staff/owners');
    return res.data.data;
  },

  /**
   * Fetch parking lots, optionally scoped to ownerId
   */
  async getParkingLotOptions(ownerId?: string): Promise<ParkingLotOption[]> {
    const res = await apiClient.get<ApiResponse<ParkingLotOption[]>>('/admin/staff/parking-lots', {
      params: ownerId ? { ownerId } : undefined,
    });
    return res.data.data;
  },

  /**
   * Fetch single Security Staff details, assignments, operational metrics & activity logs
   */
  async getStaffById(id: string): Promise<AdminStaffDetailData> {
    const res = await apiClient.get<ApiResponse<AdminStaffDetailData>>(`/admin/staff/${id}`);
    return res.data.data;
  },

  /**
   * Create and assign new Security Staff member
   */
  async createStaff(payload: CreateStaffPayload): Promise<AdminStaffItem> {
    const res = await apiClient.post<ApiResponse<AdminStaffItem>>('/admin/staff', payload);
    return res.data.data;
  },

  /**
   * Update permitted profile fields for Security Staff
   */
  async updateStaff(id: string, payload: UpdateStaffPayload): Promise<AdminStaffItem> {
    const res = await apiClient.patch<ApiResponse<AdminStaffItem>>(`/admin/staff/${id}`, payload);
    return res.data.data;
  },

  /**
   * Suspend Security Staff account
   */
  async suspendStaff(id: string, reason: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.post<ApiResponse<null>>(`/admin/staff/${id}/suspend`, { reason });
    return { success: res.data.success, message: res.data.message || 'Staff suspended successfully' };
  },

  /**
   * Reactivate Security Staff account
   */
  async activateStaff(id: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.post<ApiResponse<null>>(`/admin/staff/${id}/activate`);
    return { success: res.data.success, message: res.data.message || 'Staff reactivated successfully' };
  },

  /**
   * Transfer Security Staff assignment to a new facility
   */
  async transferStaff(id: string, payload: TransferStaffPayload): Promise<AdminStaffDetailData> {
    const res = await apiClient.post<ApiResponse<AdminStaffDetailData>>(`/admin/staff/${id}/transfer`, payload);
    return res.data.data;
  },

  /**
   * Delete Security Staff account (fails with 409 if operational history exists)
   */
  async deleteStaff(id: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<ApiResponse<null>>(`/admin/staff/${id}`);
    return { success: res.data.success, message: res.data.message || 'Staff deleted successfully' };
  },
};

export const {
  getStaffOverview,
  getStaffList,
  getOwnerOptions,
  getParkingLotOptions,
  getStaffById,
  createStaff,
  updateStaff,
  suspendStaff,
  activateStaff,
  transferStaff,
  deleteStaff,
} = adminStaffApi;
