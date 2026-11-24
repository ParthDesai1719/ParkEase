import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ownerRevenueService } from '../services/ownerRevenue.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * GET /api/v1/owner/revenue/overview
 * Financial metrics, KPI cards, trends, and cancellation analysis
 */
export async function getOwnerRevenueOverviewHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const result = await ownerRevenueService.getOwnerRevenueOverview(ownerId, {
    parkingLotId: req.query.parkingLotId as string | undefined,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
    rangePreset: req.query.rangePreset as string | undefined,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /api/v1/owner/revenue/transactions
 * Detailed payment breakdown table with pagination, filtering and search
 */
export async function getOwnerRevenueTransactionsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const result = await ownerRevenueService.getOwnerRevenueTransactions(ownerId, {
    parkingLotId: req.query.parkingLotId as string | undefined,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
    paymentStatus: req.query.paymentStatus as string | undefined,
    paymentType: req.query.paymentType as string | undefined,
    paymentMethod: req.query.paymentMethod as string | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
}
