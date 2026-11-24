import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  securityEmailerService,
  type SendSecurityEmailPayload,
} from '../services/securityEmailer.service.js';
import { AppError } from '../utils/AppError.js';

export class SecurityEmailerController {
  public async getAssignedOwners(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const data = await securityEmailerService.getAssignedOwners(req.userId);

    res.status(200).json({
      success: true,
      message: 'Assigned facility owners retrieved successfully.',
      data,
    });
  }

  public async sendEmailToOwner(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const payload = req.body as SendSecurityEmailPayload;
    const ipAddress = req.ip || req.socket.remoteAddress;

    const data = await securityEmailerService.sendEmailToOwner({
      staffUserId: req.userId,
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

    const data = await securityEmailerService.getHistory({
      staffUserId: req.userId,
      queryParams: req.query,
    });

    res.status(200).json({
      success: true,
      message: 'Security sent emails retrieved successfully.',
      data,
    });
  }
}

export const securityEmailerController = new SecurityEmailerController();
