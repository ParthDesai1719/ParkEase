import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { profileService } from '../services/profile.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

// Resolve uploads/avatars root directory
const uploadsRoot = fs.existsSync(path.resolve(process.cwd(), 'server', 'uploads'))
  ? path.resolve(process.cwd(), 'server', 'uploads')
  : path.resolve(process.cwd(), 'uploads');
const avatarsRoot = path.resolve(uploadsRoot, 'avatars');

export async function getProfile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }
    const result = await profileService.getProfile(req.userId);
    sendSuccess(res, 'Profile retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

export async function updatePersonalInfo(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }
    const result = await profileService.updatePersonalInfo(req.userId, req.body);
    sendSuccess(res, 'Personal information updated successfully.', result);
  } catch (error) {
    next(error);
  }
}

export async function uploadAvatar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }
    if (!req.file) {
      throw new AppError('No avatar image file was uploaded.', 400, 'NO_FILE_UPLOADED');
    }

    const relativeUrl = `/api/v1/profile/avatar/${req.file.filename}`;
    const result = await profileService.updatePersonalInfo(req.userId, {
      profileImage: relativeUrl,
    });

    sendSuccess(res, 'Avatar image updated successfully.', {
      avatarUrl: relativeUrl,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export function streamAvatar(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const rawFilename = Array.isArray(req.params.filename)
      ? req.params.filename[0]
      : req.params.filename;
    if (!rawFilename) {
      throw new AppError('Filename is required.', 400, 'INVALID_FILENAME');
    }

    const safeFilename = path.basename(rawFilename);
    const targetPath = path.resolve(avatarsRoot, safeFilename);

    if (!targetPath.startsWith(avatarsRoot)) {
      throw new AppError('Access to the specified avatar is forbidden.', 403, 'FORBIDDEN_PATH');
    }

    if (!fs.existsSync(targetPath)) {
      throw new AppError('Avatar image not found.', 404, 'NOT_FOUND');
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=43200');

    const stream = fs.createReadStream(targetPath);
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function requestEmailChangeOtp(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }
    const result = await profileService.requestEmailChangeOtp(req.userId, req.body.newEmail);
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailChangeOtp(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }
    const result = await profileService.verifyEmailChangeOtp(
      req.userId,
      req.body.newEmail,
      req.body.otp,
    );
    sendSuccess(res, 'Email address changed successfully.', result);
  } catch (error) {
    next(error);
  }
}

export async function requestMobileChangeOtp(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }
    const result = await profileService.requestMobileChangeOtp(req.userId, req.body.newMobileNumber);
    sendSuccess(res, result.message, result);
  } catch (error) {
    next(error);
  }
}

export async function verifyMobileChangeOtp(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'E006');
    }
    const result = await profileService.verifyMobileChangeOtp(
      req.userId,
      req.body.newMobileNumber,
      req.body.otp,
    );
    sendSuccess(res, 'Mobile number changed successfully.', result);
  } catch (error) {
    next(error);
  }
}
