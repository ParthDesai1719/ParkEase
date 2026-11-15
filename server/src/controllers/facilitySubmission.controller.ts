import type { NextFunction, Response } from 'express';
import type mongoose from 'mongoose';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { RoleModel, type Role } from '../models/Role.js';
import { facilitySubmissionService } from '../services/facilitySubmission.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { normalizeIp } from '../utils/ip.js';

export async function getOwnerSubmissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ownerId = req.userId!;
    const submissions = await facilitySubmissionService.getOwnerSubmissions(ownerId);
    sendSuccess(res, 'Submissions retrieved successfully.', submissions);
  } catch (error) {
    next(error);
  }
}

export async function getSubmissionById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ownerId = req.userId!;
    const submissionId = req.params.id as string;
    const submission = await facilitySubmissionService.getSubmissionById(
      submissionId,
      ownerId,
      false,
    );
    sendSuccess(res, 'Submission details retrieved successfully.', submission);
  } catch (error) {
    next(error);
  }
}

export async function createDraftSubmission(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ownerId = req.userId!;
    const ipAddress = normalizeIp(req.ip || req.socket.remoteAddress) || undefined;
    const submission = await facilitySubmissionService.createDraft(ownerId, req.body, ipAddress);
    sendSuccess(res, 'Facility submission draft saved successfully.', submission, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateSubmission(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ownerId = req.userId!;
    const submissionId = req.params.id as string;
    const ipAddress = normalizeIp(req.ip || req.socket.remoteAddress) || undefined;
    const updated = await facilitySubmissionService.updateSubmission(
      ownerId,
      submissionId,
      req.body,
      ipAddress,
    );
    sendSuccess(res, 'Facility submission updated successfully.', updated);
  } catch (error) {
    next(error);
  }
}

export async function submitForReview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ownerId = req.userId!;
    const submissionId = req.params.id as string;
    const ipAddress = normalizeIp(req.ip || req.socket.remoteAddress) || undefined;
    const submitted = await facilitySubmissionService.submitForReview(
      ownerId,
      submissionId,
      req.body,
      ipAddress,
    );
    sendSuccess(res, 'Facility submission submitted for review successfully.', submitted);
  } catch (error) {
    next(error);
  }
}

export async function deleteDraft(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ownerId = req.userId!;
    const submissionId = req.params.id as string;
    const ipAddress = normalizeIp(req.ip || req.socket.remoteAddress) || undefined;
    await facilitySubmissionService.deleteDraft(ownerId, submissionId, ipAddress);
    sendSuccess(res, 'Draft submission deleted successfully.', null);
  } catch (error) {
    next(error);
  }
}

export async function uploadSubmissionPhoto(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError('No photo file was uploaded.', 400, 'NO_FILE_UPLOADED');
    }

    const relativePath = `uploads/submissions/photos/${req.file.filename}`;
    const category = (req.body.category as string) || 'Exterior';
    const isPrimary = req.body.isPrimary === 'true' || req.body.isPrimary === true;
    const caption = (req.body.caption as string) || '';

    sendSuccess(res, 'Facility photo uploaded successfully.', {
      url: relativePath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      category,
      isPrimary,
      caption,
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadSubmissionPlanPdf(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError('No plan PDF document was uploaded.', 400, 'NO_FILE_UPLOADED');
    }

    const relativePath = `uploads/submissions/plans/${req.file.filename}`;

    sendSuccess(res, 'Reference parking plan PDF uploaded successfully.', {
      url: relativePath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getSubmissionFile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.userId!;
    const roleId = req.roleId!;
    const filename = req.params.filename as string;

    const role = await (RoleModel as mongoose.Model<Role>).findById(roleId).lean().exec();
    const roleCode = role?.roleCode || 'CUSTOMER';

    const { resolvedPath, mimeType } = await facilitySubmissionService.streamSubmissionFile(
      userId,
      roleCode,
      filename,
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    res.sendFile(resolvedPath);
  } catch (error) {
    next(error);
  }
}
