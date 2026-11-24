import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { securityLiveViewerService } from '../services/securityLiveViewer.service.js';
import { AppError } from '../utils/AppError.js';

export class SecurityLiveViewerController {
  public async getAssignedFacilities(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const data = await securityLiveViewerService.getAssignedFacilities(req.userId);

    res.status(200).json({
      success: true,
      message: 'Assigned facilities retrieved successfully.',
      data,
    });
  }

  public async getLiveFloorLayout(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const parkingLotId = req.query.parkingLotId as string;
    const floorId = req.query.floorId as string;

    if (!parkingLotId || !floorId) {
      throw new AppError('parkingLotId and floorId query parameters are required.', 400, 'PARAMS_REQUIRED');
    }

    const data = await securityLiveViewerService.getLiveFloorLayout({
      staffUserId: req.userId,
      parkingLotId,
      floorId,
    });

    res.status(200).json({
      success: true,
      message: 'Live 2D floor layout retrieved successfully.',
      data,
    });
  }

  public async getSlotDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const parkingLotId = req.query.parkingLotId as string;
    const slotId = req.query.slotId as string;

    if (!parkingLotId || !slotId) {
      throw new AppError('parkingLotId and slotId query parameters are required.', 400, 'PARAMS_REQUIRED');
    }

    const data = await securityLiveViewerService.getSlotDetails({
      staffUserId: req.userId,
      parkingLotId,
      slotId,
    });

    res.status(200).json({
      success: true,
      message: 'Bay details retrieved successfully.',
      data,
    });
  }

  public async updateSlotStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const slotIdParam = req.params.slotId;
    const targetSlotId = Array.isArray(slotIdParam) ? slotIdParam[0] : slotIdParam;
    if (!targetSlotId) {
      throw new AppError('slotId parameter is required.', 400, 'PARAM_REQUIRED');
    }

    const parkingLotId = (req.body.parkingLotId || req.query.parkingLotId) as string;
    const { slotStatus, remarks } = req.body;

    if (!parkingLotId) {
      throw new AppError('parkingLotId is required in request body or query.', 400, 'PARAM_REQUIRED');
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;

    const data = await securityLiveViewerService.updateSlotStatus({
      staffUserId: req.userId,
      parkingLotId,
      slotId: targetSlotId,
      payload: { slotStatus, remarks },
      context: { ipAddress, userAgent },
    });

    res.status(200).json({
      success: true,
      message: data.message,
      data,
    });
  }
}

export const securityLiveViewerController = new SecurityLiveViewerController();
