import { z } from 'zod';

const mobileRegex = /^\+91\d{10}$/;
const pinCodeRegex = /^[1-9][0-9]{5}$/;
const otpRegex = /^\d{6}$/;

const genderTuple = ['Male', 'Female', 'Other', 'Prefer Not To Say'] as const;
const languageTuple = ['English', 'Hindi', 'Gujarati'] as const;

export const updatePersonalInfoSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, 'Full name must be at least 3 characters.')
    .max(100, 'Full name must not exceed 100 characters.')
    .optional(),
  profileImage: z.string().trim().nullable().optional(),
  dateOfBirth: z
    .string()
    .nullable()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const d = new Date(val);
      return !isNaN(d.getTime());
    }, 'Invalid date of birth format.'),
  gender: z.enum(genderTuple).optional(),
  preferredLanguage: z.enum(languageTuple).optional(),
  timezone: z.string().trim().optional(),
  // Permitted business info updates for Parking Owners
  businessName: z.string().trim().min(2).max(150).optional(),
  businessDescription: z.string().trim().max(1000).optional(),
  businessAddress: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postalCode: z
    .string()
    .trim()
    .regex(pinCodeRegex, 'Postal code must be a valid 6-digit Indian PIN code.')
    .optional(),
  businessEmail: z.string().trim().email('Invalid business email format.').optional(),
  businessPhone: z
    .string()
    .trim()
    .regex(mobileRegex, 'Business phone must be in +91XXXXXXXXXX format.')
    .optional(),
});

export const requestEmailChangeSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address.'),
});

export const verifyEmailChangeSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address.'),
  otp: z
    .string()
    .trim()
    .length(6, 'Verification code must be exactly 6 digits.')
    .regex(otpRegex, 'Verification code must contain digits only.'),
});

export const requestMobileChangeSchema = z.object({
  newMobileNumber: z
    .string()
    .trim()
    .transform((val) => {
      if (/^\d{10}$/.test(val)) return `+91${val}`;
      return val;
    })
    .pipe(
      z
        .string()
        .regex(
          mobileRegex,
          'Mobile number must be in +91XXXXXXXXXX format (or 10 Indian digits).',
        ),
    ),
});

export const verifyMobileChangeSchema = z.object({
  newMobileNumber: z
    .string()
    .trim()
    .transform((val) => {
      if (/^\d{10}$/.test(val)) return `+91${val}`;
      return val;
    })
    .pipe(
      z
        .string()
        .regex(
          mobileRegex,
          'Mobile number must be in +91XXXXXXXXXX format (or 10 Indian digits).',
        ),
    ),
  otp: z
    .string()
    .trim()
    .length(6, 'Verification code must be exactly 6 digits.')
    .regex(otpRegex, 'Verification code must contain digits only.'),
});

export type UpdatePersonalInfoInput = z.infer<typeof updatePersonalInfoSchema>;
export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeSchema>;
export type VerifyEmailChangeInput = z.infer<typeof verifyEmailChangeSchema>;
export type RequestMobileChangeInput = z.infer<typeof requestMobileChangeSchema>;
export type VerifyMobileChangeInput = z.infer<typeof verifyMobileChangeSchema>;
