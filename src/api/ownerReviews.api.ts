import { apiClient } from './client';
import type { OwnerLotOption } from './ownerRevenue.api';

export interface OwnerReviewItem {
  _id: string;
  bookingId: string | null;
  bookingReference: string;
  customerName: string;
  customerEmail: string | null;
  parkingLotId: string;
  parkingLotName: string;
  overallRating: number;
  comment: string;
  ownerReply: string | null;
  replyDate: string | null;
  replyEdited: boolean;
  isEdited: boolean;
  moderationStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerReviewsSummary {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  awaitingReplyCount: number;
  repliedCount: number;
}

export interface OwnerReviewsResponse {
  reviews: OwnerReviewItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  ownerLots: OwnerLotOption[];
  summary: OwnerReviewsSummary;
}

export interface OwnerReviewsQueryParams {
  parkingLotId?: string;
  starRating?: string | number;
  replyStatus?: 'all' | 'awaiting' | 'replied';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function getOwnerReviews(
  params?: OwnerReviewsQueryParams,
): Promise<OwnerReviewsResponse> {
  const response = await apiClient.get<{ success: boolean; data: OwnerReviewsResponse }>(
    '/owner/reviews',
    { params },
  );
  return response.data.data;
}

export async function submitOwnerReviewReply(
  reviewId: string,
  replyText: string,
): Promise<{ _id: string; ownerReply: string; replyDate: string; replyEdited: boolean; message: string }> {
  const response = await apiClient.post<{
    success: boolean;
    message: string;
    data: { _id: string; ownerReply: string; replyDate: string; replyEdited: boolean; message: string };
  }>(`/owner/reviews/${reviewId}/reply`, { replyText });
  return response.data.data;
}
