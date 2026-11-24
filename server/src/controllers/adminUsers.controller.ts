import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { adminUsersService } from '../services/adminUsers.service.js';
import { AppError } from '../utils/AppError.js';

function getParamId(param: string | string[] | undefined): string {
  if (!param) return '';
  if (Array.isArray(param)) return param[0] ?? '';
  return param;
}

/**
 * GET /api/v1/admin/users
 * Directory of customer accounts with search, filters, and pagination.
 */
export async function getCustomers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      page,
      limit,
      search,
      status,
      bookingActivity,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await adminUsersService.listCustomers({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: typeof search === 'string' ? search : undefined,
      status: typeof status === 'string' ? status : undefined,
      bookingActivity:
        bookingActivity === 'HAS_BOOKINGS' || bookingActivity === 'NO_BOOKINGS'
          ? bookingActivity
          : undefined,
      dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
      dateTo: typeof dateTo === 'string' ? dateTo : undefined,
      sortBy:
        sortBy === 'fullName' || sortBy === 'lastLogin' || sortBy === 'bookingCount'
          ? sortBy
          : undefined,
      sortOrder: sortOrder === 'asc' ? 'asc' : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/users/:id
 * Customer profile details, KPIs, vehicles, and recent sessions.
 */
export async function getCustomerDetails(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = getParamId(req.params.id);
    const details = await adminUsersService.getCustomerDetails(id);

    res.status(200).json({
      success: true,
      data: details,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/users/:id/bookings
 * Paginated booking history for a specific customer.
 */
export async function getCustomerBookings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = getParamId(req.params.id);
    const { page, limit, status } = req.query;

    const result = await adminUsersService.getCustomerBookings(id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status: typeof status === 'string' ? status : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/admin/users/:id
 * Update permitted customer profile fields.
 */
export async function updateCustomerProfile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = getParamId(req.params.id);
    if (!req.userId) {
      throw new AppError('Unauthorized admin request.', 401, 'E006');
    }

    const updated = await adminUsersService.updateCustomerProfile(
      id,
      req.body,
      req.userId,
      req.roleId,
    );

    res.status(200).json({
      success: true,
      message: 'Customer profile updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/users/:id/suspend
 * Suspend customer account with reason, revoking active sessions.
 */
export async function suspendCustomer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = getParamId(req.params.id);
    const { reason } = req.body;

    if (!req.userId) {
      throw new AppError('Unauthorized admin request.', 401, 'E006');
    }

    const user = await adminUsersService.suspendCustomer(
      id,
      reason,
      req.userId,
      req.roleId,
    );

    res.status(200).json({
      success: true,
      message: `Customer account ${user.fullName} has been suspended.`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/users/:id/activate
 * Reactivate a customer account.
 */
export async function activateCustomer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = getParamId(req.params.id);
    const { remarks } = req.body;

    if (!req.userId) {
      throw new AppError('Unauthorized admin request.', 401, 'E006');
    }

    const user = await adminUsersService.activateCustomer(
      id,
      remarks,
      req.userId,
      req.roleId,
    );

    res.status(200).json({
      success: true,
      message: `Customer account ${user.fullName} has been reactivated.`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/admin/users/:id
 * Delete customer account if no dependency conflicts exist.
 */
export async function deleteCustomer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = getParamId(req.params.id);

    if (!req.userId) {
      throw new AppError('Unauthorized admin request.', 401, 'E006');
    }

    const result = await adminUsersService.deleteCustomer(
      id,
      req.userId,
      req.roleId,
    );

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}
