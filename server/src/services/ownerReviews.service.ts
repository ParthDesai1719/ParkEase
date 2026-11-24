import mongoose from 'mongoose';
import { ReviewModel, type Review } from '../models/Review.js';
import { ParkingLotModel, type ParkingLot } from '../models/ParkingLot.js';
import { notificationService } from './notification.service.js';
import { AppError } from '../utils/AppError.js';

export interface OwnerReviewsQueryParams {
  parkingLotId?: string | undefined;
  starRating?: number | string | undefined;
  replyStatus?: 'all' | 'awaiting' | 'replied' | undefined;
  search?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export class OwnerReviewsService {
  private async getAuthorizedLotIds(ownerId: string, requestedLotId?: string) {
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      throw new AppError('Invalid owner identifier.', 401, 'INVALID_OWNER_ID');
    }

    const ownerLots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: new mongoose.Types.ObjectId(ownerId) })
      .select('_id name parkingName address')
      .lean();

    const allOwnerLotIds = ownerLots.map((l) => new mongoose.Types.ObjectId(l._id.toString()));

    if (allOwnerLotIds.length === 0) {
      return { allOwnerLotIds: [], targetLotIds: [], ownerLots: [] };
    }

    let targetLotIds = allOwnerLotIds;
    if (requestedLotId && requestedLotId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(requestedLotId)) {
        throw new AppError('Invalid parking lot ID filter.', 400, 'INVALID_LOT_ID');
      }
      const match = allOwnerLotIds.some((id) => id.toString() === requestedLotId);
      if (!match) {
        throw new AppError('Forbidden: You do not own this parking lot.', 403, 'FORBIDDEN_LOT');
      }
      targetLotIds = [new mongoose.Types.ObjectId(requestedLotId)];
    }

    return {
      allOwnerLotIds,
      targetLotIds,
      ownerLots: ownerLots.map((l) => ({
        _id: l._id.toString(),
        parkingName: l.parkingName || (l as any).name || 'Unnamed Facility',
        address: l.address || '',
      })),
    };
  }

  /**
   * OWNER-03: Reviews dashboard summary and paginated reviews
   */
  public async getOwnerReviews(ownerId: string, query: OwnerReviewsQueryParams) {
    const { targetLotIds, ownerLots } = await this.getAuthorizedLotIds(ownerId, query.parkingLotId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    if (targetLotIds.length === 0) {
      return {
        reviews: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        ownerLots,
        summary: {
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          awaitingReplyCount: 0,
          repliedCount: 0,
        },
      };
    }

    // 1. Overall Metrics across target lots
    const allReviewsForLots = await (ReviewModel as any)
      .find({
        parkingLotId: { $in: targetLotIds },
        moderationStatus: { $ne: 'Hidden' },
      })
      .select('overallRating ownerReply')
      .lean();

    let ratingSum = 0;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let awaitingCount = 0;
    let repliedCount = 0;

    for (const r of allReviewsForLots) {
      const star = r.overallRating || 5;
      ratingSum += star;
      if (distribution[star] !== undefined) distribution[star] += 1;

      if (r.ownerReply && r.ownerReply.trim().length > 0) {
        repliedCount += 1;
      } else {
        awaitingCount += 1;
      }
    }

    const totalReviews = allReviewsForLots.length;
    const averageRating = totalReviews > 0 ? Number((ratingSum / totalReviews).toFixed(1)) : 0;

    // 2. Build filtered query for listing
    const filter: Record<string, any> = {
      parkingLotId: { $in: targetLotIds },
      moderationStatus: { $ne: 'Hidden' },
    };

    if (query.starRating && query.starRating !== 'all') {
      filter.overallRating = Number(query.starRating);
    }

    if (query.replyStatus === 'awaiting') {
      filter.$or = [{ ownerReply: null }, { ownerReply: '' }];
    } else if (query.replyStatus === 'replied') {
      filter.ownerReply = { $ne: null, $nin: [''] };
    }

    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
    }

    const [reviews, filteredTotal] = await Promise.all([
      (ReviewModel as any)
        .find(filter)
        .populate('customerId', 'fullName email mobileNumber')
        .populate('bookingId', 'bookingReference bookingStatus')
        .populate('parkingLotId', 'parkingName address')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      (ReviewModel as any).countDocuments(filter),
    ]);

    const formattedReviews = reviews.map((r: any) => ({
      _id: r._id.toString(),
      bookingId: r.bookingId?._id?.toString() || null,
      bookingReference: r.bookingId?.bookingReference || 'N/A',
      customerName: r.customerId?.fullName || 'Verified Customer',
      customerEmail: r.customerId?.email || null,
      parkingLotId: r.parkingLotId?._id?.toString() || '',
      parkingLotName: r.parkingLotId?.parkingName || 'Facility',
      overallRating: r.overallRating,
      comment: r.comment || '',
      ownerReply: r.ownerReply || null,
      replyDate: r.replyDate ? new Date(r.replyDate).toISOString() : null,
      replyEdited: Boolean(r.replyEdited),
      isEdited: Boolean(r.isEdited),
      moderationStatus: r.moderationStatus,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    }));

    return {
      reviews: formattedReviews,
      total: filteredTotal,
      page,
      limit,
      totalPages: Math.ceil(filteredTotal / limit) || 1,
      ownerLots,
      summary: {
        averageRating,
        totalReviews,
        ratingDistribution: distribution,
        awaitingReplyCount: awaitingCount,
        repliedCount: repliedCount,
      },
    };
  }

  /**
   * OWNER-03: Submit or edit an owner reply to a customer review
   */
  public async submitOwnerReply(ownerId: string, reviewId: string, replyText: string) {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      throw new AppError('Invalid review ID.', 400, 'INVALID_REVIEW_ID');
    }

    if (!replyText || typeof replyText !== 'string' || !replyText.trim()) {
      throw new AppError('Reply message cannot be empty.', 400, 'EMPTY_REPLY');
    }

    const sanitizedReply = replyText.trim();
    if (sanitizedReply.length > 1000) {
      throw new AppError('Reply must not exceed 1000 characters.', 400, 'REPLY_TOO_LONG');
    }

    const review = await (ReviewModel as any)
      .findById(reviewId)
      .populate('parkingLotId', 'ownerId parkingName')
      .populate('customerId', 'fullName email')
      .populate('bookingId', 'bookingReference');

    if (!review) {
      throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    }

    // Verify facility ownership
    const lotOwnerId = review.parkingLotId?.ownerId?.toString() || review.ownerId?.toString();
    if (lotOwnerId !== ownerId) {
      throw new AppError('Forbidden: You do not own the parking facility for this review.', 403, 'FORBIDDEN_REVIEW');
    }

    const isEdit = Boolean(review.ownerReply && review.ownerReply.trim().length > 0);

    review.ownerReply = sanitizedReply;
    review.replyDate = new Date();
    if (isEdit) {
      review.replyEdited = true;
    }

    await review.save();

    // Customer Notification
    try {
      if (review.customerId?._id) {
        const facilityName = review.parkingLotId?.parkingName || 'the parking facility';
        await notificationService.createNotification({
          userId: review.customerId._id.toString(),
          title: isEdit ? 'Facility Owner Updated Reply' : 'Facility Owner Replied to Your Review',
          message: `The management of ${facilityName} has ${isEdit ? 'updated their response' : 'replied'} to your review for booking ${review.bookingId?.bookingReference || ''}.`,
          notificationType: 'Parking Facility',
          eventType: 'REVIEW_REPLIED',
          priority: 'Normal',
          actionUrl: `/customer/reviews`,
          metadata: {
            reviewId: review._id.toString(),
            parkingLotId: review.parkingLotId?._id?.toString(),
            bookingId: review.bookingId?._id?.toString(),
          },
        });
      }
    } catch (notifErr) {
      console.warn('Failed to send review reply customer notification:', notifErr);
    }

    return {
      _id: review._id.toString(),
      ownerReply: review.ownerReply,
      replyDate: review.replyDate.toISOString(),
      replyEdited: review.replyEdited,
      message: isEdit ? 'Owner reply updated successfully.' : 'Owner reply submitted successfully.',
    };
  }
}

export const ownerReviewsService = new OwnerReviewsService();
