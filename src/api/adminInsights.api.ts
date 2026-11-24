import { apiClient } from './client';

export type DashboardPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DashboardKPICard {
  value: number;
  previousValue?: number;
  changePercentage?: number;
  secondaryText?: string;
}

export interface AdminDashboardData {
  period: DashboardPeriod;
  dateRange: { start: string; end: string };
  kpis: {
    users: DashboardKPICard & { active: number; newInPeriod: number };
    owners: DashboardKPICard & { approved: number; suspended: number; feePending: number };
    parkingLots: DashboardKPICard & { active: number; underMaintenance: number; suspended: number };
    bookings: DashboardKPICard & { online: number; walkIn: number; completed: number; active: number };
    revenue: DashboardKPICard & { platformFees: number; grossRevenue: number };
    occupancy: DashboardKPICard & { totalSlots: number; occupiedSlots: number; reservedSlots: number; availableSlots: number };
    payments: DashboardKPICard & { successful: number; refunded: number; failed: number };
    reviews: DashboardKPICard & { averageRating: number; pendingModeration: number };
    pendingOwnerApprovals: DashboardKPICard & { actionRequired: boolean };
  };
  charts: {
    revenueTrend: Array<{ date: string; revenue: number; platformFee: number; previousRevenue?: number }>;
    bookingsTrend: Array<{ date: string; total: number; online: number; walkIn: number }>;
    occupancyDistribution: Array<{ name: string; value: number; color: string; count: number }>;
    growthTrend: Array<{ date: string; users: number; owners: number; bookings: number; revenue: number }>;
    parkingUtilization: Array<{
      lotId: string;
      parkingName: string;
      occupancyRate: number;
      totalSlots: number;
      occupiedSlots: number;
      availableSlots: number;
    }>;
  };
  facilityStatusOverview: {
    submissions: {
      draft: number;
      submitted: number;
      underReview: number;
      changesRequested: number;
      approved: number;
      rejected: number;
      total: number;
    };
    layouts: {
      notCreated: number;
      draft: number;
      validated: number;
      published: number;
      total: number;
    };
    officialLots: {
      notActivated: number;
      active: number;
      underMaintenance: number;
      suspended: number;
      deactivated: number;
      total: number;
    };
  };
  facilityAttention: Array<{
    id: string;
    type: 'submission' | 'lot' | 'layout';
    title: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    actionText: string;
    actionUrl: string;
  }>;
  ownerApprovalSummary: {
    pendingApplications: number;
    approvedOwners: number;
    rejectedApplications: number;
    suspendedOwners: number;
    registrationFeePending: number;
  };
  recentActivity: {
    bookings: Array<{
      _id: string;
      bookingReference: string;
      customerName: string;
      vehicleNumber: string;
      parkingName: string;
      totalAmount: number;
      bookingStatus: string;
      createdAt: string;
    }>;
    payments: Array<{
      _id: string;
      paymentReference: string;
      amount: number;
      method: string;
      status: string;
      customerName: string;
      createdAt: string;
    }>;
    auditLogs: Array<{
      _id: string;
      actionTitle: string;
      module: string;
      performerName: string;
      createdAt: string;
    }>;
  };
}

export interface AdminReportQueryParams {
  reportType: 'revenue' | 'occupancy' | 'parking_usage' | 'customer' | 'booking';
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  parkingLotId?: string | undefined;
  ownerId?: string | undefined;
  bookingStatus?: string | undefined;
  paymentStatus?: string | undefined;
  bookingType?: string | undefined;
  vehicleType?: string | undefined;
  page?: number | string | undefined;
  limit?: number | string | undefined;
}

export interface AdminReportResult {
  reportType: string;
  generatedAt: string;
  dateRange: { start: string; end: string };
  appliedFilters: Record<string, string>;
  summary: Record<string, any>;
  columns: Array<{ key: string; label: string; align?: 'left' | 'center' | 'right' }>;
  rows: Array<Record<string, any>>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminAnalyticsData {
  period: DashboardPeriod;
  dateRange: { start: string; end: string };
  revenueAnalytics: {
    dailyRevenue: Array<{ date: string; gross: number; net: number; refunds: number; transactions: number }>;
    weeklyRevenue: Array<{ week: string; gross: number; net: number }>;
    monthlyRevenue: Array<{ month: string; gross: number; net: number }>;
    paymentMethods: Array<{ method: string; count: number; amount: number; percentage: number }>;
    paymentTypes: Array<{ type: string; count: number; amount: number; percentage: number }>;
  };
  growthAndUsage: {
    userGrowth: Array<{ date: string; newUsers: number; totalUsers: number }>;
    bookingsTrends: Array<{ date: string; online: number; walkIn: number; total: number }>;
    peakHours: Array<{ hour: number; label: string; entriesCount: number; exitsCount: number }>;
    topParkingLots: Array<{ lotId: string; parkingName: string; bookingsCount: number; revenue: number; occupancyRate: number }>;
    mostActiveUsers: Array<{ userId: string; fullName: string; email: string; bookingsCount: number; totalSpend: number }>;
  };
  cancellationAnalytics: {
    customerCancelled: number;
    ownerCancelled: number;
    systemCancelledNoShow: number;
    totalCancelled: number;
    cancellationRate: number;
    totalRefundAmount: number;
    refundDistribution: Array<{ label: string; count: number; percentage: number }>;
    cancellationReasons: Array<{ reason: string; count: number }>;
    cancellationTrends: Array<{ date: string; customerCancelled: number; ownerCancelled: number; noShow: number }>;
  };
  overstayAnalytics: {
    totalOverstays: number;
    averageOverstayDurationMinutes: number;
    totalOverstayRevenue: number;
    parkingLotsWithMostOverstays: Array<{ lotId: string; parkingName: string; count: number; revenue: number }>;
    repeatOverstayCustomers: Array<{ customerId: string; fullName: string; email: string; overstayCount: number; vehicleNumber: string }>;
    overstayDistributionHours: Array<{ range: string; count: number }>;
  };
}

export interface InsightsFilterOptions {
  parkingLots: Array<{ _id: string; parkingName: string }>;
  owners: Array<{ _id: string; fullName: string }>;
}

export const adminInsightsApi = {
  getDashboardData: async (
    period: DashboardPeriod = 'month',
    customFrom?: string,
    customTo?: string,
  ): Promise<AdminDashboardData> => {
    const response = await apiClient.get<{ success: boolean; data: AdminDashboardData }>(
      '/admin/insights/dashboard',
      { params: { period, customFrom, customTo } },
    );
    return response.data.data;
  },

  getAnalyticsData: async (
    period: DashboardPeriod = 'month',
    customFrom?: string,
    customTo?: string,
  ): Promise<AdminAnalyticsData> => {
    const response = await apiClient.get<{ success: boolean; data: AdminAnalyticsData }>(
      '/admin/insights/analytics',
      { params: { period, customFrom, customTo } },
    );
    return response.data.data;
  },

  getReportData: async (params: AdminReportQueryParams): Promise<AdminReportResult> => {
    const response = await apiClient.get<{ success: boolean; data: AdminReportResult }>(
      '/admin/insights/reports',
      { params },
    );
    return response.data.data;
  },

  exportReportCsv: async (params: AdminReportQueryParams): Promise<Blob> => {
    const response = await apiClient.get('/admin/insights/reports/export/csv', {
      params,
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  getFilterOptions: async (): Promise<InsightsFilterOptions> => {
    const response = await apiClient.get<{ success: boolean; data: InsightsFilterOptions }>(
      '/admin/insights/filter-options',
    );
    return response.data.data;
  },
};
