import { apiClient } from './client';
import type { ApiResponse } from '../types/auth';

export interface FloorReferenceItem {
  floorName: string;
  floorNumber: number;
  slotCount: number;
  floorDescription?: string;
  parkingType?: string;
  specialAreas?: string;
  additionalNotes?: string;
}

export interface ZoneReferenceItem {
  zoneName: string;
  floorName: string;
  slotCount: number;
  zoneType?: string;
  supportedVehicleType?: string;
  description?: string;
  specialPurpose?: string;
  additionalNotes?: string;
}

export interface PhotoItem {
  url: string;
  caption?: string;
  category?: string;
  isPrimary?: boolean;
}

export interface ParkingPlanPdf {
  url: string;
  fileName: string;
  fileSize: number;
  uploadedAt?: string;
}

export interface FacilitySubmissionData {
  _id?: string;
  submissionReference?: string;
  ownerId?: string;
  submissionStatus?: 'Draft' | 'Submitted' | 'Under Review' | 'Changes Requested' | 'Approved' | 'Rejected';
  facilityName: string;
  shortDescription?: string;
  detailedDescription?: string;
  facilityType: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  location: {
    address: string;
    addressLine1?: string;
    addressLine2?: string;
    areaLocality?: string;
    city: string;
    state: string;
    postalCode: string;
    latitude: number;
    longitude: number;
    confirmed: boolean;
  };
  capacity: {
    totalSlots: number;
    breakdown: {
      car: number;
      suv: number;
      bike: number;
      ev: number;
      accessible: number;
      vip: number;
      other: number;
    };
  };
  floors: FloorReferenceItem[];
  zones: ZoneReferenceItem[];
  amenities: string[];
  operatingInfo: {
    isOpen24x7: boolean;
    openingTime: string;
    closingTime: string;
    scheduleType?: string;
    dailySchedules?: Array<{
      day: string;
      isOpen: boolean;
      openingTime: string;
      closingTime: string;
    }>;
  };
  pricing: {
    carHourlyRate: number;
    suvHourlyRate: number;
    bikeHourlyRate: number;
    dailyRate?: number;
    overnightRate?: number;
    evChargingRatePerHour?: number;
    otherHourlyRate?: number;
    gracePeriodMinutes: number;
    minParkingDurationHours: number;
    maxParkingDurationHours?: number;
    additionalPricingNotes?: string;
  };
  supportedVehicleTypes: string[];
  parkingRules: {
    rules?: string;
    entryExitInstructions?: string;
    vehicleRestrictions?: string;
    heightWeightRestrictions?: string;
    evRules?: string;
    accessibleParkingRules?: string;
    vipParkingRules?: string;
    overnightRules?: string;
    otherInstructions?: string;
  };
  photos: PhotoItem[];
  primaryImageUrl?: string;
  parkingPlanPdf?: ParkingPlanPdf | null;
  subject?: string;
  additionalDescription?: string;
  submittedAt?: string | null;
  resubmittedAt?: string | null;
  adminRemarks?: string | null;
  requestedChanges?: string | null;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  reviewedAt?: string | null;
  officialParkingLotId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export async function getOwnerSubmissions(): Promise<FacilitySubmissionData[]> {
  const response = await apiClient.get<ApiResponse<FacilitySubmissionData[]>>(
    '/owner/parking/submissions',
  );
  return response.data.data || [];
}

export async function getSubmissionById(id: string): Promise<FacilitySubmissionData> {
  const response = await apiClient.get<ApiResponse<FacilitySubmissionData>>(
    `/owner/parking/submissions/${id}`,
  );
  if (!response.data.data) {
    throw new Error('Submission data not returned by server.');
  }
  return response.data.data;
}

export async function createDraftSubmission(
  data: Partial<FacilitySubmissionData>,
): Promise<FacilitySubmissionData> {
  const response = await apiClient.post<ApiResponse<FacilitySubmissionData>>(
    '/owner/parking/submissions',
    data,
  );
  if (!response.data.data) {
    throw new Error('Draft creation failed.');
  }
  return response.data.data;
}

export async function updateSubmission(
  id: string,
  data: Partial<FacilitySubmissionData>,
): Promise<FacilitySubmissionData> {
  const response = await apiClient.put<ApiResponse<FacilitySubmissionData>>(
    `/owner/parking/submissions/${id}`,
    data,
  );
  if (!response.data.data) {
    throw new Error('Submission update failed.');
  }
  return response.data.data;
}

export async function submitForReview(
  id: string,
  data?: Partial<FacilitySubmissionData>,
): Promise<FacilitySubmissionData> {
  const response = await apiClient.post<ApiResponse<FacilitySubmissionData>>(
    `/owner/parking/submissions/${id}/submit`,
    data || {},
  );
  if (!response.data.data) {
    throw new Error('Submission finalize failed.');
  }
  return response.data.data;
}

export async function deleteDraftSubmission(id: string): Promise<void> {
  await apiClient.delete<ApiResponse<null>>(`/owner/parking/submissions/${id}`);
}

export async function uploadSubmissionPhoto(
  file: File,
  category = 'Exterior',
  isPrimary = false,
  caption = '',
): Promise<{
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
  isPrimary: boolean;
  caption: string;
}> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  formData.append('isPrimary', String(isPrimary));
  formData.append('caption', caption);

  const response = await apiClient.post<
    ApiResponse<{
      url: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      category: string;
      isPrimary: boolean;
      caption: string;
    }>
  >('/owner/parking/submissions/upload-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.data.data) {
    throw new Error('Photo upload failed.');
  }

  return response.data.data;
}

export async function uploadSubmissionPlanPdf(
  file: File,
): Promise<{
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<
    ApiResponse<{
      url: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      uploadedAt: string;
    }>
  >('/owner/parking/submissions/upload-plan-pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.data.data) {
    throw new Error('PDF upload failed.');
  }

  return response.data.data;
}

export async function fetchSubmissionFileBlob(filename: string): Promise<Blob> {
  const response = await apiClient.get(
    `/owner/parking/submissions/files/${encodeURIComponent(filename)}`,
    {
      responseType: 'blob',
    },
  );
  return response.data;
}
