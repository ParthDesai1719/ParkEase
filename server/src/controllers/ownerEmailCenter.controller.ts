import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  ownerEmailCenterService,
  type OwnerRecipientCategory,
  type SendOwnerEmailPayload,
} from '../services/ownerEmailCenter.service.js';
import { AppError } from '../utils/AppError.js';

export class OwnerEmailCenterController {
  public async getRecipients(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const category = req.query.category as OwnerRecipientCategory;
    const parkingLotId = req.query.parkingLotId as string | undefined;
    const search = req.query.search as string | undefined;

    if (!category || !['CUSTOMERS', 'SECURITY_STAFF'].includes(category)) {
      throw new AppError('Valid category (CUSTOMERS or SECURITY_STAFF) is required.', 400, 'INVALID_CATEGORY');
    }

    const data = await ownerEmailCenterService.getRecipients({
      ownerUserId: req.userId,
      category,
      parkingLotId,
      search,
    });

    res.status(200).json({
      success: true,
      message: 'Eligible recipients retrieved successfully.',
      data,
    });
  }

  public async sendEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const payload = req.body as SendOwnerEmailPayload;
    const ipAddress = req.ip || req.socket.remoteAddress;

    const data = await ownerEmailCenterService.sendEmail({
      ownerUserId: req.userId,
      payload,
      ipAddress,
    });

    res.status(200).json({
      success: true,
      message: data.message,
      data,
    });
  }

  public async getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const data = await ownerEmailCenterService.getHistory({
      ownerUserId: req.userId,
      queryParams: req.query,
    });

    res.status(200).json({
      success: true,
      message: 'Owner email history retrieved successfully.',
      data,
    });
  }

  public async getOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const data = await ownerEmailCenterService.getOverview(req.userId);

    res.status(200).json({
      success: true,
      message: 'Owner email overview retrieved successfully.',
      data,
    });
  }
}

export const ownerEmailCenterController = new OwnerEmailCenterController();
