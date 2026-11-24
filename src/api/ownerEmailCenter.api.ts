import { apiClient } from './client';

export type OwnerRecipientCategory = 'CUSTOMERS' | 'SECURITY_STAFF';

export interface OwnerRecipientOption {
  _id: string;
  fullName: string;
  email: string;
  mobileNumber?: string | undefined;
  accountStatus: string;
  roleCode: string;
  facilityNames?: string[] | undefined;
}

export interface OwnerEmailCenterOverview {
  totalEmailsSent: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  deliverySuccessRate: number;
  activeCustomersCount: number;
  assignedStaffCount: number;
  recentEmails: Array<{
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
    parkingLotId?: {
      _id: string;
      parkingName: string;
    } | null | undefined;
  }>;
}

export interface SendOwnerEmailPayload {
  recipientCategory: OwnerRecipientCategory;
  recipientIds: string[];
  subject: string;
  content: string;
  parkingLotId?: string | undefined;
  massEmailConfirmed?: boolean | undefined;
}

export interface OwnerEmailHistoryItem {
  _id: string;
  emailReference: string;
  subject: string;
  content: string;
  recipientEmails: string[];
  recipientCategory: string;
  recipientCount: number;
  deliveryStatus: 'Pending' | 'Sending' | 'Sent' | 'Failed' | 'Retrying';
  source: string;
  sentAt: string | null;
  createdAt: string;
  errorMessage?: string | null | undefined;
  parkingLotId?: {
    _id: string;
    parkingName: string;
    city?: string | undefined;
  } | null | undefined;
}

export interface OwnerEmailHistoryResponse {
  emails: OwnerEmailHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const ownerEmailCenterApi = {
  async getRecipients(params: {
    category: OwnerRecipientCategory;
    parkingLotId?: string | undefined;
    search?: string | undefined;
  }): Promise<{ recipients: OwnerRecipientOption[]; total: number }> {
    const res = await apiClient.get('/owner/email-center/recipients', { params });
    return res.data.data;
  },

  async sendEmail(payload: SendOwnerEmailPayload): Promise<{
    emailReference: string;
    totalAttempted: number;
    successfulCount: number;
    failedCount: number;
    message: string;
  }> {
    const res = await apiClient.post('/owner/email-center/send', payload);
    return res.data.data;
  },

  async getHistory(params?: {
    page?: number | string | undefined;
    limit?: number | string | undefined;
    search?: string | undefined;
    recipientCategory?: string | undefined;
    deliveryStatus?: string | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
  }): Promise<OwnerEmailHistoryResponse> {
    const res = await apiClient.get('/owner/email-center/history', { params });
    return res.data.data;
  },

  async getOverview(): Promise<OwnerEmailCenterOverview> {
    const res = await apiClient.get('/owner/email-center/overview');
    return res.data.data;
  },
};
