import { apiClient } from './client';

export interface AdminReviewListItem {
  _id: string;
  overallRating: number;
  comment: string | null;
  ownerReply: string | null;
  replyDate: string | null;
  replyEdited: boolean;
  isEdited: boolean;
  moderationStatus: 'Published' | 'Under Review' | 'Hidden';
  moderatedAt: string | null;
  moderationReason: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber?: string | undefined;
    profileImage?: string | null | undefined;
  } | null;
  parkingLot: {
    _id: string;
    parkingName: string;
    address?: string | undefined;
    city?: string | undefined;
  } | null;
  owner: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber?: string | undefined;
  } | null;
  booking: {
    _id: string;
    bookingReference: string;
    bookingStatus: string;
  } | null;
  moderatedBy: {
    _id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface ModerationHistoryItem {
  action: 'Approve' | 'Hide' | 'Flag' | 'Delete Attempt';
  moderatedAt: string;
  reason: string | null;
  previousStatus: string;
  newStatus: string;
  moderatedBy?: {
    _id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface AdminReviewDetailData extends AdminReviewListItem {
  moderationHistory: ModerationHistoryItem[];
}

export interface AdminReviewOverview {
  totalReviews: number;
  publishedReviews: number;
  underReviewReviews: number;
  hiddenReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  recentActivity: Array<{
    _id: string;
    overallRating: number;
    comment: string | null;
    moderationStatus: string;
    customerName: string;
    parkingLotName: string;
    createdAt: string;
  }>;
}

export interface AdminReviewQueryParams {
  page?: number | string | undefined;
  limit?: number | string | undefined;
  search?: string | undefined;
  rating?: number | string | undefined;
  status?: string | undefined;
  parkingLotId?: string | undefined;
  ownerId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export interface ReviewFilterOptions {
  parkingLots: Array<{ _id: string; parkingName: string }>;
  owners: Array<{ _id: string; fullName: string }>;
}

export const adminReviewsApi = {
  getOverview: async (): Promise<AdminReviewOverview> => {
    const response = await apiClient.get<{ success: boolean; data: AdminReviewOverview }>(
      '/admin/reviews/overview',
    );
    return response.data.data;
  },

  getReviews: async (
    params?: AdminReviewQueryParams,
  ): Promise<{
    reviews: AdminReviewListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> => {
    const response = await apiClient.get<{
      success: boolean;
      data: AdminReviewListItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/reviews', { params });
    return {
      reviews: response.data.data,
      pagination: response.data.pagination,
    };
  },

  getReviewById: async (id: string): Promise<AdminReviewDetailData> => {
    const response = await apiClient.get<{ success: boolean; data: AdminReviewDetailData }>(
      `/admin/reviews/${id}`,
    );
    return response.data.data;
  },

  approveReview: async (
    id: string,
    reason?: string,
  ): Promise<{ success: boolean; message: string; data: AdminReviewListItem }> => {
    const response = await apiClient.patch<{
      success: boolean;
      message: string;
      data: AdminReviewListItem;
    }>(`/admin/reviews/${id}/approve`, { reason });
    return response.data;
  },

  hideReview: async (
    id: string,
    reason: string,
  ): Promise<{ success: boolean; message: string; data: AdminReviewListItem }> => {
    const response = await apiClient.patch<{
      success: boolean;
      message: string;
      data: AdminReviewListItem;
    }>(`/admin/reviews/${id}/hide`, { reason });
    return response.data;
  },

  deleteReview: async (
    id: string,
    reason: string,
  ): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/admin/reviews/${id}`,
      { data: { reason } },
    );
    return response.data;
  },

  getFilterOptions: async (): Promise<ReviewFilterOptions> => {
    const response = await apiClient.get<{ success: boolean; data: ReviewFilterOptions }>(
      '/admin/reviews/filter-options',
    );
    return response.data.data;
  },
};
