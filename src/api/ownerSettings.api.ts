import { apiClient } from './client';

export interface OwnerBusinessSettingsFacility {
  _id: string;
  parkingName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  contactNumber: string;
  supportEmail: string | null;
  openingTime: string;
  closingTime: string;
  isOpen24Hours: boolean;
  operatingDays: string[];
  hourlyRate: number;
  gracePeriodMinutes: number;
  exitGracePeriodMinutes: number;
  maxBookingDurationHours: number;
  allowOnlineBookings: boolean;
  allowWalkInBookings: boolean;
  overstayGracePeriodMinutes: number;
  overstayChargeMultiplier: number;
  timezone: string;
  currency: string;
  parkingStatus: string;
  isVerified: boolean;
}

export interface OwnerBusinessSettingsResponse {
  facilities: OwnerBusinessSettingsFacility[];
  selectedFacility: OwnerBusinessSettingsFacility | null;
  businessProfile: {
    ownerName: string;
    email: string;
    mobileNumber: string;
    timezone: string;
  };
  platformGovernance: {
    refundPolicyDescription: string;
    noShowThresholdPercentage: number;
    noShowRefundPercentage: number;
    platformBookingFee: number;
    taxRatePercentage: number;
    defaultCurrency: string;
  };
}

export interface UpdateOwnerBusinessSettingsInput {
  contactNumber?: string;
  supportEmail?: string | null;
  isOpen24Hours?: boolean;
  openingTime?: string;
  closingTime?: string;
  operatingDays?: string[];
  gracePeriodMinutes?: number;
  exitGracePeriodMinutes?: number;
  maxBookingDurationHours?: number;
  allowOnlineBookings?: boolean;
  allowWalkInBookings?: boolean;
  overstayGracePeriodMinutes?: number;
  overstayChargeMultiplier?: number;
  hourlyRate?: number;
}

export async function getOwnerBusinessSettings(
  parkingLotId?: string,
): Promise<OwnerBusinessSettingsResponse> {
  const response = await apiClient.get<{ success: boolean; data: OwnerBusinessSettingsResponse }>(
    '/owner/settings',
    { params: { parkingLotId } },
  );
  return response.data.data;
}

export async function updateOwnerBusinessSettings(
  parkingLotId: string,
  payload: UpdateOwnerBusinessSettingsInput,
): Promise<OwnerBusinessSettingsFacility> {
  const response = await apiClient.put<{
    success: boolean;
    message: string;
    data: OwnerBusinessSettingsFacility;
  }>(`/owner/settings/${parkingLotId}`, payload);
  return response.data.data;
}
