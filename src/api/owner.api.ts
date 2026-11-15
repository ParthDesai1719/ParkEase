import { apiClient } from './client';
import type { ApiResponse } from '../types/auth';
import type { OfficialParkingLot } from './parkingLot.api';

export interface OwnerRegistrationConfig {
  ownerRegistrationFee: number;
  defaultCurrency: string;
  paymentGateway: string;
  razorpayKeyId: string;
}

export interface UploadDocumentResult {
  filePath: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface OwnerRegistrationFormData {
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
}

export interface DraftRegistrationResult {
  applicationReference: string;
  businessEmail: string;
  businessPhone: string;
  registrationFeeAmount: number;
  status: string;
  message: string;
}

export interface OtpChallengeResult {
  message: string;
  cooldownSeconds: number;
}

export interface VerifyEmailOtpResult {
  emailOtpVerified: boolean;
  mobileOtpSent: boolean;
  message: string;
}

export interface VerifyMobileOtpResult {
  emailOtpVerified: boolean;
  mobileOtpVerified: boolean;
  message: string;
}

export interface PaymentOrderResult {
  orderId: string;
  amountPaise: number;
  amount: number;
  currency: string;
  keyId: string;
  applicationReference: string;
  businessName: string;
  ownerName: string;
  email: string;
  contact: string;
}

export interface VerifyPaymentResult {
  applicationReference: string;
  paymentReference: string;
  paymentId: string;
  amount: number;
  applicationStatus: string;
  paymentStatus: string;
  submittedAt: string;
  businessName: string;
  ownerName: string;
}

export interface PublicRegistrationStatusResult {
  applicationReference: string;
  businessName: string;
  businessType: string;
  city: string;
  state: string;
  parkingCapacity: number;
  applicationStatus: string;
  registrationFeeAmount: number;
  paymentStatus: string;
  paymentReference?: string | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
  adminRemarks?: string | null;
  rejectionReason?: string | null;
  hasIdentityProof: boolean;
  hasBusinessLicense: boolean;
  hasPropertyProof: boolean;
  parkingImagesCount: number;
}

export const ownerApi = {
  /**
   * Get dynamic platform configuration for Owner Registration (Fee, Gateway, etc.)
   */
  async getConfig(): Promise<OwnerRegistrationConfig> {
    const res = await apiClient.get<ApiResponse<OwnerRegistrationConfig>>('/owner/config');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to load registration configuration');
    }
    return res.data.data;
  },

  /**
   * Securely upload an applicant verification document or image.
   */
  async uploadDocument(file: File): Promise<UploadDocumentResult> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post<ApiResponse<UploadDocumentResult>>('/owner/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'File upload failed');
    }
    return res.data.data;
  },

  /**
   * Submit registration details and create initial Draft application.
   */
  async createDraft(data: OwnerRegistrationFormData): Promise<DraftRegistrationResult> {
    const res = await apiClient.post<ApiResponse<DraftRegistrationResult>>('/owner/register', data);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Registration failed');
    }
    return res.data.data;
  },

  /**
   * Request resend of Email OTP challenge.
   */
  async requestEmailOtp(applicationReference: string): Promise<OtpChallengeResult> {
    const res = await apiClient.post<ApiResponse<OtpChallengeResult>>(
      '/owner/register/request-email-otp',
      { applicationReference },
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to request email OTP');
    }
    return res.data.data;
  },

  /**
   * Verify 6-digit Email OTP.
   */
  async verifyEmailOtp(applicationReference: string, otp: string): Promise<VerifyEmailOtpResult> {
    const res = await apiClient.post<ApiResponse<VerifyEmailOtpResult>>(
      '/owner/register/verify-email-otp',
      { applicationReference, otp },
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Email OTP verification failed');
    }
    return res.data.data;
  },

  /**
   * Request resend of Mobile OTP challenge.
   */
  async requestMobileOtp(applicationReference: string): Promise<OtpChallengeResult> {
    const res = await apiClient.post<ApiResponse<OtpChallengeResult>>(
      '/owner/register/request-mobile-otp',
      { applicationReference },
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to request mobile OTP');
    }
    return res.data.data;
  },

  /**
   * Verify 6-digit Mobile OTP. Unlocks payment access.
   */
  async verifyMobileOtp(applicationReference: string, otp: string): Promise<VerifyMobileOtpResult> {
    const res = await apiClient.post<ApiResponse<VerifyMobileOtpResult>>(
      '/owner/register/verify-mobile-otp',
      { applicationReference, otp },
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Mobile OTP verification failed');
    }
    return res.data.data;
  },

  /**
   * Create Razorpay test order. Locked on backend until dual OTP verified.
   */
  async createPaymentOrder(applicationReference: string): Promise<PaymentOrderResult> {
    const res = await apiClient.post<ApiResponse<PaymentOrderResult>>(
      '/owner/register/create-order',
      { applicationReference },
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to generate payment order');
    }
    return res.data.data;
  },

  /**
   * Verify Razorpay payment signature server-side and submit application.
   */
  async verifyPayment(payload: {
    applicationReference: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<VerifyPaymentResult> {
    const res = await apiClient.post<ApiResponse<VerifyPaymentResult>>(
      '/owner/register/verify-payment',
      payload,
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Payment verification failed');
    }
    return res.data.data;
  },

  /**
   * Public registration status lookup.
   */
  async getStatus(query: string): Promise<PublicRegistrationStatusResult> {
    const res = await apiClient.get<ApiResponse<PublicRegistrationStatusResult>>(
      '/owner/registration-status',
      { params: { query } },
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Application lookup failed');
    }
    return res.data.data;
  },

  /**
   * Fetch authenticated Owner's registration application documents and status.
   */
  async getRegistrationDocuments(): Promise<OwnerRegistrationDocumentsData> {
    const res = await apiClient.get<ApiResponse<OwnerRegistrationDocumentsData>>(
      '/owner/registration-documents',
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to load registration documents');
    }
    return res.data.data;
  },

  /**
   * Retrieve a secure blob URL for previewing an Owner registration document.
   */
  async getRegistrationDocumentBlob(
    docType: 'identityProof' | 'businessLicense' | 'propertyProof' | 'parkingImage',
    index?: number,
  ): Promise<{ blob: Blob; mimeType: string; fileName: string }> {
    const query = typeof index === 'number' ? `?index=${index}` : '';
    const res = await apiClient.get<Blob>(
      `/owner/registration-documents/${docType}${query}`,
      {
        responseType: 'blob',
      },
    );
    const contentDisposition = (res.headers['content-disposition'] as string) || '';
    const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/);
    const fileName = filenameMatch ? filenameMatch[1] : `${docType}.dat`;

    return {
      blob: res.data,
      mimeType: (res.headers['content-type'] as string) || 'application/octet-stream',
      fileName,
    };
  },

  /**
   * Download an authenticated Owner registration document.
   */
  async downloadRegistrationDocument(
    docType: 'identityProof' | 'businessLicense' | 'propertyProof' | 'parkingImage',
    index?: number,
    suggestedFileName?: string,
  ): Promise<void> {
    const { blob, fileName } = await this.getRegistrationDocumentBlob(docType, index);
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = suggestedFileName || fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
  },

  /**
   * Get real-time dashboard statistics and slot metrics.
   */
  async getDashboardStats(parkingLotId?: string): Promise<OwnerDashboardStatsData> {
    const params: Record<string, string> = {};
    if (parkingLotId && parkingLotId !== 'all') {
      params.parkingLotId = parkingLotId;
    }
    const res = await apiClient.get<ApiResponse<OwnerDashboardStatsData>>('/owner/dashboard/stats', {
      params,
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to load dashboard statistics');
    }
    return res.data.data;
  },

  /**
   * Update permitted business and operational information for an owner's parking lot.
   */
  async updateParkingLotBusinessInfo(
    lotId: string,
    data: OwnerParkingLotBusinessUpdatePayload,
  ): Promise<OfficialParkingLot> {
    const res = await apiClient.patch<ApiResponse<OfficialParkingLot>>(
      `/owner/parking-lots/${lotId}`,
      data,
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update parking lot business information');
    }
    return res.data.data;
  },

  /**
   * Retrieves slots across one or all parking lots owned by the authenticated owner.
   */
  async getOwnerSlots(params?: OwnerSlotQueryParams): Promise<OwnerSlotsResponseData> {
    const res = await apiClient.get<ApiResponse<OwnerSlotsResponseData>>('/owner/slots', {
      params,
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to retrieve owner slots');
    }
    return res.data.data;
  },

  /**
   * Retrieves detailed information of a single slot owned by authenticated owner.
   */
  async getOwnerSlotById(slotId: string): Promise<OwnerSlotItem & { activeBooking?: unknown }> {
    const res = await apiClient.get<ApiResponse<OwnerSlotItem & { activeBooking?: unknown }>>(
      `/owner/slots/${slotId}`,
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to retrieve slot details');
    }
    return res.data.data;
  },

  /**
   * Updates the operational status of an owner's slot (Available <-> Under Maintenance / Blocked)
   */
  async updateSlotOperationalStatus(
    slotId: string,
    data: UpdateOwnerSlotStatusPayload,
  ): Promise<OwnerSlotItem> {
    const res = await apiClient.patch<ApiResponse<OwnerSlotItem>>(
      `/owner/slots/${slotId}/status`,
      data,
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update slot operational status');
    }
    return res.data.data;
  },

  /**
   * Retrieves paginated bookings scoped to the owner's parking facilities.
   */
  async getOwnerBookings(params?: OwnerBookingsQueryParams): Promise<OwnerBookingsResponseData> {
    const res = await apiClient.get<ApiResponse<OwnerBookingsResponseData>>('/owner/bookings', {
      params,
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to retrieve owner bookings');
    }
    return res.data.data;
  },

  /**
   * Retrieves detailed booking information including timeline and payment breakdown.
   */
  async getOwnerBookingById(bookingId: string): Promise<OwnerBookingDetailData> {
    const res = await apiClient.get<ApiResponse<OwnerBookingDetailData>>(
      `/owner/bookings/${bookingId}`,
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to retrieve booking details');
    }
    return res.data.data;
  },

  /**
   * Operational cancellation of a booking by the Parking Owner with mandatory reason.
   */
  async cancelOwnerBooking(
    bookingId: string,
    payload: { reason: string },
  ): Promise<OwnerBookingDetailData> {
    const res = await apiClient.patch<ApiResponse<OwnerBookingDetailData>>(
      `/owner/bookings/${bookingId}/cancel`,
      payload,
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to cancel booking');
    }
    return res.data.data;
  },

  /**
   * Operational extension of a Confirmed or Active booking by the Parking Owner.
   */
  async extendOwnerBooking(
    bookingId: string,
    payload: { newScheduledExitTime: string },
  ): Promise<OwnerBookingDetailData> {
    const res = await apiClient.post<ApiResponse<OwnerBookingDetailData>>(
      `/owner/bookings/${bookingId}/extend`,
      payload,
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to extend booking');
    }
    return res.data.data;
  },

  /**
   * Retrieves paginated security staff scoped to the owner's parking facilities.
   */
  async getOwnerStaff(params?: OwnerStaffQueryParams): Promise<OwnerStaffResponseData> {
    const res = await apiClient.get<ApiResponse<OwnerStaffResponseData>>('/owner/staff', {
      params,
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to retrieve staff directory');
    }
    return res.data.data;
  },

  /**
   * Retrieves full details, assignment history, and operational metrics for a staff member.
   */
  async getOwnerStaffById(staffId: string): Promise<OwnerStaffDetailData> {
    const res = await apiClient.get<ApiResponse<OwnerStaffDetailData>>(`/owner/staff/${staffId}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to retrieve staff details');
    }
    return res.data.data;
  },

  /**
   * Invites or adds a new Security Staff member under an owned parking facility.
   */
  async inviteOwnerStaff(payload: InviteOwnerStaffPayload): Promise<OwnerStaffItem> {
    const res = await apiClient.post<ApiResponse<OwnerStaffItem>>('/owner/staff/invite', payload);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to invite security staff');
    }
    return res.data.data;
  },

  /**
   * Assigns an existing security staff member to an additional owned facility.
   */
  async assignOwnerStaff(
    staffId: string,
    payload: AssignOwnerStaffPayload,
  ): Promise<OwnerStaffDetailData> {
    const res = await apiClient.post<ApiResponse<OwnerStaffDetailData>>(
      `/owner/staff/${staffId}/assign`,
      payload,
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to assign staff to facility');
    }
    return res.data.data;
  },

  /**
   * Updates account status (suspend/activate) or deactivates facility assignment.
   */
  async updateOwnerStaffStatus(
    staffId: string,
    payload: UpdateStaffStatusPayload,
  ): Promise<OwnerStaffDetailData> {
    const res = await apiClient.patch<ApiResponse<OwnerStaffDetailData>>(
      `/owner/staff/${staffId}/status`,
      payload,
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update staff status');
    }
    return res.data.data;
  },

  /**
   * Updates permitted staff information (name, mobile, employee ID).
   */
  async updateOwnerStaff(
    staffId: string,
    payload: UpdateStaffInfoPayload,
  ): Promise<OwnerStaffItem> {
    const res = await apiClient.put<ApiResponse<OwnerStaffItem>>(
      `/owner/staff/${staffId}`,
      payload,
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update staff details');
    }
    return res.data.data;
  },

  /**
   * Resends the email invitation with passwordless login instructions.
   */
  async resendStaffInvitation(staffId: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(
      `/owner/staff/${staffId}/resend-invitation`,
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to resend staff invitation');
    }
    return res.data.data;
  },
};

export const getOwnerDashboardStats = ownerApi.getDashboardStats.bind(ownerApi);
export const updateOwnerParkingLot = ownerApi.updateParkingLotBusinessInfo.bind(ownerApi);
export const getOwnerSlots = ownerApi.getOwnerSlots.bind(ownerApi);
export const getOwnerSlotById = ownerApi.getOwnerSlotById.bind(ownerApi);
export const updateOwnerSlotStatus = ownerApi.updateSlotOperationalStatus.bind(ownerApi);
export const getOwnerBookings = ownerApi.getOwnerBookings.bind(ownerApi);
export const getOwnerBookingById = ownerApi.getOwnerBookingById.bind(ownerApi);
export const cancelOwnerBooking = ownerApi.cancelOwnerBooking.bind(ownerApi);
export const extendOwnerBooking = ownerApi.extendOwnerBooking.bind(ownerApi);
export const getOwnerStaff = ownerApi.getOwnerStaff.bind(ownerApi);
export const getOwnerStaffById = ownerApi.getOwnerStaffById.bind(ownerApi);
export const inviteOwnerStaff = ownerApi.inviteOwnerStaff.bind(ownerApi);
export const assignOwnerStaff = ownerApi.assignOwnerStaff.bind(ownerApi);
export const updateOwnerStaffStatus = ownerApi.updateOwnerStaffStatus.bind(ownerApi);
export const updateOwnerStaff = ownerApi.updateOwnerStaff.bind(ownerApi);
export const resendStaffInvitation = ownerApi.resendStaffInvitation.bind(ownerApi);

export interface OwnerSlotQueryParams {
  parkingLotId?: string;
  floorId?: string;
  zoneId?: string;
  status?: string;
  slotType?: string;
  vehicleType?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface OwnerSlotItem {
  _id: string;
  slotNumber: string;
  slotLabel: string;
  slotType: string;
  supportedVehicleType: string;
  slotStatus: 'Available' | 'Reserved' | 'Occupied' | 'Under Maintenance';
  qrIdentifier: string;
  remarks: string | null;
  parkingLotId: {
    _id: string;
    parkingName: string;
    address?: unknown;
    city: string;
    state: string;
    postalCode?: string;
    parkingStatus: string;
  };
  floorId: {
    _id: string;
    floorName: string;
    floorNumber: number;
    floorStatus: string;
  };
  zoneId: {
    _id: string;
    zoneName: string;
    zoneCode: string;
    vehicleType?: string;
    zoneStatus: string;
  };
  currentBookingId?: {
    _id: string;
    bookingReference: string;
    bookingStatus: string;
    scheduledEntryTime: string;
    scheduledExitTime: string;
    actualEntryTime?: string | null;
    customerId?: {
      fullName: string;
      email: string;
      mobileNumber?: string;
    };
    vehicleId?: {
      vehicleNumber: string;
      vehicleType: string;
      vehicleBrand?: string;
      vehicleModel?: string;
    };
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerSlotsSummary {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
}

export interface OwnerSlotsResponseData {
  slots: OwnerSlotItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  summary: OwnerSlotsSummary;
}

export interface UpdateOwnerSlotStatusPayload {
  slotStatus: 'Available' | 'Under Maintenance';
  remarks?: string | null;
}

export interface OwnerDashboardRecentBooking {
  _id: string;
  bookingReference: string;
  bookingStatus: string;
  bookingType: string;
  scheduledEntryTime: string;
  scheduledExitTime: string;
  actualEntryTime: string | null;
  actualExitTime: string | null;
  totalAmount: number;
  createdAt: string;
  customer: {
    fullName: string;
    email: string;
    mobileNumber?: string;
  } | null;
  vehicle: {
    vehicleNumber: string;
    vehicleType: string;
  } | null;
  slot: {
    slotNumber: string;
    slotLabel: string;
  } | null;
  parkingLot: {
    _id: string;
    parkingName: string;
    city: string;
  } | null;
}

export interface OwnerParkingLotSummaryItem {
  _id: string;
  parkingName: string;
  city: string;
  state: string;
  parkingStatus: string;
  totalFloors: number;
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  occupancyPercentage: number;
  hourlyRate: number;
}

export interface OwnerDashboardStatsData {
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  occupancyPercentage: number;
  todayBookingsCount: number;
  todayRevenue: number;
  activeSecurityStaffCount: number;
  recentBookings: OwnerDashboardRecentBooking[];
  parkingLotsSummary: OwnerParkingLotSummaryItem[];
}

export interface OwnerParkingLotBusinessUpdatePayload {
  description?: string;
  contactNumber?: string;
  supportEmail?: string | null;
  openingTime?: string;
  closingTime?: string;
  isOpen24Hours?: boolean;
  hourlyRate?: number;
  gracePeriodMinutes?: number;
  amenities?: string[];
  parkingStatus?: 'Active' | 'Inactive' | 'Under Maintenance' | 'Temporarily Closed';
  parkingImages?: string[];
}

export interface OwnerDocumentItem {
  category: 'identityProof' | 'businessLicense' | 'propertyProof';
  label: string;
  url: string;
  fileName: string;
  documentType: 'PDF' | 'Image';
  uploadDate: string | null;
  verificationStatus: string;
  hasFile: boolean;
  governmentIdType?: string;
  maskedIdNumber?: string;
}

export interface OwnerPhotoItem {
  index: number;
  fileName: string;
  url: string;
  documentType: 'Image';
}

export interface OwnerRegistrationDocumentsData {
  hasApplication: boolean;
  applicationReference?: string;
  businessName?: string;
  businessType?: string;
  businessAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  parkingCapacity?: number;
  applicationStatus?: string;
  adminRemarks?: string | null;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  documents: OwnerDocumentItem[];
  photos: {
    category: 'parkingImage';
    label: string;
    uploadDate: string | null;
    verificationStatus: string;
    items: OwnerPhotoItem[];
    count: number;
  };
}

export interface OwnerBookingsQueryParams {
  parkingLotId?: string;
  status?: string;
  bookingType?: 'ONLINE' | 'WALK_IN' | 'ALL';
  paymentStatus?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface OwnerBookingItem {
  _id: string;
  bookingReference: string;
  bookingType: 'ONLINE' | 'WALK_IN';
  bookingStatus: string;
  createdBy: 'Customer' | 'Security Staff';
  scheduledEntryTime: string;
  scheduledExitTime: string;
  actualEntryTime?: string | null;
  actualExitTime?: string | null;
  bookingDurationMinutes: number;
  parkingRateAtBooking: number;
  baseAmount: number;
  additionalCharges: number;
  totalAmount: number;
  refundAmount: number;
  noShowDetected: boolean;
  overstayDetected: boolean;
  overstayDurationMinutes?: number;
  overstayCharge?: number;
  qrCode?: string;
  cancellationReason?: string | null;
  cancellationBy?: string | null;
  createdAt: string;
  customer: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber: string;
    avatarUrl?: string | null;
  } | null;
  vehicle: {
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    brand?: string;
    model?: string;
  } | null;
  parkingLot: {
    _id: string;
    parkingName: string;
    address?: unknown;
  } | null;
  floor: {
    _id: string;
    floorName: string;
    floorNumber: number;
  } | null;
  zone: {
    _id: string;
    zoneName: string;
    zoneCode: string;
    vehicleType?: string;
  } | null;
  slot: {
    _id: string;
    slotNumber: string;
    slotLabel: string;
    slotStatus: string;
  } | null;
  payment: {
    _id: string;
    paymentReference: string;
    paymentMethod: 'RAZORPAY' | 'CASH';
    paymentStatus: string;
    amount: number;
    paymentDate?: string | null;
    refundAmount?: number;
    refundStatus?: string;
  } | null;
}

export interface OwnerBookingsSummary {
  total: number;
  pendingPayment: number;
  confirmed: number;
  active: number;
  completed: number;
  cancelled: number;
  noShow: number;
  overstay: number;
  totalRevenue: number;
}

export interface OwnerBookingsResponseData {
  bookings: OwnerBookingItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  summary: OwnerBookingsSummary;
}

export interface OwnerBookingDetailData extends OwnerBookingItem {
  timeline: Array<{
    _id: string;
    eventCode: string;
    eventType: string;
    eventTitle: string;
    eventDescription?: string | null;
    eventSource: string;
    eventTime: string;
    performedBy?: {
      _id: string;
      fullName: string;
      role?: string;
    } | null;
    metadata?: Record<string, unknown>;
  }>;
  payments: Array<{
    _id: string;
    paymentReference: string;
    paymentType: string;
    paymentMethod: 'RAZORPAY' | 'CASH';
    paymentStatus: string;
    amount: number;
    transactionId?: string | null;
    gatewayOrderId?: string | null;
    gatewayPaymentId?: string | null;
    refundAmount?: number;
    refundDate?: string | null;
    refunds?: Array<{
      refundReference: string;
      refundAmount: number;
      refundStatus: string;
      refundReason: string;
      initiatedAt: string;
      completedAt?: string | null;
      remarks?: string | null;
    }>;
    createdAt: string;
  }>;
  canCancel: boolean;
  canExtend: boolean;
  canDownloadReceipt: boolean;
}

export interface OwnerStaffSummary {
  totalStaff: number;
  activeStaff: number;
  suspendedStaff: number;
  pendingInvitations: number;
  recentlyAdded: number;
}

export interface OwnerStaffItem {
  _id: string;
  employeeId?: string | null;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: string;
  accountStatus: 'Active' | 'Suspended' | 'Pending Verification' | 'Deactivated' | 'Deleted';
  invitationStatus: 'Pending' | 'Sent' | 'Accepted';
  invitationSentAt?: string | null;
  lastLogin?: string | null;
  createdAt: string;
  assignedParkingLot?: {
    _id: string;
    lotName: string;
    city?: string;
  } | null;
  activeAssignments: Array<{
    _id: string;
    parkingLotId: string;
    lotName: string;
    physicalAddress?: string;
    assignedAt: string;
    employeeId?: string | null;
    assignmentReason?: string | null;
  }>;
}

export interface OwnerStaffResponseData {
  staff: OwnerStaffItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: OwnerStaffSummary;
}

export interface OwnerStaffDetailData {
  staff: OwnerStaffItem;
  assignmentHistory: Array<{
    _id: string;
    parkingLotId: string;
    lotName: string;
    assignmentStatus: 'Active' | 'Inactive';
    assignedAt: string;
    assignedBy?: { _id: string; fullName: string; email: string } | null;
    unassignedAt?: string | null;
    unassignedBy?: { _id: string; fullName: string; email: string } | null;
    assignmentReason?: string | null;
    employeeId?: string | null;
  }>;
  operationalStats: {
    totalCheckIns: number;
    totalCheckOuts: number;
  };
}

export interface InviteOwnerStaffPayload {
  fullName: string;
  email: string;
  mobileNumber: string;
  parkingLotId: string;
  employeeId?: string;
  assignmentReason?: string;
}

export interface AssignOwnerStaffPayload {
  parkingLotId: string;
  employeeId?: string;
  assignmentReason?: string;
}

export interface UpdateStaffStatusPayload {
  accountStatus?: 'Active' | 'Suspended';
  assignmentStatus?: 'Active' | 'Inactive';
  parkingLotId?: string;
  reason?: string;
}

export interface UpdateStaffInfoPayload {
  fullName?: string;
  mobileNumber?: string;
  employeeId?: string;
}

export interface OwnerStaffQueryParams {
  parkingLotId?: string;
  accountStatus?: string;
  assignmentStatus?: string;
  search?: string;
  page?: number;
  limit?: number;
}
