import { Router } from 'express';
import {
  getProfile,
  updatePersonalInfo,
  uploadAvatar,
  streamAvatar,
  requestEmailChangeOtp,
  verifyEmailChangeOtp,
  requestMobileChangeOtp,
  verifyMobileChangeOtp,
} from '../controllers/profile.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { otpRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import { avatarUpload } from '../middleware/upload.js';
import {
  updatePersonalInfoSchema,
  requestEmailChangeSchema,
  verifyEmailChangeSchema,
  requestMobileChangeSchema,
  verifyMobileChangeSchema,
} from '../validators/profile.validator.js';

const router = Router();

// Public avatar streaming (allows <img> tags to load avatars directly)
router.get('/avatar/:filename', streamAvatar);

// Authenticated profile retrieval
router.get('/', requireAuth, getProfile);

// Update permitted personal information
router.patch(
  '/personal-info',
  requireAuth,
  validateBody(updatePersonalInfoSchema),
  updatePersonalInfo,
);

// Upload and set avatar image
router.post(
  '/avatar',
  requireAuth,
  avatarUpload.single('avatar'),
  uploadAvatar,
);

// Change Email with OTP Verification
router.post(
  '/email/request-otp',
  requireAuth,
  otpRateLimiter,
  validateBody(requestEmailChangeSchema),
  requestEmailChangeOtp,
);

router.post(
  '/email/verify-otp',
  requireAuth,
  otpRateLimiter,
  validateBody(verifyEmailChangeSchema),
  verifyEmailChangeOtp,
);

// Change Mobile with OTP Verification
router.post(
  '/mobile/request-otp',
  requireAuth,
  otpRateLimiter,
  validateBody(requestMobileChangeSchema),
  requestMobileChangeOtp,
);

router.post(
  '/mobile/verify-otp',
  requireAuth,
  otpRateLimiter,
  validateBody(verifyMobileChangeSchema),
  verifyMobileChangeOtp,
);

export default router;

