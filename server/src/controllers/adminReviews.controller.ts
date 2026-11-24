import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { adminReviewsService } from '../services/adminReviews.service.js';
import { AppError } from '../utils/AppError.js';

export async function getReviewOverview(
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const overview = await adminReviewsService.getOverview();
  res.status(200).json({
    success: true,
    data: overview,
  });
}

export async function getReviews(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const result = await adminReviewsService.getReviews(req.query);
  res.status(200).json({
    success: true,
    data: result.reviews,
    pagination: result.pagination,
  });
}

export async function getReviewById(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const id = req.params.id as string;
  const review = await adminReviewsService.getReviewById(id);
  res.status(200).json({
    success: true,
    data: review,
  });
}

export async function approveReview(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const adminUserId = req.userId;
  if (!adminUserId) {
    throw new AppError('Authentication required.', 401, 'E007');
  }

  const id = req.params.id as string;
  const { reason } = req.body;

  const updatedReview = await adminReviewsService.approveReview(adminUserId, id, reason);
  res.status(200).json({
    success: true,
    message: 'Review approved and published successfully.',
    data: updatedReview,
  });
}

export async function hideReview(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const adminUserId = req.userId;
  if (!adminUserId) {
    throw new AppError('Authentication required.', 401, 'E007');
  }

  const id = req.params.id as string;
  const { reason } = req.body;

  const updatedReview = await adminReviewsService.hideReview(adminUserId, id, reason);
  res.status(200).json({
    success: true,
    message: 'Review hidden successfully.',
    data: updatedReview,
  });
}

export async function deleteReview(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const adminUserId = req.userId;
  if (!adminUserId) {
    throw new AppError('Authentication required.', 401, 'E007');
  }

  const id = req.params.id as string;
  const { reason } = req.body;

  const result = await adminReviewsService.deleteReview(adminUserId, id, reason);
  res.status(200).json({
    success: true,
    message: result.message,
  });
}

export async function getReviewFilterOptions(
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const options = await adminReviewsService.getFilterOptions();
  res.status(200).json({
    success: true,
    data: options,
  });
}
