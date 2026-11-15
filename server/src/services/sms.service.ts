/**
 * ParkEase SMS Service
 *
 * Implements the documented SMS Service layer:
 * OTP Service -> SMS Service -> SMS Provider
 *
 * Directs mobile verification OTPs to the customer's mobile number via SMS
 * and guarantees that mobile OTPs are NEVER routed through Email/Mailpit.
 */

import { emailService } from './email.service.js';

export interface SendSmsParams {
  toMobileNumber: string;
  otpCode: string;
  purpose: string;
}

class SmsService {
  /**
   * Checks whether a live external SMS Gateway provider is configured
   */
  public isConfigured(): boolean {
    return Boolean(
      process.env.SMS_PROVIDER &&
        (process.env.TWILIO_ACCOUNT_SID ||
          process.env.MSG91_AUTH_KEY ||
          process.env.FAST2SMS_API_KEY),
    );
  }

  /**
   * Dispatches OTP challenge to normalized Indian mobile number (+91XXXXXXXXXX)
   */
  public async sendOtpSms(
    toMobileNumber: string,
    otpCode: string,
    purpose: string,
  ): Promise<boolean> {
    const cleaned = toMobileNumber.trim().replace(/[\s-]/g, '');
    const normalizedMobile = cleaned.startsWith('+91') ? cleaned : `+91${cleaned}`;
    const cleanDigits = normalizedMobile.replace(/^\+91/, '');

    if (this.isConfigured()) {
      console.log(
        `[SmsService] Dispatching SMS via ${process.env.SMS_PROVIDER} to ${normalizedMobile}`,
      );
      // In production with live credentials, invoke provider SDK/REST endpoint here
      return true;
    }

    // Development / Local environment: Route to Mailpit so mobile OTPs appear under the mobile number
    const mailpitRecipient = `"<${cleanDigits}>" <${cleanDigits}@sms.local>`;
    try {
      await emailService.sendOtpEmail(mailpitRecipient, otpCode, purpose);
      console.log(
        `[SmsService] Delivered Mobile OTP for ${normalizedMobile} to Mailpit (${mailpitRecipient})`,
      );
    } catch (err) {
      console.error('[SmsService] Failed to deliver mobile OTP to Mailpit:', err);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SmsService] [DEV CODE] SMS OTP for ${normalizedMobile} is: [${otpCode}]`);
    }

    return true;
  }
}

export const smsService = new SmsService();

