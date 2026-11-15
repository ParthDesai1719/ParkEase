import { apiClient } from './client';
import type { ApiResponse } from '../types/auth';

export interface DashboardOverviewMetrics {
  totalOwners: number;
  pendingApprovals: number;
  approvedOwners: number;
  suspendedOwners: number;
}

export interface PopulatedApplicant {
  _id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  accountStatus: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  createdAt: string;
}

export interface PopulatedPayment {
  _id: string;
  paymentReference: string;
  amount: number;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
  currency?: string;
}

export interface PopulatedReviewer {
  _id: string;
  fullName: string;
  email: string;
}

export interface OwnerApplicationItem {
  _id: string;
  applicantId: PopulatedApplicant | string;
  applicationReference: string;
  businessName: string;
  businessType: string;
  businessAddress: string;
  city: string;
  state: string;
  postalCode: string;
  parkingCapacity: number;
  businessDescription: string;
  ownerName: string;
  businessEmail: string;
  businessPhone: string;
  governmentIdType: string;
  governmentIdNumber: string;
  identityProofUrl: string;
  businessLicenseUrl: string;
  propertyProofUrl: string;
  parkingImageUrls: string[];
  termsAccepted: boolean;
  emailOtpVerified: boolean;
  mobileOtpVerified: boolean;
  paymentId?: PopulatedPayment | null;
  registrationFeeAmount: number;
  applicationStatus: 'Draft' | 'Submitted' | 'Pending Review' | 'Approved' | 'Rejected';
  reviewedBy?: PopulatedReviewer | null;
  reviewedAt?: string | null;
  adminRemarks?: string | null;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedApplicationsResponse {
  applications: OwnerApplicationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetApplicationsParams {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getDashboardOverview(): Promise<ApiResponse<DashboardOverviewMetrics>> {
  const response = await apiClient.get<ApiResponse<DashboardOverviewMetrics>>('/admin/overview');
  return response.data;
}

export async function getOwnerApplications(
  params?: GetApplicationsParams,
): Promise<ApiResponse<PaginatedApplicationsResponse>> {
  const response = await apiClient.get<ApiResponse<PaginatedApplicationsResponse>>(
    '/admin/owner-applications',
    { params },
  );
  return response.data;
}

export async function getOwnerApplicationById(
  id: string,
): Promise<ApiResponse<OwnerApplicationItem>> {
  const response = await apiClient.get<ApiResponse<OwnerApplicationItem>>(
    `/admin/owner-applications/${id}`,
  );
  return response.data;
}

export async function approveOwnerApplication(
  id: string,
  data?: { remarks?: string },
): Promise<ApiResponse<OwnerApplicationItem>> {
  const response = await apiClient.post<ApiResponse<OwnerApplicationItem>>(
    `/admin/owner-applications/${id}/approve`,
    data || {},
  );
  return response.data;
}

export async function rejectOwnerApplication(
  id: string,
  data: { rejectionReason: string; remarks?: string },
): Promise<ApiResponse<OwnerApplicationItem>> {
  const response = await apiClient.post<ApiResponse<OwnerApplicationItem>>(
    `/admin/owner-applications/${id}/reject`,
    data,
  );
  return response.data;
}

export async function updateOwnerApplicationRemarks(
  id: string,
  remarks: string,
): Promise<ApiResponse<OwnerApplicationItem>> {
  const response = await apiClient.put<ApiResponse<OwnerApplicationItem>>(
    `/admin/owner-applications/${id}/remarks`,
    { remarks },
  );
  return response.data;
}

export function getOwnerApplicationDocumentUrl(
  id: string,
  docType: 'identityProof' | 'businessLicense' | 'propertyProof' | 'parkingImage',
  index?: number,
): string {
  const query = typeof index === 'number' ? `?index=${index}` : '';
  return `/api/v1/admin/owner-applications/${id}/documents/${docType}${query}`;
}

export async function getOwnerApplicationDocumentBlob(
  id: string,
  docType: 'identityProof' | 'businessLicense' | 'propertyProof' | 'parkingImage',
  index?: number,
): Promise<{ blob: Blob; mimeType: string }> {
  const query = typeof index === 'number' ? `?index=${index}` : '';
  const response = await apiClient.get<Blob>(
    `/admin/owner-applications/${id}/documents/${docType}${query}`,
    {
      responseType: 'blob',
    },
  );
  return {
    blob: response.data,
    mimeType: (response.headers['content-type'] as string) || 'application/octet-stream',
  };
}

export interface PublicRegistrationStatusData {
  applicationReference: string;
  businessName: string;
  businessType: string;
  city: string;
  state: string;
  parkingCapacity: number;
  applicationStatus: 'Draft' | 'Submitted' | 'Pending Review' | 'Approved' | 'Rejected';
  registrationFeeAmount: number;
  paymentStatus: string;
  paymentReference: string | null;
  submittedAt: string;
  updatedAt: string;
  adminRemarks: string | null;
  rejectionReason: string | null;
  hasIdentityProof: boolean;
  hasBusinessLicense: boolean;
  hasPropertyProof: boolean;
  parkingImagesCount: number;
}

export async function getPublicRegistrationStatus(
  query: string,
): Promise<ApiResponse<PublicRegistrationStatusData>> {
  const response = await apiClient.get<ApiResponse<PublicRegistrationStatusData>>(
    '/owner/registration-status',
    { params: { query } },
  );
  return response.data;
}

/**
 * =========================================================================
 * PARKING FACILITY SUBMISSION REVIEW APIS
 * =========================================================================
 */

import type { FacilitySubmissionData } from './facilitySubmission.api';

export interface AdminFacilitySubmissionItem extends Omit<FacilitySubmissionData, 'ownerId'> {
  ownerId?:
    | {
        _id: string;
        fullName: string;
        email: string;
        mobileNumber: string;
        accountStatus?: string;
      }
    | string;
  reviewedBy?:
    | {
        _id: string;
        fullName: string;
        email: string;
      }
    | string
    | null;
}

export interface FacilitySubmissionsStats {
  total: number;
  submitted: number;
  underReview: number;
  changesRequested: number;
  approved: number;
  rejected: number;
  draft: number;
}

export interface PaginatedFacilitySubmissionsResponse {
  submissions: AdminFacilitySubmissionItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: FacilitySubmissionsStats;
}

export interface GetAdminFacilitySubmissionsParams {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getAdminFacilitySubmissions(
  params?: GetAdminFacilitySubmissionsParams,
): Promise<ApiResponse<PaginatedFacilitySubmissionsResponse>> {
  const response = await apiClient.get<ApiResponse<PaginatedFacilitySubmissionsResponse>>(
    '/admin/facilities',
    { params },
  );
  return response.data;
}

export async function getAdminFacilitySubmissionById(
  id: string,
): Promise<ApiResponse<AdminFacilitySubmissionItem>> {
  const response = await apiClient.get<ApiResponse<AdminFacilitySubmissionItem>>(
    `/admin/facilities/${id}`,
  );
  return response.data;
}

export async function startAdminFacilityReview(
  id: string,
): Promise<ApiResponse<AdminFacilitySubmissionItem>> {
  const response = await apiClient.post<ApiResponse<AdminFacilitySubmissionItem>>(
    `/admin/facilities/${id}/start-review`,
  );
  return response.data;
}

export async function requestAdminFacilityChanges(
  id: string,
  remarks: string,
): Promise<ApiResponse<AdminFacilitySubmissionItem>> {
  const response = await apiClient.post<ApiResponse<AdminFacilitySubmissionItem>>(
    `/admin/facilities/${id}/request-changes`,
    { remarks },
  );
  return response.data;
}

export async function approveAdminFacilitySubmission(
  id: string,
  remarks?: string,
): Promise<ApiResponse<AdminFacilitySubmissionItem>> {
  const response = await apiClient.post<ApiResponse<AdminFacilitySubmissionItem>>(
    `/admin/facilities/${id}/approve`,
    { remarks },
  );
  return response.data;
}

export async function rejectAdminFacilitySubmission(
  id: string,
  rejectionReason: string,
  remarks?: string,
): Promise<ApiResponse<AdminFacilitySubmissionItem>> {
  const response = await apiClient.post<ApiResponse<AdminFacilitySubmissionItem>>(
    `/admin/facilities/${id}/reject`,
    { rejectionReason, remarks },
  );
  return response.data;
}

export async function updateAdminFacilityRemarks(
  id: string,
  remarks: string,
): Promise<ApiResponse<AdminFacilitySubmissionItem>> {
  const response = await apiClient.put<ApiResponse<AdminFacilitySubmissionItem>>(
    `/admin/facilities/${id}/remarks`,
    { remarks },
  );
  return response.data;
}

export async function fetchAdminFacilityFileBlob(filename: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(`/admin/facilities/files/${filename}`, {
    responseType: 'blob',
  });
  return response.data;
}
