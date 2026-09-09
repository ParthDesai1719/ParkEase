import { z } from 'zod';

export const INDIAN_MOBILE_REGEX = /^\+91\d{10}$/;
export const TEN_DIGIT_MOBILE_REGEX = /^\d{10}$/;
export const INDIAN_VEHICLE_NUMBER_REGEX = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/;
export const SIX_DIGIT_OTP_REGEX = /^\d{6}$/;
export const VEHICLE_TYPES = ['Bike', 'Car', 'SUV', 'EV'] as const;

/**
 * Login with Email Schema
 */
export const emailLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email address is required.')
    .email('Please provide a valid email address.'),
});

export type EmailLoginFormValues = z.infer<typeof emailLoginSchema>;

/**
 * Login with Mobile Number Schema (Form input with fixed +91 prefix)
 */
export const mobileLoginFormSchema = z.object({
  mobileDigits: z
    .string()
    .trim()
    .regex(TEN_DIGIT_MOBILE_REGEX, 'Mobile number must contain exactly 10 digits.'),
});

export type MobileLoginFormValues = z.infer<typeof mobileLoginFormSchema>;

/**
 * Normalized Login Payload Schemas (for API client validation)
 */
export const requestLoginOtpApiSchema = z
  .object({
    method: z.enum(['email', 'mobile']),
    email: z.string().trim().toLowerCase().email().optional(),
    mobileNumber: z.string().trim().regex(INDIAN_MOBILE_REGEX).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.method === 'email' && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email address is required for email login.',
        path: ['email'],
      });
    }
    if (data.method === 'mobile' && !data.mobileNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Mobile number is required for mobile login.',
        path: ['mobileNumber'],
      });
    }
  });

/**
 * Login OTP Verification Schema
 */
export const loginOtpSchema = z.object({
  otp: z.string().trim().regex(SIX_DIGIT_OTP_REGEX, 'Verification code must be exactly 6 digits.'),
});

export type LoginOtpFormValues = z.infer<typeof loginOtpSchema>;

/**
 * Customer Registration Form Schema
 * Collects Full Name, Email, 10-digit Mobile, Vehicle Number, Vehicle Type, and Terms.
 */
export const customerRegistrationFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'Full name must be at least 3 characters.')
    .max(100, 'Full name cannot exceed 100 characters.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email address is required.')
    .email('Please provide a valid email address.'),
  mobileDigits: z
    .string()
    .trim()
    .regex(TEN_DIGIT_MOBILE_REGEX, 'Mobile number must contain exactly 10 digits.'),
  vehicleNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      INDIAN_VEHICLE_NUMBER_REGEX,
      'Vehicle number must follow the standard Indian registration format (e.g. GJ01AB1234).',
    ),
  vehicleType: z.enum(VEHICLE_TYPES, {
    message: 'Vehicle type must be one of: Bike, Car, SUV, EV.',
  }),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'Terms & Conditions must be accepted.',
  }),
});

export type CustomerRegistrationFormValues = z.infer<typeof customerRegistrationFormSchema>;

/**
 * Dual OTP Verification Schemas for Customer Registration
 */
export const registrationEmailOtpSchema = z.object({
  emailOtp: z.string().trim().regex(SIX_DIGIT_OTP_REGEX, 'Email OTP must be exactly 6 digits.'),
});

export type RegistrationEmailOtpValues = z.infer<typeof registrationEmailOtpSchema>;

export const registrationMobileOtpSchema = z.object({
  mobileOtp: z.string().trim().regex(SIX_DIGIT_OTP_REGEX, 'Mobile OTP must be exactly 6 digits.'),
});

export type RegistrationMobileOtpValues = z.infer<typeof registrationMobileOtpSchema>;

export const registrationDualOtpSchema = z.object({
  emailOtp: z.string().trim().regex(SIX_DIGIT_OTP_REGEX, 'Email OTP must be exactly 6 digits.'),
  mobileOtp: z.string().trim().regex(SIX_DIGIT_OTP_REGEX, 'Mobile OTP must be exactly 6 digits.'),
});

export type RegistrationDualOtpValues = z.infer<typeof registrationDualOtpSchema>;
