import type { User, Vehicle } from './auth';

export interface OwnerBusinessDetails {
  applicationReference?: string;
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
  applicationStatus: string;
  adminRemarks?: string | null;
  submittedAt?: string | null;
}

export interface SecurityAssignmentDetails {
  assignmentStatus: 'Active' | 'Inactive';
  assignedAt: string;
  parkingLot?: {
    _id: string;
    lotName: string;
    physicalAddress: string;
    city: string;
    state: string;
    postalCode: string;
    contactPhone?: string;
  } | null;
  assignmentReason?: string | null;
}

export interface ProfileData {
  user: User;
  roleType: 'CUSTOMER' | 'OWNER' | 'SECURITY_STAFF' | 'ADMIN';
  // Customer specific
  vehicles?: Vehicle[];
  totalBookings?: number;
  // Owner specific
  business?: OwnerBusinessDetails | null;
  // Security staff specific
  assignment?: SecurityAssignmentDetails | null;
  // Admin specific
  adminId?: string;
  isSystemAdmin?: boolean;
}

export interface UpdatePersonalInfoPayload {
  fullName?: string;
  profileImage?: string | null;
  dateOfBirth?: string | null;
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer Not To Say';
  preferredLanguage?: 'English' | 'Hindi' | 'Gujarati';
  timezone?: string;
  // Owner business fields
  businessName?: string;
  businessDescription?: string;
  businessAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  businessEmail?: string;
  businessPhone?: string;
}

export interface RequestEmailChangePayload {
  newEmail: string;
}

export interface RequestEmailChangeResponse {
  message: string;
  cooldownSeconds: number;
  targetEmailMasked: string;
}

export interface VerifyEmailChangePayload {
  newEmail: string;
  otp: string;
}

export interface RequestMobileChangePayload {
  newMobileNumber: string;
}

export interface RequestMobileChangeResponse {
  message: string;
  cooldownSeconds: number;
  targetEmailMasked: string;
}

export interface VerifyMobileChangePayload {
  newMobileNumber: string;
  otp: string;
}

