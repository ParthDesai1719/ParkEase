import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs for auth routes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('Too many requests. Please try again later.', 429, 'E030'));
  },
});

export const otpRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // max 10 OTP requests per 5 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      new AppError(
        'Too many OTP attempts. Please wait a few minutes before trying again.',
        429,
        'E030',
      ),
    );
  },
});
