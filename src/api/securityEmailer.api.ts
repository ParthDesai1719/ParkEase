import { apiClient } from './client';

export interface AssignedFacilityOwner {
  assignmentId: string;
  parkingLotId: string;
  parkingLotName: string;
  city?: string | undefined;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | undefined;
}

export interface SendSecurityEmailPayload {
  parkingLotId: string;
  subject: string;
  content: string;
}

export interface SecurityEmailHistoryItem {
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
  parkingLotId?: {
    _id: string;
    parkingName: string;
    city?: string | undefined;
  } | null | undefined;
  recipientIds?: Array<{
    _id: string;
    fullName: string;
    email: string;
  }> | undefined;
}

export interface SecurityEmailHistoryResponse {
  emails: SecurityEmailHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const securityEmailerApi = {
  async getAssignedOwners(): Promise<AssignedFacilityOwner[]> {
    const res = await apiClient.get('/security/emailer/recipient-owner');
    return res.data.data;
  },

  async sendEmailToOwner(payload: SendSecurityEmailPayload): Promise<{
    emailReference: string;
    ownerName: string;
    ownerEmail: string;
    message: string;
    deliveryStatus?: 'Sent' | 'Failed';
  }> {
    const res = await apiClient.post('/security/emailer/send', payload);
    return res.data.data;
  },

  async getHistory(params?: {
    page?: number | string | undefined;
    limit?: number | string | undefined;
    search?: string | undefined;
  }): Promise<SecurityEmailHistoryResponse> {
    const res = await apiClient.get('/security/emailer/history', { params });
    return res.data.data;
  },
};
