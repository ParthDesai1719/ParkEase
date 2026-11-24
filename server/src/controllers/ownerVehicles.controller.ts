import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ownerVehiclesService } from '../services/ownerVehicles.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * GET /api/v1/owner/vehicles/overview
 * KPI statistics of vehicles across owner's lots
 */
export async function getOwnerVehiclesOverviewHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const result = await ownerVehiclesService.getOwnerVehiclesOverview(ownerId, {
    parkingLotId: req.query.parkingLotId as string | undefined,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /api/v1/owner/vehicles/list
 * Paginated operational listing of vehicles and movement logs
 */
export async function getOwnerVehiclesListHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const result = await ownerVehiclesService.getOwnerVehiclesList(ownerId, {
    parkingLotId: req.query.parkingLotId as string | undefined,
    movementStatus: req.query.movementStatus as string | undefined,
    vehicleType: req.query.vehicleType as string | undefined,
    search: req.query.search as string | undefined,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /api/v1/owner/vehicles/live-locator
 * Visual slot occupancy and vehicle positioning for owner's facility
 */
export async function getOwnerLiveVehicleLocatorHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const parkingLotId = req.query.parkingLotId as string;
  if (!parkingLotId) {
    throw new AppError('parkingLotId is required.', 400, 'MISSING_LOT_ID');
  }

  const result = await ownerVehiclesService.getOwnerLiveVehicleLocator(
    ownerId,
    parkingLotId,
    req.query.floorId as string | undefined,
  );

  res.status(200).json({
    success: true,
    data: result,
  });
}
