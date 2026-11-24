import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { getOwnerDashboardAnalytics } from '../services/ownerAnalytics.service.js';
import { AppError } from '../utils/AppError.js';

export async function getOwnerDashboardAnalyticsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const { parkingLotId, rangePreset, dateFrom, dateTo } = req.query;

  const data = await getOwnerDashboardAnalytics({
    ownerId: ownerId.toString(),
    parkingLotId: parkingLotId as string | undefined,
    rangePreset: rangePreset as any,
    dateFrom: dateFrom as string | undefined,
    dateTo: dateTo as string | undefined,
  });

  res.status(200).json({
    success: true,
    message: 'Owner dashboard analytics retrieved successfully.',
    data,
  });
}
