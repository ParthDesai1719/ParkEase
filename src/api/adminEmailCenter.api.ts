import { apiClient } from './client';

export type RecipientCategory =
  | 'ALL_OWNERS'
  | 'ALL_CUSTOMERS'
  | 'SPECIFIC_OWNER'
  | 'SPECIFIC_CUSTOMER';

export interface RecipientOption {
  _id: string;
  fullName: string;
  email: string;
  mobileNumber?: string | undefined;
  accountStatus: string;
  roleCode: string;
}

export interface EmailCenterOverview {
  totalEmailsSent: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  deliverySuccessRate: number;
  activeCustomersCount: number;
  activeOwnersCount: number;
  recentActivity: Array<{
    _id: string;
    emailReference: string;
    subject: string;
    recipientEmails: string[];
    recipientCategory: string;
    recipientCount: number;
    deliveryStatus: 'Pending' | 'Sending' | 'Sent' | 'Failed' | 'Retrying';
    source: string;
    sentAt: string | null;
    createdAt: string;
    sender?: {
      _id: string;
      fullName: string;
      email: string;
    } | null | undefined;
  }>;
}

export interface SendEmailPayload {
  recipientCategory: RecipientCategory;
  recipientIds?: string[] | undefined;
  subject: string;
  content: string;
  massEmailConfirmed?: boolean | undefined;
}

export interface EmailHistoryQueryParams {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  deliveryStatus?: string | undefined;
  recipientCategory?: string | undefined;
  source?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export interface EmailHistoryItem {
  _id: string;
  emailReference: string;
  subject: string;
  body: string;
  htmlBody?: string | null | undefined;
  recipientCategory: string;
  recipientCount: number;
  recipientEmails: string[];
  deliveryStatus: 'Pending' | 'Sending' | 'Sent' | 'Failed' | 'Retrying';
  source: string;
  emailType: string;
  providerMessageId?: string | null | undefined;
  failureReason?: string | null | undefined;
  sentAt?: string | null | undefined;
  createdAt: string;
  sender?: {
    _id: string;
    fullName: string;
    email: string;
  } | null | undefined;
  recipients?: Array<{
    _id: string;
    fullName: string;
    email: string;
    mobileNumber?: string | undefined;
    accountStatus?: string | undefined;
  }> | undefined;
}

export interface EmailHistoryResponse {
  emails: EmailHistoryItem[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export const adminEmailCenterApi = {
  getOverview: async (): Promise<EmailCenterOverview> => {
    const res = await apiClient.get<{ success: boolean; data: EmailCenterOverview }>(
      '/admin/email-center/overview',
    );
    return res.data.data;
  },

  searchRecipients: async (
    category: RecipientCategory,
    search?: string,
  ): Promise<{
    category: RecipientCategory;
    estimatedCount: number;
    recipients: RecipientOption[];
  }> => {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        category: RecipientCategory;
        estimatedCount: number;
        recipients: RecipientOption[];
      };
    }>('/admin/email-center/recipients', {
      params: { category, search: search || undefined },
    });
    return res.data.data;
  },

  previewEmail: async (
    subject: string,
    content: string,
  ): Promise<{ sanitizedContent: string; renderedHtml: string }> => {
    const res = await apiClient.post<{
      success: boolean;
      data: { sanitizedContent: string; renderedHtml: string };
    }>('/admin/email-center/preview', { subject, content });
    return res.data.data;
  },

  sendEmail: async (
    payload: SendEmailPayload,
  ): Promise<{
    success: boolean;
    totalTargeted: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    emailReference: string;
    message: string;
  }> => {
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      data: {
        success: boolean;
        totalTargeted: number;
        successfulDeliveries: number;
        failedDeliveries: number;
        emailReference: string;
        message: string;
      };
    }>('/admin/email-center/send', payload);
    return res.data.data;
  },

  getEmailHistory: async (params: EmailHistoryQueryParams): Promise<EmailHistoryResponse> => {
    const res = await apiClient.get<{
      success: boolean;
      data: EmailHistoryItem[];
      pagination: { total: number; page: number; totalPages: number; limit: number };
    }>('/admin/email-center/history', { params });
    return {
      emails: res.data.data,
      pagination: res.data.pagination,
    };
  },

  getEmailById: async (id: string): Promise<EmailHistoryItem> => {
    const res = await apiClient.get<{ success: boolean; data: EmailHistoryItem }>(
      `/admin/email-center/history/${id}`,
    );
    return res.data.data;
  },
};
