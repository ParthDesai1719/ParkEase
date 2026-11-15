import { apiClient } from './client';
import type { ApiResponse } from '../types/auth';

export interface SubmitContactMessagePayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface SubmitContactMessageResult {
  recipient: string;
  sender: string;
  subject: string;
}

export const contactApi = {
  /**
   * Submit a contact inquiry.
   * Dispatches an email from the sender to parkease@gmail.com in Mailpit.
   */
  async sendMessage(
    payload: SubmitContactMessagePayload,
  ): Promise<ApiResponse<SubmitContactMessageResult>> {
    const response = await apiClient.post<ApiResponse<SubmitContactMessageResult>>(
      '/contact',
      payload,
    );
    return response.data;
  },
};
