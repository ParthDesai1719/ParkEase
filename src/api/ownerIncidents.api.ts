import { apiClient } from './client';

export interface OwnerIncidentItem {
  _id: string;
  incidentReference: string;
  parkingLotId: string;
  parkingName: string;
  bookingId: string | null;
  bookingReference?: string | null;
  vehicleId: string | null;
  vehicleNumber?: string | null;
  vehicleType?: string | null;
  customerId: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  reportedBy: {
    userId: string;
    fullName: string;
    role?: string;
  };
  incidentSource: string;
  incidentType: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  incidentStatus: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed';
  title: string;
  description: string;
  attachments: string[];
  location: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  closedAt: string | null;
  responses: Array<{
    responseId: string;
    authorId: string;
    authorRole: string;
    authorName: string;
    message: string;
    attachments: string[];
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerIncidentsQueryParams {
  parkingLotId?: string;
  status?: string;
  severity?: string;
  incidentType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface OwnerIncidentsResponseData {
  incidents: OwnerIncidentItem[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
  summary: {
    total: number;
    open: number;
    underInvestigation: number;
    resolved: number;
    closed: number;
    criticalOrHigh: number;
  };
  ownerLots: Array<{ _id: string; parkingName: string; address?: string }>;
}

export async function getOwnerIncidents(
  params?: OwnerIncidentsQueryParams,
): Promise<{ success: boolean; data: OwnerIncidentsResponseData }> {
  const query = new URLSearchParams();
  if (params?.parkingLotId && params.parkingLotId !== 'all') {
    query.set('parkingLotId', params.parkingLotId);
  }
  if (params?.status && params.status !== 'all') {
    query.set('status', params.status);
  }
  if (params?.severity && params.severity !== 'all') {
    query.set('severity', params.severity);
  }
  if (params?.incidentType && params.incidentType !== 'all') {
    query.set('incidentType', params.incidentType);
  }
  if (params?.search) {
    query.set('search', params.search);
  }
  if (params?.dateFrom) {
    query.set('dateFrom', params.dateFrom);
  }
  if (params?.dateTo) {
    query.set('dateTo', params.dateTo);
  }
  if (params?.page) {
    query.set('page', String(params.page));
  }
  if (params?.limit) {
    query.set('limit', String(params.limit));
  }

  const endpoint = `/owner/incidents${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await apiClient.get<any>(endpoint);
  const data = response.data?.data !== undefined ? response.data.data : response.data;
  return { success: true, data };
}

export async function getOwnerIncidentDetail(
  incidentId: string,
): Promise<{ success: boolean; data: OwnerIncidentItem }> {
  const response = await apiClient.get<any>(`/owner/incidents/${incidentId}`);
  const data = response.data?.data !== undefined ? response.data.data : response.data;
  return { success: true, data };
}

export async function addOwnerIncidentResponse(
  incidentId: string,
  payload: { message: string; attachments?: string[] },
): Promise<{ success: boolean; data: OwnerIncidentItem }> {
  const response = await apiClient.post<any>(
    `/owner/incidents/${incidentId}/responses`,
    payload,
  );
  const data = response.data?.data !== undefined ? response.data.data : response.data;
  return { success: true, data };
}

export async function updateOwnerIncidentStatus(
  incidentId: string,
  payload: {
    status: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed';
    resolutionNotes?: string;
  },
): Promise<{ success: boolean; data: OwnerIncidentItem }> {
  const response = await apiClient.patch<any>(
    `/owner/incidents/${incidentId}/status`,
    payload,
  );
  const data = response.data?.data !== undefined ? response.data.data : response.data;
  return { success: true, data };
}
