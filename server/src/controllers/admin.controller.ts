import fs from 'node:fs';
import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { adminService } from '../services/admin.service.js';
import { facilitySubmissionService } from '../services/facilitySubmission.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { normalizeIp } from '../utils/ip.js';

export async function getDashboardOverview(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await adminService.getDashboardOverview();
    sendSuccess(res, 'Dashboard overview metrics retrieved successfully.', data);
  } catch (error) {
    next(error);
  }
}

export async function getOwnerApplications(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { status, search, page, limit } = req.query;
    const filter: import('../services/admin.service.js').GetOwnerApplicationsFilter = {};
    if (typeof status === 'string') filter.status = status;
    if (typeof search === 'string') filter.search = search;
    if (page) filter.page = Number(page);
    if (limit) filter.limit = Number(limit);

    const result = await adminService.getOwnerApplications(filter);
    sendSuccess(res, 'Owner applications retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

export async function getOwnerApplicationById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const application = await adminService.getOwnerApplicationById(id as string, req.userId);
    sendSuccess(res, 'Owner application details retrieved successfully.', application);
  } catch (error) {
    next(error);
  }
}

export async function approveOwnerApplication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { remarks } = req.body || {};

    const application = await adminService.approveOwnerApplication({
      id: id as string,
      adminUserId: req.userId!,
      adminRoleId: req.roleId,
      remarks,
      ipAddress: normalizeIp(req.ip),
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, 'Parking Owner application approved successfully.', application);
  } catch (error) {
    next(error);
  }
}

export async function rejectOwnerApplication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { rejectionReason, remarks } = req.body || {};

    const application = await adminService.rejectOwnerApplication({
      id: id as string,
      adminUserId: req.userId!,
      adminRoleId: req.roleId,
      rejectionReason,
      remarks,
      ipAddress: normalizeIp(req.ip),
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, 'Parking Owner application rejected successfully.', application);
  } catch (error) {
    next(error);
  }
}

export async function updateOwnerApplicationRemarks(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { remarks } = req.body || {};

    const application = await adminService.updateAdminRemarks({
      id: id as string,
      remarks: typeof remarks === 'string' ? remarks : '',
      adminUserId: req.userId!,
      ipAddress: normalizeIp(req.ip),
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, 'Administrative remarks updated successfully.', application);
  } catch (error) {
    next(error);
  }
}

export async function getOwnerApplicationDocument(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, docType } = req.params;
    const index = req.query.index ? Number(req.query.index) : undefined;

    const docResult = await adminService.getOwnerApplicationDocumentPath(
      id as string,
      docType as string,
      index,
    );

    if (docResult.isRemote && docResult.url) {
      res.redirect(docResult.url);
      return;
    }

    if (!docResult.filePath) {
      res.status(404).json({ success: false, message: 'Document file not found.' });
      return;
    }

    res.setHeader('Content-Type', docResult.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${docResult.fileName || 'document'}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    const stream = fs.createReadStream(docResult.filePath);
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function getPublicOwnerRegistrationStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const queryParam = (req.query.query || req.query.reference || req.query.mobile) as string;
    const statusData = await adminService.getPublicRegistrationStatus(queryParam || '');
    sendSuccess(res, 'Registration status retrieved successfully.', statusData);
  } catch (error) {
    next(error);
  }
}

/**
 * =========================================================================
 * PARKING FACILITY SUBMISSION REVIEW CONTROLLER HANDLERS
 * =========================================================================
 */

export async function getFacilitySubmissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { status, search, page, limit, sortBy, sortOrder } = req.query;
    const filter: import('../services/facilitySubmission.service.js').GetAdminFacilitySubmissionsFilter = {};
    if (typeof status === 'string') filter.status = status;
    if (typeof search === 'string') filter.search = search;
    if (page) filter.page = Number(page);
    if (limit) filter.limit = Number(limit);
    if (typeof sortBy === 'string') filter.sortBy = sortBy;
    if (sortOrder === 'asc' || sortOrder === 'desc') filter.sortOrder = sortOrder;

    const result = await facilitySubmissionService.getAdminFacilitySubmissions(filter);
    sendSuccess(res, 'Parking facility submissions retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

export async function getFacilitySubmissionById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const submission = await facilitySubmissionService.getSubmissionById(
      id as string,
      req.userId!,
      true, // isAdmin = true
    );
    sendSuccess(res, 'Facility submission details retrieved successfully.', submission);
  } catch (error) {
    next(error);
  }
}

export async function startFacilityReview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const submission = await facilitySubmissionService.startReview(
      id as string,
      req.userId!,
      req.roleId,
      normalizeIp(req.ip) || undefined,
    );
    sendSuccess(res, 'Facility submission review started.', submission);
  } catch (error) {
    next(error);
  }
}

export async function requestFacilityChanges(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { remarks } = req.body || {};
    const submission = await facilitySubmissionService.requestChanges(
      id as string,
      req.userId!,
      req.roleId,
      remarks,
      normalizeIp(req.ip) || undefined,
    );
    sendSuccess(res, 'Changes requested for facility submission.', submission);
  } catch (error) {
    next(error);
  }
}

export async function approveFacilitySubmission(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { remarks } = req.body || {};
    const submission = await facilitySubmissionService.approveSubmission(
      id as string,
      req.userId!,
      req.roleId,
      remarks,
      normalizeIp(req.ip) || undefined,
    );
    sendSuccess(res, 'Facility submission approved successfully.', submission);
  } catch (error) {
    next(error);
  }
}

export async function rejectFacilitySubmission(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { rejectionReason, remarks } = req.body || {};
    const submission = await facilitySubmissionService.rejectSubmission(
      id as string,
      req.userId!,
      req.roleId,
      rejectionReason,
      remarks,
      normalizeIp(req.ip) || undefined,
    );
    sendSuccess(res, 'Facility submission rejected.', submission);
  } catch (error) {
    next(error);
  }
}

export async function updateFacilityRemarks(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { remarks } = req.body || {};
    const submission = await facilitySubmissionService.updateAdminRemarks(
      id as string,
      req.userId!,
      remarks,
      normalizeIp(req.ip) || undefined,
    );
    sendSuccess(res, 'Facility remarks updated successfully.', submission);
  } catch (error) {
    next(error);
  }
}

export async function getAdminFacilityFile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filename = req.params.filename as string;
    const { resolvedPath, mimeType } = await facilitySubmissionService.streamSubmissionFile(
      req.userId!,
      'ADMIN',
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
