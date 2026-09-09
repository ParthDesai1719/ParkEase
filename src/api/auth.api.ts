import { apiClient } from './client';
import type {
  ApiResponse,
  GetMeResponse,
  LogoutPayload,
  RefreshTokenPayload,
  RefreshTokenResponse,
  RequestLoginOtpPayload,
  RequestLoginOtpResponse,
  RequestRegisterOtpPayload,
  RequestRegisterOtpResponse,
  ResendOtpPayload,
  ResendOtpResponse,
  VerifyLoginOtpPayload,
  VerifyLoginOtpResponse,
  VerifyRegisterOtpPayload,
  VerifyRegisterOtpResponse,
} from '../types/auth';

/**
 * Request an OTP for passwordless login via Email or Mobile Number.
 * POST /api/v1/auth/login/request-otp
 */
export async function requestLoginOtp(
  data: RequestLoginOtpPayload,
): Promise<ApiResponse<RequestLoginOtpResponse>> {
  const response = await apiClient.post<ApiResponse<RequestLoginOtpResponse>>(
    '/auth/login/request-otp',
    data,
  );
  return response.data;
}

/**
 * Verify a 6-digit OTP to complete login and establish a session.
 * POST /api/v1/auth/login/verify-otp
 */
export async function verifyLoginOtp(
  data: VerifyLoginOtpPayload,
): Promise<ApiResponse<VerifyLoginOtpResponse>> {
  const response = await apiClient.post<ApiResponse<VerifyLoginOtpResponse>>(
    '/auth/login/verify-otp',
    data,
  );
  return response.data;
}

/**
 * Submit customer registration details and trigger dual OTP generation.
 * POST /api/v1/auth/register/request-otp
 */
export async function requestRegisterOtp(
  data: RequestRegisterOtpPayload,
): Promise<ApiResponse<RequestRegisterOtpResponse>> {
  const response = await apiClient.post<ApiResponse<RequestRegisterOtpResponse>>(
    '/auth/register/request-otp',
    data,
  );
  return response.data;
}

/**
 * Verify both Email OTP and Mobile OTP to finalize customer account and vehicle registration.
 * POST /api/v1/auth/register/verify-otp
 */
export async function verifyRegisterOtp(
  data: VerifyRegisterOtpPayload,
): Promise<ApiResponse<VerifyRegisterOtpResponse>> {
  const response = await apiClient.post<ApiResponse<VerifyRegisterOtpResponse>>(
    '/auth/register/verify-otp',
    data,
  );
  return response.data;
}

/**
 * Request resending of an unexpired or expired OTP subject to cooldown rules.
 * POST /api/v1/auth/otp/resend
 */
export async function resendOtp(data: ResendOtpPayload): Promise<ApiResponse<ResendOtpResponse>> {
  const response = await apiClient.post<ApiResponse<ResendOtpResponse>>('/auth/otp/resend', data);
  return response.data;
}

/**
 * Refresh short-lived access JWT using the rotating HttpOnly refresh token.
 * POST /api/v1/auth/refresh-token
 */
export async function refreshToken(
  data?: RefreshTokenPayload,
): Promise<ApiResponse<RefreshTokenResponse>> {
  const response = await apiClient.post<ApiResponse<RefreshTokenResponse>>(
    '/auth/refresh-token',
    data ?? {},
  );
  return response.data;
}

/**
 * Terminate the current session, revoking the active refresh token and clearing auth cookies.
 * POST /api/v1/auth/logout
 */
export async function logout(data?: LogoutPayload): Promise<ApiResponse<void>> {
  const response = await apiClient.post<ApiResponse<void>>('/auth/logout', data ?? {});
  return response.data;
}

/**
 * Fetch the authenticated user's profile and active vehicles.
 * GET /api/v1/auth/me
 */
export async function getMe(): Promise<ApiResponse<GetMeResponse>> {
  const response = await apiClient.get<ApiResponse<GetMeResponse>>('/auth/me');
  return response.data;
}
