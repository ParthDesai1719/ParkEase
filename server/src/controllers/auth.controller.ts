import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { authService } from '../services/auth.service.js';
import { sessionService } from '../services/session.service.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { normalizeIp } from '../utils/ip.js';

const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
}

export async function requestLoginOtp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.requestLoginOtp({
      ...req.body,
      ipAddress: normalizeIp(req.ip),
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, result.message, { cooldownSeconds: result.cooldownSeconds });
  } catch (error) {
    next(error);
  }
}

export async function verifyLoginOtp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.verifyLoginOtp({
      ...req.body,
      ipAddress: normalizeIp(req.ip),
      userAgent: req.headers['user-agent'],
    });

    setRefreshTokenCookie(res, result.refreshToken);

    sendSuccess(res, 'Login successful.', {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function requestRegisterOtp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.requestRegisterOtp({
      ...req.body,
      ipAddress: normalizeIp(req.ip),
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, result.message);
  } catch (error) {
    next(error);
  }
}

export async function verifyRegisterOtp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.verifyRegisterOtpAndCreateAccount({
      ...req.body,
      ipAddress: normalizeIp(req.ip),
      userAgent: req.headers['user-agent'],
    });

    setRefreshTokenCookie(res, result.refreshToken);

    sendSuccess(
      res,
      'Registration successful.',
      {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      201,
    );
  } catch (error) {
    next(error);
  }
}

export async function resendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.resendOtp(req.body);
    sendSuccess(res, result.message, { cooldownSeconds: result.cooldownSeconds });
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Deterministic Precedence Rule: Cookie takes precedence over request body
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;

    if (!rawRefreshToken) {
      throw new AppError('Refresh token is required.', 401, 'E040');
    }

    const result = await sessionService.rotateRefreshToken(rawRefreshToken, {
      ipAddress: normalizeIp(req.ip),
      userAgent: req.headers['user-agent'],
    });

    setRefreshTokenCookie(res, result.rawRefreshToken);

    sendSuccess(res, 'Access token refreshed successfully.', {
      accessToken: result.accessToken,
      refreshToken: result.rawRefreshToken,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;

    if (req.sessionId) {
      await sessionService.revokeSession(req.sessionId, 'User Logout');
    } else if (rawRefreshToken) {
      await sessionService.revokeSessionByToken(rawRefreshToken, 'User Logout');
    }

    clearRefreshTokenCookie(res);

    sendSuccess(res, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
}

export async function getMe(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    const result = await authService.getCurrentUser(req.userId);
    sendSuccess(res, 'User profile retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}
