import { apiClient } from './client';

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  refunds: number;
  transactions: number;
}

export interface FloorOccupancyItem {
  floorId: string;
  floorName: string;
  totalSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  availableSlots: number;
  maintenanceSlots: number;
  occupancyPercentage: number;
}

export interface RecentBookingItem {
  _id: string;
  bookingReference: string;
  customerName: string;
  vehicleNumber: string;
  vehicleType: string;
  parkingLotName: string;
  slotNumber: string;
  scheduledEntryTime: string;
  scheduledExitTime: string;
  bookingStatus: string;
  totalAmount: number;
  createdAt: string;
}

export interface RecentReviewItem {
  _id: string;
  customerName: string;
  parkingLotName: string;
  overallRating: number;
  comment: string;
  hasReply: boolean;
  createdAt: string;
}

export interface OwnerDashboardAnalyticsData {
  ownerLots: Array<{ _id: string; parkingName: string; address: string; totalSlots: number }>;
  selectedLotId: string;
  dateRange: { start: string; end: string; preset: string };
  kpis: {
    totalRevenue: number;
    netRevenue: number;
    successfulPayments: number;
    totalBookings: number;
    activeBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    occupancyRate: number;
    totalSlots: number;
    occupiedSlots: number;
    reservedSlots: number;
    availableSlots: number;
    maintenanceSlots: number;
    overstayCount: number;
    averageRating: number;
    totalReviews: number;
    awaitingReplyCount: number;
  };
  revenueTrends: RevenueTrendPoint[];
  floorOccupancy: FloorOccupancyItem[];
  recentBookings: RecentBookingItem[];
  recentReviews: RecentReviewItem[];
}

export interface OwnerDashboardAnalyticsParams {
  parkingLotId?: string;
  rangePreset?: 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom';
  dateFrom?: string;
  dateTo?: string;
}

export async function getOwnerDashboardAnalytics(
  params?: OwnerDashboardAnalyticsParams,
): Promise<OwnerDashboardAnalyticsData> {
  const response = await apiClient.get<{ success: boolean; data: OwnerDashboardAnalyticsData }>(
    '/owner/analytics/dashboard',
    { params },
  );
  return response.data.data;
}
