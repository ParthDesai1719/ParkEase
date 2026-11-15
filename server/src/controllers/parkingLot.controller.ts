import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { parkingLotService } from '../services/parkingLot.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { normalizeIp } from '../utils/ip.js';
import { AppError } from '../utils/AppError.js';

/**
 * GET /api/v1/admin/parking-lots/eligible-submissions
 * Retrieve approved facility submissions eligible for official Parking Lot creation
 */
export async function getEligibleSubmissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const submissions = await parkingLotService.getEligibleApprovedSubmissions(search);
    sendSuccess(res, 'Eligible approved facility submissions retrieved successfully.', submissions);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/parking-lots/from-submission/:submissionId
 * Convert an approved Owner Facility Submission into an official Parking Lot with Floors, Zones, and Slots
 */
export async function createOfficialParkingLot(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const submissionId = typeof req.params.submissionId === 'string' ? req.params.submissionId : '';
    if (!submissionId) {
      throw new AppError('Facility submission ID is required.', 400, 'MISSING_SUBMISSION_ID');
    }
    const adminUserId = req.userId!;
    const ipAddress = normalizeIp(req.ip || req.socket.remoteAddress) || undefined;

    const result = await parkingLotService.createOfficialParkingLotFromSubmission(
      submissionId,
      adminUserId,
      ipAddress,
    );

    sendSuccess(
      res,
      `Official Parking Lot "${result.parkingLot.parkingName}" created successfully with ${result.floorsCount} floor(s), ${result.zonesCount} zone(s), and ${result.slotsCount} slot(s).`,
      result,
      201,
    );
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/parking-lots
 * Retrieve paginated official parking lots
 */
export async function getOfficialParkingLots(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { search, status, page, limit } = req.query;

    const result = await parkingLotService.getOfficialParkingLots({
      search: typeof search === 'string' ? search : undefined,
      status: typeof status === 'string' ? status : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    sendSuccess(res, 'Official parking lots retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/parking-lots/:id
 * Retrieve single official parking lot details
 */
export async function getOfficialParkingLotById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Parking Lot ID is required.', 400, 'MISSING_PARKING_LOT_ID');
    }
    const lot = await parkingLotService.getOfficialParkingLotById(id);
    sendSuccess(res, 'Official parking lot details retrieved successfully.', lot);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/parking-lots/:id/hierarchy
 * Retrieve complete structural hierarchy: Lot -> Floors -> Zones -> Slots
 */
export async function getOfficialParkingLotHierarchy(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Parking Lot ID is required.', 400, 'MISSING_PARKING_LOT_ID');
    }
    const hierarchy = await parkingLotService.getOfficialParkingLotHierarchy(id);
    sendSuccess(res, 'Official parking lot hierarchy retrieved successfully.', hierarchy);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/owner/parking-lots
 * Retrieve official parking lots belonging to the authenticated owner
 */
export async function getOwnerParkingLots(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { search, status, page, limit } = req.query;

    const result = await parkingLotService.getOfficialParkingLots({
      search: typeof search === 'string' ? search : undefined,
      status: typeof status === 'string' ? status : undefined,
      ownerId: req.userId!,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    sendSuccess(res, 'Owner parking lots retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/owner/parking-lots/:id
 * Retrieve details for a parking lot owned by the authenticated owner
 */
export async function getOwnerParkingLotById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Parking Lot ID is required.', 400, 'MISSING_PARKING_LOT_ID');
    }
    const lot = await parkingLotService.getOfficialParkingLotById(id, req.userId!);
    sendSuccess(res, 'Owner parking lot details retrieved successfully.', lot);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/owner/parking-lots/:id/hierarchy
 * Retrieve complete structural hierarchy for an owner's parking lot
 */
export async function getOwnerParkingLotHierarchy(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) {
      throw new AppError('Parking Lot ID is required.', 400, 'MISSING_PARKING_LOT_ID');
    }
    const hierarchy = await parkingLotService.getOfficialParkingLotHierarchy(id, req.userId!);
    sendSuccess(res, 'Owner parking lot hierarchy retrieved successfully.', hierarchy);
  } catch (error) {
    next(error);
  }
}
