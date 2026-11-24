import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { ownerReviewsService } from '../services/ownerReviews.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * GET /api/v1/owner/reviews
 * Reviews dashboard summary and paginated reviews list
 */
export async function getOwnerReviewsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const result = await ownerReviewsService.getOwnerReviews(ownerId, {
    parkingLotId: req.query.parkingLotId as string | undefined,
    starRating: req.query.starRating as string | undefined,
    replyStatus: req.query.replyStatus as 'all' | 'awaiting' | 'replied' | undefined,
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
 * POST /api/v1/owner/reviews/:reviewId/reply
 * Submit or edit owner reply to customer review
 */
export async function submitOwnerReviewReplyHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const ownerId = req.userId;
  if (!ownerId) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const reviewId = req.params.reviewId as string;
  const { replyText } = req.body;

  const result = await ownerReviewsService.submitOwnerReply(ownerId, reviewId, replyText);

  res.status(200).json({
    success: true,
    message: result.message,
    data: result,
  });
}
