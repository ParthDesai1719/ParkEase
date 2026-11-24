import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { adminStaffService } from '../services/adminStaff.service.js';
import { AppError } from '../utils/AppError.js';

function getParamId(param: string | string[] | undefined): string {
  if (!param) return '';
  if (Array.isArray(param)) return param[0] ?? '';
  return param;
}

/**
 * GET /api/v1/admin/staff/overview
 * Dashboard summary metrics for Security Staff.
 */
export async function getStaffOverview(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const overview = await adminStaffService.getStaffOverview();
    res.status(200).json({
      success: true,
      message: 'Security staff overview retrieved successfully.',
      data: overview,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/staff
 * Directory of security staff with search, filters, and pagination.
 */
export async function getStaffList(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, search, ownerId, parkingLotId, status, sortBy, sortOrder } = req.query;

    const result = await adminStaffService.getStaffList({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: typeof search === 'string' ? search : undefined,
      ownerId: typeof ownerId === 'string' ? ownerId : undefined,
      parkingLotId: typeof parkingLotId === 'string' ? parkingLotId : undefined,
      status: typeof status === 'string' ? status : undefined,
      sortBy: typeof sortBy === 'string' ? sortBy : undefined,
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    });

    res.status(200).json({
      success: true,
      message: 'Security staff list retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/staff/owners
 * Helper to fetch approved parking owners for dropdown selectors.
 */
export async function getOwnerOptions(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const owners = await adminStaffService.getOwnerOptions();
    res.status(200).json({
      success: true,
      message: 'Parking owners retrieved successfully.',
      data: owners,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/staff/parking-lots
 * Helper to fetch parking lots, optionally filtered by ownerId.
 */
export async function getParkingLotOptions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ownerId = typeof req.query.ownerId === 'string' ? req.query.ownerId : undefined;
    const lots = await adminStaffService.getParkingLotOptions(ownerId);
    res.status(200).json({
      success: true,
      message: 'Parking lots retrieved successfully.',
      data: lots,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/staff/:id
 * Retrieve full staff profile, assignment history, operational metrics, and activity logs.
 */
export async function getStaffById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const staffId = getParamId(req.params.id);
    if (!staffId) {
      throw new AppError('Staff ID is required.', 400, 'E001');
    }

    const detail = await adminStaffService.getStaffById(staffId);
    res.status(200).json({
      success: true,
      message: 'Security staff details retrieved successfully.',
      data: detail,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/staff
 * Create and assign a Security Staff account.
 */
export async function createStaff(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const adminUserId = req.userId;
    if (!adminUserId) {
      throw new AppError('Admin authentication required.', 401, 'E003');
    }

    const { fullName, email, mobileNumber, ownerId, parkingLotId, employeeId, assignmentReason } =
      req.body;

    const result = await adminStaffService.createStaff(adminUserId, {
      fullName,
      email,
      mobileNumber,
      ownerId,
      parkingLotId,
      employeeId,
      assignmentReason,
    });

    res.status(201).json({
      success: true,
      message: 'Security staff created and assigned successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/admin/staff/:id
 * Update permitted profile fields for a Security Staff member.
 */
export async function updateStaff(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const adminUserId = req.userId;
    if (!adminUserId) {
      throw new AppError('Admin authentication required.', 401, 'E003');
    }

    const staffId = getParamId(req.params.id);
    if (!staffId) {
      throw new AppError('Staff ID is required.', 400, 'E001');
    }

    const { fullName, mobileNumber, employeeId } = req.body;
    const result = await adminStaffService.updateStaff(adminUserId, staffId, {
      fullName,
      mobileNumber,
      employeeId,
    });

    res.status(200).json({
      success: true,
      message: 'Security staff profile updated successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/staff/:id/suspend
 * Disciplinary suspension of Security Staff account.
 */
export async function suspendStaff(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const adminUserId = req.userId;
    if (!adminUserId) {
      throw new AppError('Admin authentication required.', 401, 'E003');
    }

    const staffId = getParamId(req.params.id);
    if (!staffId) {
      throw new AppError('Staff ID is required.', 400, 'E001');
    }

    const { reason } = req.body;
    const result = await adminStaffService.suspendStaff(adminUserId, staffId, reason);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/staff/:id/activate
 * Reactivate a suspended/deactivated Security Staff account.
 */
export async function activateStaff(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const adminUserId = req.userId;
    if (!adminUserId) {
      throw new AppError('Admin authentication required.', 401, 'E003');
    }

    const staffId = getParamId(req.params.id);
    if (!staffId) {
      throw new AppError('Staff ID is required.', 400, 'E001');
    }

    const result = await adminStaffService.activateStaff(adminUserId, staffId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/staff/:id/transfer
 * Transfer a Security Staff member from one facility to another.
 */
export async function transferStaff(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const adminUserId = req.userId;
    if (!adminUserId) {
      throw new AppError('Admin authentication required.', 401, 'E003');
    }

    const staffId = getParamId(req.params.id);
    if (!staffId) {
      throw new AppError('Staff ID is required.', 400, 'E001');
    }

    const { newOwnerId, newParkingLotId, transferReason } = req.body;
    const result = await adminStaffService.transferStaff(adminUserId, staffId, {
      newOwnerId,
      newParkingLotId,
      transferReason,
    });

    res.status(200).json({
      success: true,
      message: 'Security staff transferred successfully to new facility.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/admin/staff/:id
 * Delete Security Staff account if 0 operational history exists.
 */
export async function deleteStaff(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const adminUserId = req.userId;
    if (!adminUserId) {
      throw new AppError('Admin authentication required.', 401, 'E003');
    }

    const staffId = getParamId(req.params.id);
    if (!staffId) {
      throw new AppError('Staff ID is required.', 400, 'E001');
    }

    const result = await adminStaffService.deleteStaff(adminUserId, staffId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}
