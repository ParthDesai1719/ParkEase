import { z } from 'zod';

const mobileRegex = /^\+91\d{10}$/;
const vehicleNumberRegex = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/;
const otpRegex = /^\d{6}$/;

export const requestLoginOtpSchema = z
  .object({
    method: z.enum(['email', 'mobile']),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please provide a valid email address.')
      .optional(),
    mobileNumber: z
      .string()
      .trim()
      .regex(
        mobileRegex,
        'Please provide a valid Indian mobile number starting with +91 followed by 10 digits.',
      )
      .optional(),
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

export const verifyLoginOtpSchema = z
  .object({
    method: z.enum(['email', 'mobile']),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please provide a valid email address.')
      .optional(),
    mobileNumber: z
      .string()
      .trim()
      .regex(
        mobileRegex,
        'Please provide a valid Indian mobile number starting with +91 followed by 10 digits.',
      )
      .optional(),
    otp: z.string().trim().regex(otpRegex, 'OTP must be exactly 6 digits.'),
  })
  .superRefine((data, ctx) => {
    if (data.method === 'email' && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email address is required for email login verification.',
        path: ['email'],
      });
    }
    if (data.method === 'mobile' && !data.mobileNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Mobile number is required for mobile login verification.',
        path: ['mobileNumber'],
      });
    }
  });

export const requestRegisterOtpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'Full name must be at least 3 characters.')
    .max(100, 'Full name cannot exceed 100 characters.'),
  email: z.string().trim().toLowerCase().email('Please provide a valid email address.'),
  mobileNumber: z
    .string()
    .trim()
    .regex(
      mobileRegex,
      'Please provide a valid Indian mobile number starting with +91 followed by 10 digits.',
    ),
  vehicleNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      vehicleNumberRegex,
      'Vehicle number must follow the standard Indian vehicle registration format (e.g. GJ01AB1234).',
    ),
  vehicleType: z.enum(['Bike', 'Car', 'SUV', 'EV'], {
    message: 'Vehicle type must be one of: Bike, Car, SUV, EV.',
  }),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'Terms & Conditions must be accepted.',
  }),
});

export const verifyRegisterOtpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'Full name must be at least 3 characters.')
    .max(100, 'Full name cannot exceed 100 characters.'),
  email: z.string().trim().toLowerCase().email('Please provide a valid email address.'),
  mobileNumber: z
    .string()
    .trim()
    .regex(
      mobileRegex,
      'Please provide a valid Indian mobile number starting with +91 followed by 10 digits.',
    ),
  vehicleNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      vehicleNumberRegex,
      'Vehicle number must follow the standard Indian vehicle registration format (e.g. GJ01AB1234).',
    ),
  vehicleType: z.enum(['Bike', 'Car', 'SUV', 'EV'], {
    message: 'Vehicle type must be one of: Bike, Car, SUV, EV.',
  }),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'Terms & Conditions must be accepted.',
  }),
  emailOtp: z.string().trim().regex(otpRegex, 'Email OTP must be exactly 6 digits.'),
  mobileOtp: z.string().trim().regex(otpRegex, 'Mobile OTP must be exactly 6 digits.'),
});

export const resendOtpSchema = z.object({
  identifier: z.string().trim().min(1, 'Identifier (email or mobile number) is required.'),
  type: z.enum(['LOGIN', 'REGISTRATION_EMAIL', 'REGISTRATION_MOBILE']),
  deliveryMethod: z.enum(['Email', 'SMS']).default('Email'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().optional(),
});
