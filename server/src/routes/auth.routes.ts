import { Router } from 'express';
import {
  getMe,
  logout,
  refreshToken,
  requestLoginOtp,
  requestRegisterOtp,
  resendOtp,
  verifyLoginOtp,
  verifyRegisterOtp,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter, otpRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import {
  refreshTokenSchema,
  requestLoginOtpSchema,
  requestRegisterOtpSchema,
  resendOtpSchema,
  verifyLoginOtpSchema,
  verifyRegisterOtpSchema,
} from '../validators/auth.validator.js';

const router = Router();

// Passwordless Login
router.post(
  '/login/request-otp',
  otpRateLimiter,
  validateBody(requestLoginOtpSchema),
  requestLoginOtp,
);
router.post(
  '/login/verify-otp',
  otpRateLimiter,
  validateBody(verifyLoginOtpSchema),
  verifyLoginOtp,
);

// Customer Registration
router.post(
  '/register/request-otp',
  otpRateLimiter,
  validateBody(requestRegisterOtpSchema),
  requestRegisterOtp,
);
router.post(
  '/register/verify-otp',
  otpRateLimiter,
  validateBody(verifyRegisterOtpSchema),
  verifyRegisterOtp,
);

// OTP Management
router.post('/otp/resend', otpRateLimiter, validateBody(resendOtpSchema), resendOtp);

// Session Renewal & Termination
router.post('/refresh-token', authRateLimiter, validateBody(refreshTokenSchema), refreshToken);
router.post('/logout', requireAuth, logout);

// Authenticated User Profile
router.get('/me', requireAuth, getMe);

export default router;
