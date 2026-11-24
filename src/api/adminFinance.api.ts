import { apiClient } from './client';

export interface AdminFinanceOverviewQueryParams {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  parkingLotId?: string | undefined;
  ownerId?: string | undefined;
  paymentType?: string | undefined;
  paymentMethod?: string | undefined;
}

export interface AdminFinanceOverview {
  totalRevenue: number;
  netRevenue: number;
  totalRefunded: number;
  platformFeesCollected: number;
  totalTransactions: number;
  successfulTransactions: number;
  refundedTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  cashReversalPendingTransactions: number;
  successRatePercentage: number;
  paymentMethods: {
    razorpay: { count: number; amount: number; percentage: number };
    cash: { count: number; amount: number; percentage: number };
  };
  paymentTypes: {
    booking: { count: number; amount: number };
    extension: { count: number; amount: number };
    overstay: { count: number; amount: number };
    ownerRegistration: { count: number; amount: number };
  };
  paymentStatusDistribution: Array<{
    status: string;
    label: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  refundStatusDistribution: Array<{
    status: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  revenueTrend: Array<{
    date: string;
    revenue: number;
    refunds: number;
    platformFee: number;
    transactionsCount: number;
  }>;
}

export interface AdminPaymentQueryParams {
  search?: string | undefined;
  status?: string | undefined;
  paymentType?: string | undefined;
  paymentMethod?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  parkingLotId?: string | undefined;
  ownerId?: string | undefined;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface AdminPaymentListItem {
  _id: string;
  paymentReference: string;
  transactionId?: string | null | undefined;
  gatewayPaymentId?: string | null | undefined;
  gatewayOrderId?: string | null | undefined;
  paymentType: string;
  paymentTypeCode: 'BOOKING' | 'EXTENSION' | 'OVERSTAY' | 'OWNER_REGISTRATION';
  paymentMethod: 'RAZORPAY' | 'CASH';
  paymentStatus: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED' | 'CASH_REVERSAL_PENDING';
  refundWorkflowState?: 'Refund Pending' | 'Refund Processing' | 'Refund Completed' | 'Refund Failed' | null | undefined;
  amount: number;
  platformBookingFee: number;
  additionalCharges: number;
  refundAmount: number;
  refundsCount: number;
  paymentDate?: string | null | undefined;
  createdAt: string;
  customer?: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber?: string | undefined;
  } | null | undefined;
  owner?: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber?: string | undefined;
  } | null | undefined;
  parkingLot?: {
    _id: string;
    parkingName: string;
    address?: string | undefined;
    city?: string | undefined;
  } | null | undefined;
  booking?: {
    _id: string;
    bookingReference: string;
    bookingStatus: string;
    vehiclePlate?: string | undefined;
  } | null | undefined;
  ownerApplication?: {
    _id: string;
    applicationReference: string;
    businessName: string;
    businessType?: string | undefined;
  } | null | undefined;
}

export interface AdminPaymentDetailData extends AdminPaymentListItem {
  gatewaySignatureProvided: boolean;
  remarks?: string | null | undefined;
  refunds: Array<{
    refundReference: string;
    refundAmount: number;
    refundStatus: 'Refund Pending' | 'Refund Processing' | 'Refund Completed' | 'Refund Failed';
    refundReason: string;
    gatewayRefundId?: string | null | undefined;
    refundTransactionId?: string | null | undefined;
    initiatedAt: string;
    completedAt?: string | null | undefined;
    initiatedBy?: {
      _id: string;
      fullName: string;
      email: string;
    } | null | undefined;
    remarks?: string | null | undefined;
  }>;
  bookingDetails?: {
    bookingReference: string;
    bookingStatus: string;
    scheduledEntryTime: string;
    scheduledExitTime: string;
    actualEntryTime?: string | null | undefined;
    actualExitTime?: string | null | undefined;
    vehicle?: {
      plateNumber: string;
      model?: string | undefined;
      vehicleType?: string | undefined;
    } | null | undefined;
    parkingSlot?: {
      slotNumber: string;
      slotLabel?: string | undefined;
    } | null | undefined;
  } | null | undefined;
  bookingTimeline?: Array<{
    eventCode: string;
    eventType: string;
    eventDescription: string;
    eventTime: string;
    eventSource: string;
  }> | undefined;
}

export interface FinanceFilterOptions {
  parkingLots: Array<{
    _id: string;
    parkingName: string;
    city?: string | undefined;
  }>;
  owners: Array<{
    _id: string;
    fullName: string;
    email: string;
  }>;
}

export const adminFinanceApi = {
  getOverview: async (params?: AdminFinanceOverviewQueryParams): Promise<AdminFinanceOverview> => {
    const response = await apiClient.get<{ success: boolean; data: AdminFinanceOverview }>(
      '/admin/finance/overview',
      { params },
    );
    return response.data.data;
  },

  getPayments: async (
    params?: AdminPaymentQueryParams,
  ): Promise<{ payments: AdminPaymentListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const response = await apiClient.get<{
      success: boolean;
      data: AdminPaymentListItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/finance/payments', { params });
    return {
      payments: response.data.data,
      pagination: response.data.pagination,
    };
  },

  getPaymentById: async (id: string): Promise<AdminPaymentDetailData> => {
    const response = await apiClient.get<{ success: boolean; data: AdminPaymentDetailData }>(
      `/admin/finance/payments/${id}`,
    );
    return response.data.data;
  },

  getFilterOptions: async (): Promise<FinanceFilterOptions> => {
    const response = await apiClient.get<{ success: boolean; data: FinanceFilterOptions }>(
      '/admin/finance/filter-options',
    );
    return response.data.data;
  },

  exportCsv: async (params?: AdminPaymentQueryParams): Promise<Blob> => {
    const response = await apiClient.get('/admin/finance/export/csv', {
      params,
      responseType: 'blob',
    });
    return response.data as Blob;
  },
};
