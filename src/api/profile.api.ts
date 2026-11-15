import { apiClient } from './client';
import type { ApiResponse } from '../types/auth';
import type {
  ProfileData,
  UpdatePersonalInfoPayload,
  RequestEmailChangePayload,
  RequestEmailChangeResponse,
  VerifyEmailChangePayload,
  RequestMobileChangePayload,
  RequestMobileChangeResponse,
  VerifyMobileChangePayload,
} from '../types/profile';

export const profileApi = {
  /**
   * Fetch authenticated user's complete profile with role-specific context
   */
  async getProfile(): Promise<ApiResponse<ProfileData>> {
    const response = await apiClient.get<ApiResponse<ProfileData>>('/profile');
    return response.data;
  },

  /**
   * Update permitted personal information
   */
  async updatePersonalInfo(payload: UpdatePersonalInfoPayload): Promise<ApiResponse<ProfileData>> {
    const response = await apiClient.patch<ApiResponse<ProfileData>>('/profile/personal-info', payload);
    return response.data;
  },

  /**
   * Upload and apply avatar photo
   */
  async uploadAvatar(file: File): Promise<ApiResponse<ProfileData & { avatarUrl: string }>> {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await apiClient.post<ApiResponse<ProfileData & { avatarUrl: string }>>(
      '/profile/avatar',
      formData,
      {
        headers: {
          'Content-Type': undefined,
        },
      },
    );
    return response.data;
  },

  /**
   * Request OTP to initiate email address change
   */
  async requestEmailChangeOtp(
    payload: RequestEmailChangePayload,
  ): Promise<ApiResponse<RequestEmailChangeResponse>> {
    const response = await apiClient.post<ApiResponse<RequestEmailChangeResponse>>(
      '/profile/email/request-otp',
      payload,
    );
    return response.data;
  },

  /**
   * Verify OTP and finalize email address update
   */
  async verifyEmailChangeOtp(
    payload: VerifyEmailChangePayload,
  ): Promise<ApiResponse<ProfileData>> {
    const response = await apiClient.post<ApiResponse<ProfileData>>(
      '/profile/email/verify-otp',
      payload,
    );
    return response.data;
  },

  /**
   * Request OTP to initiate mobile number change
   */
  async requestMobileChangeOtp(
    payload: RequestMobileChangePayload,
  ): Promise<ApiResponse<RequestMobileChangeResponse>> {
    const response = await apiClient.post<ApiResponse<RequestMobileChangeResponse>>(
      '/profile/mobile/request-otp',
      payload,
    );
    return response.data;
  },

  /**
   * Verify OTP and finalize mobile number update
   */
  async verifyMobileChangeOtp(
    payload: VerifyMobileChangePayload,
  ): Promise<ApiResponse<ProfileData>> {
    const response = await apiClient.post<ApiResponse<ProfileData>>(
      '/profile/mobile/verify-otp',
      payload,
    );
    return response.data;
  },
};

/**
 * Resolves an avatar URL into a fully-qualified or browser-accessible image URL.
 */
export function getAvatarUrl(imagePath?: string | null): string | undefined {
  if (!imagePath) return undefined;
  const trimmed = imagePath.trim();
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

