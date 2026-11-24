import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { adminOperationsService } from '../services/adminOperations.service.js';
import { AppError } from '../utils/AppError.js';

function getParamId(param: string | string[] | undefined): string {
  if (!param) return '';
  if (Array.isArray(param)) return param[0] ?? '';
  return param;
}

/**
 * GET /api/v1/admin/bookings/overview
 * Platform-wide booking summary statistics & revenue.
 */
export async function getBookingOverview(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const overview = await adminOperationsService.getBookingOverview();
    res.status(200).json({
      success: true,
      message: 'Booking overview retrieved successfully.',
      data: overview,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/bookings
 * Query platform bookings with search, filters, and pagination.
 */
export async function getBookings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      search,
      status,
      parkingLotId,
      ownerId,
      customerId,
      paymentStatus,
      bookingType,
      dateFrom,
      dateTo,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await adminOperationsService.getBookings({
      search: typeof search === 'string' ? search : undefined,
      status: typeof status === 'string' ? status : undefined,
      parkingLotId: typeof parkingLotId === 'string' ? parkingLotId : undefined,
      ownerId: typeof ownerId === 'string' ? ownerId : undefined,
      customerId: typeof customerId === 'string' ? customerId : undefined,
      paymentStatus: typeof paymentStatus === 'string' ? paymentStatus : undefined,
      bookingType: typeof bookingType === 'string' ? bookingType : undefined,
      dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
      dateTo: typeof dateTo === 'string' ? dateTo : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy: typeof sortBy === 'string' ? sortBy : undefined,
      sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
    });

    res.status(200).json({
      success: true,
      message: 'Bookings retrieved successfully.',
      data: result.bookings,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/bookings/:id
 * Single booking dossier with customer, lot, slot, payment, timeline, and movement logs.
 */
export async function getBookingById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const bookingId = getParamId(req.params.id);
    const result = await adminOperationsService.getBookingById(bookingId);
    res.status(200).json({
      success: true,
      message: 'Booking details retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/bookings/:id/cancel
 * Administrative booking cancellation with centralized refund workflow.
 */
export async function cancelBooking(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const bookingId = getParamId(req.params.id);
    const { reason } = req.body;

    if (!req.userId) {
      throw new AppError('Unauthorized: Admin credentials required.', 401, 'UNAUTHORIZED');
    }

    const context: { ipAddress?: string | undefined; userAgent?: string | undefined } = {
      ipAddress: req.ip || req.socket?.remoteAddress || undefined,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    };

    const result = await adminOperationsService.cancelBooking(
      bookingId,
      { reason },
      req.userId,
      context,
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        booking: result.booking,
        refundAmount: result.refundAmount,
        refundStatus: result.refundStatus,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/bookings/:id/cancellation
 * Dedicated inspection endpoint for cancellation details and refund status.
 */
export async function getBookingCancellationDetails(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const bookingId = getParamId(req.params.id);
    const result = await adminOperationsService.getBookingCancellationDetails(bookingId);
    res.status(200).json({
      success: true,
      message: 'Cancellation details retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/live-vehicles/overview
 * Platform-wide Live Vehicle Locator KPI metrics.
 */
export async function getLiveVehiclesOverview(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const overview = await adminOperationsService.getLiveVehiclesOverview();
    res.status(200).json({
      success: true,
      message: 'Live vehicle overview retrieved successfully.',
      data: overview,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/live-vehicles
 * Query vehicles currently parked inside ParkEase facilities.
 */
export async function getLiveVehicles(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { search, parkingLotId, floorId, vehicleType, status, duration, page, limit } = req.query;

    const result = await adminOperationsService.getLiveVehicles({
      search: typeof search === 'string' ? search : undefined,
      parkingLotId: typeof parkingLotId === 'string' ? parkingLotId : undefined,
      floorId: typeof floorId === 'string' ? floorId : undefined,
      vehicleType: typeof vehicleType === 'string' ? vehicleType : undefined,
      status: status === 'Inside Parking' || status === 'Overstayed' || status === 'ALL' ? status : undefined,
      duration:
        duration === '< 1 Hour' ||
        duration === '1-3 Hours' ||
        duration === '3-6 Hours' ||
        duration === '> 6 Hours' ||
        duration === 'Overnight'
          ? duration
          : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(200).json({
      success: true,
      message: 'Live vehicles retrieved successfully.',
      data: result.vehicles,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/live-vehicles/:id
 * Single live vehicle detail inspection.
 */
export async function getLiveVehicleDetails(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const bookingId = getParamId(req.params.id);
    const result = await adminOperationsService.getLiveVehicleDetails(bookingId);
    res.status(200).json({
      success: true,
      message: 'Live vehicle details retrieved successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
