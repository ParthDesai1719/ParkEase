import { apiClient } from './client';

export interface OwnerLotOption {
  _id: string;
  parkingName: string;
  address: string;
}

export interface OwnerRevenueKpis {
  totalRevenue: number;
  netRevenue: number;
  successfulPaymentsCount: number;
  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
  refundedAmount: number;
  totalRefundsCount: number;
  cancellationCount: number;
  failedPaymentsCount: number;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  refunds: number;
  transactions: number;
}

export interface PaymentStatusDistributionItem {
  status: string;
  count: number;
  amount: number;
}

export interface ParkingLotRevenueItem {
  lotId: string;
  parkingName: string;
  revenue: number;
  transactions: number;
}

export interface CancellationReasonItem {
  reason: string;
  count: number;
}

export interface OwnerRevenueOverviewResponse {
  ownerLots: OwnerLotOption[];
  kpis: OwnerRevenueKpis;
  revenueOverTime: RevenueTrendPoint[];
  paymentStatusBreakdown: PaymentStatusDistributionItem[];
  revenueByParkingLot: ParkingLotRevenueItem[];
  cancellationReasons: CancellationReasonItem[];
  payoutInfo: {
    settlementCadence: string;
    payoutMethod: string;
    status: string;
    note: string;
  };
}

export interface OwnerPaymentTransactionItem {
  _id: string;
  paymentReference: string;
  bookingReference: string;
  bookingId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  parkingLotName: string;
  parkingLotAddress: string;
  paymentType: string;
  paymentTypeCode: string;
  paymentMethod: string;
  amount: number;
  paymentStatus: string;
  transactionId: string | null;
  refundAmount: number;
  refundStatus: string | null;
  refundReason: string | null;
  createdAt: string;
}

export interface OwnerRevenueTransactionsResponse {
  transactions: OwnerPaymentTransactionItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  ownerLots: OwnerLotOption[];
}

export interface OwnerRevenueOverviewParams {
  parkingLotId?: string;
  dateFrom?: string;
  dateTo?: string;
  rangePreset?: string;
}

export interface OwnerRevenueTransactionsParams {
  parkingLotId?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentStatus?: string;
  paymentType?: string;
  paymentMethod?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getOwnerRevenueOverview(
  params?: OwnerRevenueOverviewParams,
): Promise<OwnerRevenueOverviewResponse> {
  const response = await apiClient.get<{ success: boolean; data: OwnerRevenueOverviewResponse }>(
    '/owner/revenue/overview',
    { params },
  );
  return response.data.data;
}

export async function getOwnerRevenueTransactions(
  params?: OwnerRevenueTransactionsParams,
): Promise<OwnerRevenueTransactionsResponse> {
  const response = await apiClient.get<{ success: boolean; data: OwnerRevenueTransactionsResponse }>(
    '/owner/revenue/transactions',
    { params },
  );
  return response.data.data;
}
