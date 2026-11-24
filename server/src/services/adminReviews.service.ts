import mongoose from 'mongoose';
import {
  AuditLogModel,
  BookingModel,
  ParkingLotModel,
  ReviewModel,
  UserModel,
} from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { recalculateFacilityRating } from './customerReview.service.js';

export interface AdminReviewListItem {
  _id: string;
  overallRating: number;
  comment: string | null;
  ownerReply: string | null;
  replyDate: string | null;
  replyEdited: boolean;
  isEdited: boolean;
  moderationStatus: 'Published' | 'Under Review' | 'Hidden';
  moderatedAt: string | null;
  moderationReason: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber?: string | undefined;
    profileImage?: string | null | undefined;
  } | null;
  parkingLot: {
    _id: string;
    parkingName: string;
    address?: string | undefined;
    city?: string | undefined;
  } | null;
  owner: {
    _id: string;
    fullName: string;
    email: string;
    mobileNumber?: string | undefined;
  } | null;
  booking: {
    _id: string;
    bookingReference: string;
    bookingStatus: string;
  } | null;
  moderatedBy: {
    _id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface AdminReviewDetailData extends AdminReviewListItem {
  moderationHistory: Array<{
    action: 'Approve' | 'Hide' | 'Flag' | 'Delete Attempt';
    moderatedAt: string;
    reason: string | null;
    previousStatus: string;
    newStatus: string;
    moderatedBy?: {
      _id: string;
      fullName: string;
      email: string;
    } | null;
  }>;
}

export interface AdminReviewOverview {
  totalReviews: number;
  publishedReviews: number;
  underReviewReviews: number;
  hiddenReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  recentActivity: Array<{
    _id: string;
    overallRating: number;
    comment: string | null;
    moderationStatus: string;
    customerName: string;
    parkingLotName: string;
    createdAt: string;
  }>;
}

export interface AdminReviewQueryParams {
  page?: number | string | undefined;
  limit?: number | string | undefined;
  search?: string | undefined;
  rating?: number | string | undefined;
  status?: string | undefined;
  parkingLotId?: string | undefined;
  ownerId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

class AdminReviewsService {
  /**
   * 1. Overview KPIs & Real-Time Aggregations
   */
  public async getOverview(): Promise<AdminReviewOverview> {
    const [countsByStatus, ratingStats, recentReviews] = await Promise.all([
      // Count by moderation status
      (ReviewModel as any).aggregate([
        {
          $group: {
            _id: '$moderationStatus',
            count: { $sum: 1 },
          },
        },
      ]),

      // Rating distribution and average
      (ReviewModel as any).aggregate([
        {
          $group: {
            _id: '$overallRating',
            count: { $sum: 1 },
          },
        },
      ]),

      // Recent 5 reviews
      (ReviewModel as any)
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('customerId', 'fullName')
        .populate('parkingLotId', 'parkingName')
        .lean()
        .exec(),
    ]);

    let totalReviews = 0;
    let publishedReviews = 0;
    let underReviewReviews = 0;
    let hiddenReviews = 0;

    for (const item of countsByStatus) {
      const status = item._id as string;
      const count = item.count as number;
      totalReviews += count;

      if (status === 'Published') publishedReviews += count;
      else if (status === 'Under Review') underReviewReviews += count;
      else if (status === 'Hidden') hiddenReviews += count;
    }

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;
    let totalRatingsCount = 0;

    for (const item of ratingStats) {
      const rating = Number(item._id);
      const count = Number(item.count);
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating as 1 | 2 | 3 | 4 | 5] = count;
        ratingSum += rating * count;
        totalRatingsCount += count;
      }
    }

    const averageRating =
      totalRatingsCount > 0 ? Number((ratingSum / totalRatingsCount).toFixed(1)) : 0;

    const recentActivity = recentReviews.map((rev: any) => ({
      _id: rev._id.toString(),
      overallRating: rev.overallRating,
      comment: rev.comment || null,
      moderationStatus: rev.moderationStatus,
      customerName: rev.customerId?.fullName || 'Verified Customer',
      parkingLotName: rev.parkingLotId?.parkingName || 'Parking Facility',
      createdAt: rev.createdAt.toISOString(),
    }));

    return {
      totalReviews,
      publishedReviews,
      underReviewReviews,
      hiddenReviews,
      averageRating,
      ratingDistribution,
      recentActivity,
    };
  }

  /**
   * 2. Multi-Criteria Reviews Query with Search, Filters and Server-Side Pagination
   */
  public async getReviews(params: AdminReviewQueryParams): Promise<{
    reviews: AdminReviewListItem[];
    pagination: {
      total: number;
      page: number;
      totalPages: number;
      limit: number;
    };
  }> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    // Filter by moderation status
    if (params.status && params.status !== 'All') {
      filter.moderationStatus = params.status;
    }

    // Filter by rating (1-5)
    if (params.rating && params.rating !== 'All') {
      const numRating = Number(params.rating);
      if (!Number.isNaN(numRating) && numRating >= 1 && numRating <= 5) {
        filter.overallRating = numRating;
      }
    }

    // Filter by Parking Lot
    if (params.parkingLotId && params.parkingLotId !== 'All') {
      if (mongoose.isValidObjectId(params.parkingLotId)) {
        filter.parkingLotId = new mongoose.Types.ObjectId(params.parkingLotId);
      }
    }

    // Filter by Parking Owner
    if (params.ownerId && params.ownerId !== 'All') {
      if (mongoose.isValidObjectId(params.ownerId)) {
        filter.ownerId = new mongoose.Types.ObjectId(params.ownerId);
      }
    }

    // Date range
    if (params.dateFrom || params.dateTo) {
      filter.createdAt = {};
      if (params.dateFrom) {
        const from = new Date(params.dateFrom);
        from.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = from;
      }
      if (params.dateTo) {
        const to = new Date(params.dateTo);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    // Search across Review ID, Customer Name/Email, Lot Name, Owner Name, and Booking Ref
    if (params.search && params.search.trim()) {
      const search = params.search.trim();
      const searchRegex = new RegExp(search, 'i');
      const orConditions: any[] = [{ comment: searchRegex }];

      // Exact ID check
      if (mongoose.isValidObjectId(search)) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      // Resolve matching customer users
      const matchingCustomers = await (UserModel as any)
        .find({
          $or: [{ fullName: searchRegex }, { email: searchRegex }],
        })
        .select('_id')
        .lean()
        .exec();

      if (matchingCustomers.length > 0) {
        orConditions.push({ customerId: { $in: matchingCustomers.map((c: any) => c._id) } });
      }

      // Resolve matching parking lots
      const matchingLots = await (ParkingLotModel as any)
        .find({ parkingName: searchRegex })
        .select('_id')
        .lean()
        .exec();

      if (matchingLots.length > 0) {
        orConditions.push({ parkingLotId: { $in: matchingLots.map((l: any) => l._id) } });
      }

      // Resolve matching owners
      const matchingOwners = await (UserModel as any)
        .find({
          $or: [{ fullName: searchRegex }, { email: searchRegex }],
        })
        .select('_id')
        .lean()
        .exec();

      if (matchingOwners.length > 0) {
        orConditions.push({ ownerId: { $in: matchingOwners.map((o: any) => o._id) } });
      }

      // Resolve matching booking references
      const matchingBookings = await (BookingModel as any)
        .find({ bookingReference: searchRegex })
        .select('_id')
        .lean()
        .exec();

      if (matchingBookings.length > 0) {
        orConditions.push({ bookingId: { $in: matchingBookings.map((b: any) => b._id) } });
      }

      filter.$or = orConditions;
    }

    const [total, records] = await Promise.all([
      (ReviewModel as any).countDocuments(filter),
      (ReviewModel as any)
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'fullName email mobileNumber profileImage')
        .populate('parkingLotId', 'parkingName address city')
        .populate('ownerId', 'fullName email mobileNumber')
        .populate('bookingId', 'bookingReference bookingStatus')
        .populate('moderatedBy', 'fullName email')
        .lean()
        .exec(),
    ]);

    const reviews: AdminReviewListItem[] = records.map((rev: any) => ({
      _id: rev._id.toString(),
      overallRating: rev.overallRating,
      comment: rev.comment || null,
      ownerReply: rev.ownerReply || null,
      replyDate: rev.replyDate ? rev.replyDate.toISOString() : null,
      replyEdited: Boolean(rev.replyEdited),
      isEdited: Boolean(rev.isEdited),
      moderationStatus: rev.moderationStatus,
      moderatedAt: rev.moderatedAt ? rev.moderatedAt.toISOString() : null,
      moderationReason: rev.moderationReason || null,
      createdAt: rev.createdAt.toISOString(),
      updatedAt: rev.updatedAt.toISOString(),
      customer: rev.customerId
        ? {
            _id: rev.customerId._id.toString(),
            fullName: rev.customerId.fullName,
            email: rev.customerId.email,
            mobileNumber: rev.customerId.mobileNumber,
            profileImage: rev.customerId.profileImage || null,
          }
        : null,
      parkingLot: rev.parkingLotId
        ? {
            _id: rev.parkingLotId._id.toString(),
            parkingName: rev.parkingLotId.parkingName,
            address: rev.parkingLotId.address,
            city: rev.parkingLotId.city,
          }
        : null,
      owner: rev.ownerId
        ? {
            _id: rev.ownerId._id.toString(),
            fullName: rev.ownerId.fullName,
            email: rev.ownerId.email,
            mobileNumber: rev.ownerId.mobileNumber,
          }
        : null,
      booking: rev.bookingId
        ? {
            _id: rev.bookingId._id.toString(),
            bookingReference: rev.bookingId.bookingReference,
            bookingStatus: rev.bookingId.bookingStatus,
          }
        : null,
      moderatedBy: rev.moderatedBy
        ? {
            _id: rev.moderatedBy._id.toString(),
            fullName: rev.moderatedBy.fullName,
            email: rev.moderatedBy.email,
          }
        : null,
    }));

    return {
      reviews,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        limit,
      },
    };
  }

  /**
   * 3. Get Single Review Detail Dossier
   */
  public async getReviewById(id: string): Promise<AdminReviewDetailData> {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError('Invalid review ID format.', 400, 'INVALID_ID');
    }

    const rev = await (ReviewModel as any)
      .findById(id)
      .populate('customerId', 'fullName email mobileNumber profileImage')
      .populate('parkingLotId', 'parkingName address city postalCode')
      .populate('ownerId', 'fullName email mobileNumber')
      .populate('bookingId', 'bookingReference bookingStatus parkingRateAtBooking')
      .populate('moderatedBy', 'fullName email')
      .populate('moderationHistory.moderatedBy', 'fullName email')
      .lean()
      .exec();

    if (!rev) {
      throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    }

    return {
      _id: rev._id.toString(),
      overallRating: rev.overallRating,
      comment: rev.comment || null,
      ownerReply: rev.ownerReply || null,
      replyDate: rev.replyDate ? rev.replyDate.toISOString() : null,
      replyEdited: Boolean(rev.replyEdited),
      isEdited: Boolean(rev.isEdited),
      moderationStatus: rev.moderationStatus,
      moderatedAt: rev.moderatedAt ? rev.moderatedAt.toISOString() : null,
      moderationReason: rev.moderationReason || null,
      createdAt: rev.createdAt.toISOString(),
      updatedAt: rev.updatedAt.toISOString(),
      customer: rev.customerId
        ? {
            _id: rev.customerId._id.toString(),
            fullName: rev.customerId.fullName,
            email: rev.customerId.email,
            mobileNumber: rev.customerId.mobileNumber,
            profileImage: rev.customerId.profileImage || null,
          }
        : null,
      parkingLot: rev.parkingLotId
        ? {
            _id: rev.parkingLotId._id.toString(),
            parkingName: rev.parkingLotId.parkingName,
            address: rev.parkingLotId.address,
            city: rev.parkingLotId.city,
          }
        : null,
      owner: rev.ownerId
        ? {
            _id: rev.ownerId._id.toString(),
            fullName: rev.ownerId.fullName,
            email: rev.ownerId.email,
            mobileNumber: rev.ownerId.mobileNumber,
          }
        : null,
      booking: rev.bookingId
        ? {
            _id: rev.bookingId._id.toString(),
            bookingReference: rev.bookingId.bookingReference,
            bookingStatus: rev.bookingId.bookingStatus,
          }
        : null,
      moderatedBy: rev.moderatedBy
        ? {
            _id: rev.moderatedBy._id.toString(),
            fullName: rev.moderatedBy.fullName,
            email: rev.moderatedBy.email,
          }
        : null,
      moderationHistory: (rev.moderationHistory || []).map((h: any) => ({
        action: h.action,
        moderatedAt: h.moderatedAt.toISOString(),
        reason: h.reason || null,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        moderatedBy: h.moderatedBy
          ? {
              _id: h.moderatedBy._id.toString(),
              fullName: h.moderatedBy.fullName,
              email: h.moderatedBy.email,
            }
          : null,
      })),
    };
  }

  /**
   * 4. Approve Review (Sets status to Published)
   */
  public async approveReview(
    adminUserId: string,
    reviewId: string,
    reason?: string,
  ): Promise<AdminReviewDetailData> {
    if (!mongoose.isValidObjectId(reviewId)) {
      throw new AppError('Invalid review ID format.', 400, 'INVALID_ID');
    }

    const review = await (ReviewModel as any).findById(reviewId);
    if (!review) {
      throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    }

    if (review.moderationStatus === 'Published') {
      throw new AppError('Review is already published and publicly visible.', 400, 'ALREADY_PUBLISHED');
    }

    const previousStatus = review.moderationStatus;
    const adminObjectId = new mongoose.Types.ObjectId(adminUserId);
    const moderationNote = reason?.trim() || 'Review approved and published by platform administrator';

    review.moderationStatus = 'Published';
    review.moderatedBy = adminObjectId;
    review.moderatedAt = new Date();
    review.moderationReason = moderationNote;

    review.moderationHistory = review.moderationHistory || [];
    review.moderationHistory.push({
      action: 'Approve',
      moderatedBy: adminObjectId,
      moderatedAt: new Date(),
      reason: moderationNote,
      previousStatus,
      newStatus: 'Published',
    });

    await review.save();

    // Audit Log
    try {
      await AuditLogModel.create({
        userId: adminObjectId,
        actionCode: 'REVIEW_APPROVED',
        actionTitle: 'Customer Review Approved',
        module: 'Review Moderation',
        description: `Administrator approved review for facility. Rating: ${review.overallRating} stars. Status changed from ${previousStatus} to Published.`,
        targetCollection: 'reviews',
        targetDocumentId: review._id,
        metadata: {
          reviewId: review._id.toString(),
          parkingLotId: review.parkingLotId?.toString(),
          customerId: review.customerId?.toString(),
          previousStatus,
          newStatus: 'Published',
          reason: moderationNote,
        },
      });
    } catch (auditErr) {
      console.warn('Failed to record AuditLog for review approval:', auditErr);
    }

    if (review.parkingLotId) {
      await recalculateFacilityRating(review.parkingLotId);
    }

    return this.getReviewById(reviewId);
  }

  /**
   * 5. Hide Review (Sets status to Hidden)
   */
  public async hideReview(
    adminUserId: string,
    reviewId: string,
    reason: string,
  ): Promise<AdminReviewDetailData> {
    if (!mongoose.isValidObjectId(reviewId)) {
      throw new AppError('Invalid review ID format.', 400, 'INVALID_ID');
    }

    const cleanReason = (reason || '').trim();
    if (!cleanReason || cleanReason.length < 5) {
      throw new AppError(
        'A mandatory moderation reason (minimum 5 characters) is required to hide a review.',
        400,
        'REASON_REQUIRED',
      );
    }

    const review = await (ReviewModel as any).findById(reviewId);
    if (!review) {
      throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    }

    if (review.moderationStatus === 'Hidden') {
      throw new AppError('Review is already hidden from public view.', 400, 'ALREADY_HIDDEN');
    }

    const previousStatus = review.moderationStatus;
    const adminObjectId = new mongoose.Types.ObjectId(adminUserId);

    review.moderationStatus = 'Hidden';
    review.moderatedBy = adminObjectId;
    review.moderatedAt = new Date();
    review.moderationReason = cleanReason;

    review.moderationHistory = review.moderationHistory || [];
    review.moderationHistory.push({
      action: 'Hide',
      moderatedBy: adminObjectId,
      moderatedAt: new Date(),
      reason: cleanReason,
      previousStatus,
      newStatus: 'Hidden',
    });

    await review.save();

    // Audit Log
    try {
      await AuditLogModel.create({
        userId: adminObjectId,
        actionCode: 'REVIEW_HIDDEN',
        actionTitle: 'Customer Review Hidden',
        module: 'Review Moderation',
        description: `Administrator hid review for facility. Rating: ${review.overallRating} stars. Reason: ${cleanReason}. Status changed from ${previousStatus} to Hidden.`,
        targetCollection: 'reviews',
        targetDocumentId: review._id,
        metadata: {
          reviewId: review._id.toString(),
          parkingLotId: review.parkingLotId?.toString(),
          customerId: review.customerId?.toString(),
          previousStatus,
          newStatus: 'Hidden',
          reason: cleanReason,
        },
      });
    } catch (auditErr) {
      console.warn('Failed to record AuditLog for review hiding:', auditErr);
    }

    if (review.parkingLotId) {
      await recalculateFacilityRating(review.parkingLotId);
    }

    return this.getReviewById(reviewId);
  }

  /**
   * 6. Delete Review (Strict Historical Protection Safeguards)
   */
  public async deleteReview(
    adminUserId: string,
    reviewId: string,
    reason: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!mongoose.isValidObjectId(reviewId)) {
      throw new AppError('Invalid review ID format.', 400, 'INVALID_ID');
    }

    const cleanReason = (reason || '').trim();
    if (!cleanReason || cleanReason.length < 5) {
      throw new AppError(
        'A mandatory reason (minimum 5 characters) is required to permanently delete a review.',
        400,
        'REASON_REQUIRED',
      );
    }

    const review = await (ReviewModel as any).findById(reviewId);
    if (!review) {
      throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    }

    // Historical Review Protection:
    // 1. If review has an owner reply, permanent deletion is strictly blocked to preserve partner dispute audit trails.
    if (review.ownerReply && review.ownerReply.trim().length > 0) {
      throw new AppError(
        'Cannot permanently delete review with an active owner reply. Please hide the review instead to preserve the compliance audit trail.',
        409,
        'HISTORICAL_PROTECTION_CONFLICT',
      );
    }

    // 2. If review is currently Published with completed operational booking records, block deletion.
    if (review.moderationStatus === 'Published') {
      throw new AppError(
        'Published reviews representing verified operational booking history cannot be permanently deleted. Please hide the review instead to preserve platform audit integrity.',
        409,
        'HISTORICAL_PROTECTION_CONFLICT',
      );
    }

    const adminObjectId = new mongoose.Types.ObjectId(adminUserId);

    // Record complete snapshot in AuditLog before permanent deletion
    try {
      await AuditLogModel.create({
        userId: adminObjectId,
        actionCode: 'REVIEW_DELETED',
        actionTitle: 'Review Permanently Deleted',
        module: 'Review Moderation',
        description: `Administrator permanently deleted un-replied hidden review. Rating: ${review.overallRating} stars. Reason: ${cleanReason}.`,
        targetCollection: 'reviews',
        targetDocumentId: review._id,
        metadata: {
          reviewId: review._id.toString(),
          parkingLotId: review.parkingLotId?.toString(),
          customerId: review.customerId?.toString(),
          bookingId: review.bookingId?.toString(),
          rating: review.overallRating,
          commentPreview: (review.comment || '').slice(0, 150),
          reason: cleanReason,
        },
      });
    } catch (auditErr) {
      console.warn('Failed to record AuditLog for review deletion:', auditErr);
    }

    await (ReviewModel as any).findByIdAndDelete(reviewId);

    if (review.parkingLotId) {
      await recalculateFacilityRating(review.parkingLotId);
    }

    return {
      success: true,
      message: 'Review successfully deleted from the platform.',
    };
  }

  /**
   * 7. Dropdown Filter Options
   */
  public async getFilterOptions(): Promise<{
    parkingLots: Array<{ _id: string; parkingName: string }>;
    owners: Array<{ _id: string; fullName: string }>;
  }> {
    const [lots, owners] = await Promise.all([
      (ParkingLotModel as any)
        .find({ parkingStatus: { $ne: 'Deleted' } })
        .select('_id parkingName')
        .sort({ parkingName: 1 })
        .lean()
        .exec(),

      (UserModel as any)
        .find({ accountStatus: { $ne: 'Deleted' } })
        .populate('roleId', 'roleCode')
        .select('_id fullName roleId')
        .sort({ fullName: 1 })
        .lean()
        .exec(),
    ]);

    const parkingOwners = owners
      .filter((u: any) => u.roleId && (u.roleId.roleCode === 'OWNER' || u.roleId.roleCode === 'PARKING_OWNER'))
      .map((u: any) => ({
        _id: u._id.toString(),
        fullName: u.fullName,
      }));

    return {
      parkingLots: lots.map((l: any) => ({
        _id: l._id.toString(),
        parkingName: l.parkingName,
      })),
      owners: parkingOwners,
    };
  }
}

export const adminReviewsService = new AdminReviewsService();
