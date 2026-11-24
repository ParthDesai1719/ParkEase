import { apiClient } from './client';

export interface SystemSettingsData {
  _id?: string;
  applicationName: string;
  platformLogoUrl?: string;
  timezone: string;
  defaultCurrency: string;

  // Booking Rules
  bookingGracePeriodMinutes: number;
  minimumBookingDurationHours: number;
  maximumBookingDurationHours: number;
  allowOnlineBookings: boolean;
  allowWalkInBookings: boolean;
  allowBookingExtensions: boolean;
  bookingAdvanceLimitDays: number;

  // Owner Onboarding
  ownerRegistrationFee: number;
  ownerRegistrationEnabled: boolean;
  ownerReviewSlaDays: number;
  refundPolicyDescription?: string;
  refundPolicyEnabled?: boolean;

  // Financial & Platform Fee
  taxRatePercentage: number;
  platformBookingFee: number;

  // Maintenance & System
  maintenanceMode: boolean;
  sessionTimeoutMinutes?: number;
  noShowThresholdPercentage?: number;
  noShowRefundPercentage?: number;

  lastModifiedBy?: string | null;
  updatedAt?: string;
}

export const settingsApi = {
  getSettings: async (): Promise<SystemSettingsData> => {
    const res = await apiClient.get<{ success: boolean; data: SystemSettingsData }>('/admin/settings');
    return res.data.data;
  },

  updateSettings: async (payload: Partial<SystemSettingsData>): Promise<SystemSettingsData> => {
    const res = await apiClient.put<{ success: boolean; message: string; data: SystemSettingsData }>(
      '/admin/settings',
      payload
    );
    return res.data.data;
  },

  uploadLogo: async (file: File): Promise<{ logoUrl: string; settings: SystemSettingsData }> => {
    const formData = new FormData();
    formData.append('logo', file);
    const res = await apiClient.post<{
      success: boolean;
      message: string;
      data: { logoUrl: string; settings: SystemSettingsData };
    }>('/admin/settings/logo', formData, {
      headers: {
        'Content-Type': undefined,
      },
    });
    return res.data.data;
  },
};

/**
 * Resolves a logo URL into a fully-qualified or browser-accessible image URL.
 */
export function getLogoUrl(logoPath?: string | null): string | undefined {
  if (!logoPath) return undefined;
  const trimmed = logoPath.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const rawBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
  const serverOrigin = rawBase.replace(/\/api\/v1\/?$/, '');

  if (trimmed.startsWith('/')) {
    return `${serverOrigin}${trimmed}`;
  }

  return `${serverOrigin}/${trimmed}`;
}
