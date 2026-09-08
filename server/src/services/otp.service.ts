import crypto from 'node:crypto';
import type mongoose from 'mongoose';
import { AUTH_CONSTANTS } from '../config/constants.js';
import { OtpVerificationModel, type OtpVerification } from '../models/OtpVerification.js';
import { AppError } from '../utils/AppError.js';
import { emailService } from './email.service.js';

export type VerificationType =
  | 'REGISTRATION_EMAIL'
  | 'REGISTRATION_MOBILE'
  | 'LOGIN'
  | 'FORGOT_PASSWORD'
  | 'CHANGE_EMAIL'
  | 'CHANGE_MOBILE'
  | 'ACCOUNT_RECOVERY';

export type DeliveryMethod = 'Email' | 'SMS';

export interface CreateOtpParams {
  userId?: mongoose.Types.ObjectId | null | undefined;
  email?: string | null | undefined;
  mobileNumber?: string | null | undefined;
  verificationType: VerificationType;
  deliveryMethod?: DeliveryMethod | undefined;
  purposeLabel?: string | undefined;
}

export interface VerifyOtpParams {
  email?: string | null | undefined;
  mobileNumber?: string | null | undefined;
  verificationType: VerificationType;
  otp: string;
}

type OtpDoc = mongoose.HydratedDocument<OtpVerification>;
type OtpModelType = mongoose.Model<
  OtpVerification,
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  OtpDoc
>;

interface OtpRecipientFilter {
  verificationType: VerificationType;
  verificationStatus: 'Pending';
  email?: string;
  mobileNumber?: string;
}

class OtpService {
  private hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  private generate6DigitCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  public async requestOtp(
    params: CreateOtpParams,
  ): Promise<{ message: string; cooldownSeconds: number }> {
    const normalizedEmail = params.email ? params.email.trim().toLowerCase() : null;
    const normalizedMobile = params.mobileNumber ? params.mobileNumber.trim() : null;

    if (!normalizedEmail && !normalizedMobile) {
      throw new AppError('Email or mobile number is required to request an OTP.', 400, 'E001');
    }

    const deliveryMethod: DeliveryMethod = params.deliveryMethod || 'Email';

    const filter: OtpRecipientFilter = {
      verificationType: params.verificationType,
      verificationStatus: 'Pending',
    };
    if (normalizedEmail) filter.email = normalizedEmail;
    if (normalizedMobile) filter.mobileNumber = normalizedMobile;

    // Check for existing pending OTP for cooldown
    const model = OtpVerificationModel as unknown as OtpModelType;
    const existingOtp = await model.findOne(filter).sort({ createdAt: -1 }).exec();

    if (existingOtp) {
      const secondsSinceLastSent = (Date.now() - existingOtp.lastSentAt.getTime()) / 1000;
      if (secondsSinceLastSent < AUTH_CONSTANTS.OTP_RESEND_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(
          AUTH_CONSTANTS.OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastSent,
        );
        throw new AppError(
          `Please wait ${remaining} seconds before requesting a new OTP.`,
          429,
          'E030',
        );
      }

      // Invalidate previous active OTPs for the same recipient and purpose
      await model.updateMany(filter, {
        $set: { verificationStatus: 'Cancelled' },
      });
    }

    const otpCode = this.generate6DigitCode();
    const otpHash = this.hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + AUTH_CONSTANTS.OTP_EXPIRY_MINUTES * 60 * 1000);

    await model.create({
      userId: params.userId ?? null,
      email: normalizedEmail,
      mobileNumber: normalizedMobile,
      verificationType: params.verificationType,
      deliveryMethod,
      otpCodeHash: otpHash,
      expiresAt,
      verifiedAt: null,
      consumedAt: null,
      attemptCount: 0,
      maxAttempts: AUTH_CONSTANTS.OTP_MAX_ATTEMPTS,
      resendCount: existingOtp ? existingOtp.resendCount + 1 : 0,
      lastSentAt: new Date(),
      verificationStatus: 'Pending',
    });

    // In V1, both Email and Mobile OTPs are delivered to the registered email
    const deliveryEmail = normalizedEmail;
    if (deliveryEmail) {
      const purpose = params.purposeLabel || params.verificationType.replace(/_/g, ' ');
      await emailService.sendOtpEmail(deliveryEmail, otpCode, purpose);
    }

    return {
      message: 'Verification code sent successfully.',
      cooldownSeconds: AUTH_CONSTANTS.OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  public async verifyOtp(
    params: VerifyOtpParams,
  ): Promise<mongoose.HydratedDocument<OtpVerification>> {
    const normalizedEmail = params.email ? params.email.trim().toLowerCase() : null;
    const normalizedMobile = params.mobileNumber ? params.mobileNumber.trim() : null;

    const filter: OtpRecipientFilter = {
      verificationType: params.verificationType,
      verificationStatus: 'Pending',
    };
    if (normalizedEmail) filter.email = normalizedEmail;
    if (normalizedMobile) filter.mobileNumber = normalizedMobile;

    const model = OtpVerificationModel as unknown as OtpModelType;
    const otpRecord = await model.findOne(filter).sort({ createdAt: -1 }).exec();

    if (!otpRecord) {
      throw new AppError(
        'No pending OTP found. Please request a new verification code.',
        400,
        'E003',
      );
    }

    // Check expiration
    if (otpRecord.expiresAt.getTime() <= Date.now()) {
      otpRecord.verificationStatus = 'Expired';
      await otpRecord.save();
      throw new AppError('Verification code has expired. Please request a new one.', 401, 'E004');
    }

    // Check maximum attempts
    if (otpRecord.attemptCount >= otpRecord.maxAttempts) {
      otpRecord.verificationStatus = 'Failed';
      await otpRecord.save();
      throw new AppError(
        'Maximum verification attempts exceeded. Please request a new code.',
        401,
        'E005',
      );
    }

    // Hash user input and compare
    const inputHash = this.hashOtp(params.otp);
    if (inputHash !== otpRecord.otpCodeHash) {
      otpRecord.attemptCount += 1;
      if (otpRecord.attemptCount >= otpRecord.maxAttempts) {
        otpRecord.verificationStatus = 'Failed';
      }
      await otpRecord.save();

      if (otpRecord.attemptCount >= otpRecord.maxAttempts) {
        throw new AppError(
          'Maximum verification attempts exceeded. Please request a new code.',
          401,
          'E005',
        );
      }

      throw new AppError(
        `Invalid verification code. ${otpRecord.maxAttempts - otpRecord.attemptCount} attempt(s) remaining.`,
        401,
        'E003',
      );
    }

    // Code verified successfully
    otpRecord.verificationStatus = 'Verified';
    otpRecord.verifiedAt = new Date();
    await otpRecord.save();

    return otpRecord;
  }

  public async consumeOtp(otpRecordId: mongoose.Types.ObjectId): Promise<void> {
    const model = OtpVerificationModel as unknown as OtpModelType;
    await model.updateOne({ _id: otpRecordId }, { $set: { consumedAt: new Date() } });
  }
}

export const otpService = new OtpService();
