import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { adminSettingsService } from '../services/adminSettings.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { brandingDir } from '../middleware/upload.js';
import { AppError } from '../utils/AppError.js';

export async function getSettings(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await adminSettingsService.getSettings();
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await adminSettingsService.updateSettings(
      req.body,
      req.userId,
      req.roleId
    );
    res.status(200).json({
      success: true,
      message: 'Platform settings updated successfully.',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadPlatformLogo(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError('No logo image file was uploaded.', 400, 'NO_FILE_UPLOADED');
    }
    const relativeUrl = `/api/v1/admin/settings/logo/${req.file.filename}`;
    const updated = await adminSettingsService.updateSettings(
      { platformLogoUrl: relativeUrl },
      req.userId,
      req.roleId
    );
    res.status(200).json({
      success: true,
      message: 'Platform logo uploaded successfully.',
      data: {
        logoUrl: relativeUrl,
        settings: updated,
      },
    });
  } catch (error) {
    next(error);
  }
}

export function streamPlatformLogo(req: Request, res: Response, next: NextFunction): void {
  try {
    const rawFilename = Array.isArray(req.params.filename)
      ? req.params.filename[0]
      : req.params.filename;
    if (!rawFilename) {
      throw new AppError('Filename is required.', 400, 'INVALID_FILENAME');
    }
    const safeFilename = path.basename(rawFilename);
    const targetPath = path.resolve(brandingDir, safeFilename);

    if (!targetPath.startsWith(brandingDir)) {
      throw new AppError('Access to the specified file is forbidden.', 403, 'FORBIDDEN_PATH');
    }

    if (!fs.existsSync(targetPath)) {
      throw new AppError('Logo file not found.', 404, 'NOT_FOUND');
    }

    const ext = path.extname(safeFilename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(targetPath).pipe(res);
  } catch (error) {
    next(error);
  }
}
