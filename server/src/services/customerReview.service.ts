import mongoose from 'mongoose';
import {
  BookingModel,
  ParkingLotModel,
  ReviewModel,
  type Review,
} from '../models/index.js';
import { AppError } from '../utils/AppError.js';

export interface CustomerReviewListItem {
  _id: string;
  bookingId: string;
  bookingReference: string;
  parkingLotId: string;
  parkingName: string;
  parkingAddress: string;
  parkingCity: string;
  parkingImage?: string | null | undefined;
  overallRating: number;
  comment: string | null;
  ownerReply: string | null;
  replyDate: string | null;
  replyEdited: boolean;
  isEdited: boolean;
  moderationStatus: 'Published' | 'Under Review' | 'Hidden';
  createdAt: string;
  updatedAt: string;
}

export interface EligibleReviewBookingItem {
  bookingId: string;
  bookingReference: string;
  parkingLotId: string;
  parkingName: string;
  parkingAddress: string;
  parkingCity: string;
  parkingImage?: string | null | undefined;
  startTime: string;
  endTime: string;
  actualExitTime?: string | null | undefined;
  totalAmount: number;
  slotNumber: string;
  vehiclePlate: string;
}

/**
 * Automatically recalculates and updates average rating and total review count
 * on the target ParkingLot document whenever a review is added, updated, or removed.
 */
export async function recalculateFacilityRating(
  parkingLotId: mongoose.Types.ObjectId | string,
): Promise<{ averageRating: number; totalReviews: number }> {
  const lotObjectId =
    typeof parkingLotId === 'string'
      ? new mongoose.Types.ObjectId(parkingLotId)
      : parkingLotId;

  const stats = await (ReviewModel as any).aggregate([
    {
      $match: {
        parkingLotId: lotObjectId,
        moderationStatus: 'Published',
      },
    },
    {
      $group: {
        _id: '$parkingLotId',
        totalReviews: { $sum: 1 },
        avgRating: { $avg: '$overallRating' },
      },
    },
  ]);

  const totalReviews = stats.length > 0 ? stats[0].totalReviews : 0;
  const rawAvg = stats.length > 0 ? stats[0].avgRating : 0;
  const averageRating = totalReviews > 0 ? Math.round(rawAvg * 10) / 10 : 0;

  await (ParkingLotModel as any).findByIdAndUpdate(
    lotObjectId,
    {
      totalReviews,
      averageRating,
    },
    { returnDocument: 'after' },
  );

  return { averageRating, totalReviews };
}

export class CustomerReviewService {
  /**
   * Retrieves all reviews submitted by the authenticated customer.
   */
  async getCustomerReviews(customerId: string): Promise<CustomerReviewListItem[]> {
    if (!mongoose.isValidObjectId(customerId)) {
      throw new AppError('Invalid customer ID.', 401, 'UNAUTHORIZED');
    }

    const reviews = await (ReviewModel as any)
      .find({ customerId: new mongoose.Types.ObjectId(customerId) })
      .populate('parkingLotId', 'parkingName address city state parkingImages')
      .populate('bookingId', 'bookingReference startTime endTime bookingStatus')
      .sort({ createdAt: -1 })
      .lean();

    return reviews.map((rev: any) => {
      const lot = rev.parkingLotId;
      const booking = rev.bookingId;

      const firstImage =
        lot?.parkingImages && lot.parkingImages.length > 0
          ? lot.parkingImages[0]
          : null;

      return {
        _id: rev._id.toString(),
        bookingId: (booking?._id ?? rev.bookingId).toString(),
        bookingReference: booking?.bookingReference || 'N/A',
        parkingLotId: (lot?._id ?? rev.parkingLotId).toString(),
        parkingName: lot?.parkingName || 'Parking Facility',
        parkingAddress: lot?.address || '',
        parkingCity: lot?.city || '',
        parkingImage: firstImage,
        overallRating: rev.overallRating,
        comment: rev.comment ?? null,
        ownerReply: rev.ownerReply ?? null,
        replyDate: rev.replyDate ? new Date(rev.replyDate).toISOString() : null,
        replyEdited: Boolean(rev.replyEdited),
        isEdited: Boolean(rev.isEdited),
        moderationStatus: rev.moderationStatus,
        createdAt: rev.createdAt
          ? new Date(rev.createdAt).toISOString()
          : new Date().toISOString(),
        updatedAt: rev.updatedAt
          ? new Date(rev.updatedAt).toISOString()
          : new Date().toISOString(),
      };
    });
  }

  /**
   * Retrieves completed bookings that have not yet been reviewed by the customer.
   */
  async getEligibleBookingsForReview(
    customerId: string,
  ): Promise<EligibleReviewBookingItem[]> {
    if (!mongoose.isValidObjectId(customerId)) {
      throw new AppError('Invalid customer ID.', 401, 'UNAUTHORIZED');
    }

    const custObjectId = new mongoose.Types.ObjectId(customerId);

    // 1. Fetch completed bookings for this customer
    const completedBookings = await (BookingModel as any)
      .find({
        customerId: custObjectId,
        bookingStatus: 'Completed',
      })
      .populate('parkingLotId', 'parkingName address city state parkingImages')
      .populate('currentSlotId', 'slotNumber')
      .populate('vehicleId', 'licensePlate')
      .sort({ actualExitTime: -1, endTime: -1, createdAt: -1 })
      .lean();

    if (completedBookings.length === 0) {
      return [];
    }

    // 2. Fetch all review booking IDs by this customer
    const existingReviews = await (ReviewModel as any)
      .find({ customerId: custObjectId })
      .select('bookingId')
      .lean();

    const reviewedBookingIds = new Set(
      existingReviews.map((r: any) => r.bookingId.toString()),
    );

    // 3. Filter unreviewed completed bookings
    const eligible: EligibleReviewBookingItem[] = [];

    for (const b of completedBookings) {
      if (!reviewedBookingIds.has(b._id.toString())) {
        const lot = b.parkingLotId;
        const slot = b.currentSlotId;
        const vehicle = b.vehicleId;

        const firstImage =
          lot?.parkingImages && lot.parkingImages.length > 0
            ? lot.parkingImages[0]
            : null;

        const entryDate = b.scheduledEntryTime || b.startTime;
        const exitDate = b.scheduledExitTime || b.endTime;

        eligible.push({
          bookingId: b._id.toString(),
          bookingReference: b.bookingReference,
          parkingLotId: (lot?._id ?? b.parkingLotId).toString(),
          parkingName: lot?.parkingName || 'Parking Facility',
          parkingAddress: lot?.address || '',
          parkingCity: lot?.city || '',
          parkingImage: firstImage,
          startTime: entryDate ? new Date(entryDate).toISOString() : '',
          endTime: exitDate ? new Date(exitDate).toISOString() : '',
          actualExitTime: b.actualExitTime
            ? new Date(b.actualExitTime).toISOString()
            : null,
          totalAmount: b.totalAmount ?? b.pricingSnapshot?.totalPrice ?? 0,
          slotNumber: slot?.slotNumber || 'Assigned Bay',
          vehiclePlate: vehicle?.vehicleNumber || vehicle?.licensePlate || 'Registered Vehicle',
        });
      }
    }

    return eligible;
  }

  /**
   * Submits a customer review for a verified completed booking.
   */
  async submitReview(
    customerId: string,
    data: {
      bookingId: string;
      overallRating: number;
      comment?: string | null;
    },
  ): Promise<CustomerReviewListItem> {
    if (!mongoose.isValidObjectId(customerId)) {
      throw new AppError('Invalid customer ID.', 401, 'UNAUTHORIZED');
    }

    if (!data.bookingId || !mongoose.isValidObjectId(data.bookingId)) {
      throw new AppError('A valid booking ID is required.', 400, 'INVALID_BOOKING_ID');
    }

    // Rating validation: Whole-star integer 1 to 5
    const rating = Number(data.overallRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new AppError(
        'Rating must be an integer between 1 and 5 stars.',
        400,
        'INVALID_RATING',
      );
    }

    // Comment validation
    let cleanComment: string | null = null;
    if (data.comment !== undefined && data.comment !== null) {
      cleanComment = data.comment.trim();
      if (cleanComment.length > 1000) {
        throw new AppError(
          'Review comment must not exceed 1000 characters.',
          400,
          'COMMENT_TOO_LONG',
        );
      }
      if (cleanComment.length === 0) {
        cleanComment = null;
      }
    }

    // Ownership & eligibility verification
    const booking = await (BookingModel as any).findById(data.bookingId);
    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }

    if (booking.customerId.toString() !== customerId) {
      throw new AppError(
        'You are not authorized to submit a review for another customer’s booking.',
        403,
        'FORBIDDEN_BOOKING_ACCESS',
      );
    }

    if (booking.bookingStatus !== 'Completed') {
      throw new AppError(
        `Reviews can only be submitted for completed parking sessions. Current status: ${booking.bookingStatus}`,
        400,
        'INELIGIBLE_BOOKING_STATUS',
      );
    }

    // Duplicate review check
    const existing = await (ReviewModel as any).findOne({
      bookingId: booking._id,
    });
    if (existing) {
      throw new AppError(
        'A review has already been submitted for this booking.',
        400,
        'DUPLICATE_REVIEW',
      );
    }

    // Facility verification & owner resolution
    const lot = await (ParkingLotModel as any).findById(booking.parkingLotId);
    if (!lot) {
      throw new AppError(
        'Associated parking facility could not be found.',
        404,
        'FACILITY_NOT_FOUND',
      );
    }

    // Create review
    const newReview = await (ReviewModel as any).create({
      bookingId: booking._id,
      customerId: new mongoose.Types.ObjectId(customerId),
      parkingLotId: lot._id,
      ownerId: lot.ownerId,
      overallRating: rating,
      comment: cleanComment,
      moderationStatus: 'Published',
      isEdited: false,
    });

    // Recalculate parking lot average rating and total reviews
    await recalculateFacilityRating(lot._id);

    return {
      _id: newReview._id.toString(),
      bookingId: booking._id.toString(),
      bookingReference: booking.bookingReference,
      parkingLotId: lot._id.toString(),
      parkingName: lot.parkingName,
      parkingAddress: lot.address,
      parkingCity: lot.city,
      parkingImage:
        lot.parkingImages && lot.parkingImages.length > 0
          ? lot.parkingImages[0]
          : null,
      overallRating: newReview.overallRating,
      comment: newReview.comment ?? null,
      ownerReply: null,
      replyDate: null,
      replyEdited: false,
      isEdited: false,
      moderationStatus: newReview.moderationStatus,
      createdAt: newReview.createdAt
        ? new Date(newReview.createdAt).toISOString()
        : new Date().toISOString(),
      updatedAt: newReview.updatedAt
        ? new Date(newReview.updatedAt).toISOString()
        : new Date().toISOString(),
    };
  }

  /**
   * Updates an existing customer review (rating and/or comment).
   */
  async updateReview(
    customerId: string,
    reviewId: string,
    data: {
      overallRating?: number;
      comment?: string | null;
    },
  ): Promise<CustomerReviewListItem> {
    if (!mongoose.isValidObjectId(customerId)) {
      throw new AppError('Invalid customer ID.', 401, 'UNAUTHORIZED');
    }

    if (!mongoose.isValidObjectId(reviewId)) {
      throw new AppError('Invalid review ID format.', 400, 'INVALID_REVIEW_ID');
    }

    const review = await (ReviewModel as any).findById(reviewId);
    if (!review) {
      throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    }

    if (review.customerId.toString() !== customerId) {
      throw new AppError(
        'You are not authorized to update another customer’s review.',
        403,
        'FORBIDDEN_REVIEW_ACCESS',
      );
    }

    // Validate rating if provided
    if (data.overallRating !== undefined) {
      const rating = Number(data.overallRating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new AppError(
          'Rating must be an integer between 1 and 5 stars.',
          400,
          'INVALID_RATING',
        );
      }
      review.overallRating = rating;
    }

    // Validate comment if provided
    if (data.comment !== undefined) {
      if (data.comment === null) {
        review.comment = null;
      } else {
        const clean = data.comment.trim();
        if (clean.length > 1000) {
          throw new AppError(
            'Review comment must not exceed 1000 characters.',
            400,
            'COMMENT_TOO_LONG',
          );
        }
        review.comment = clean.length > 0 ? clean : null;
      }
    }

    review.isEdited = true;
    await review.save();

    // Recalculate facility rating
    await recalculateFacilityRating(review.parkingLotId);

    // Retrieve populated metadata for response
    const lot = await (ParkingLotModel as any).findById(review.parkingLotId).lean();
    const booking = await (BookingModel as any).findById(review.bookingId).lean();

    return {
      _id: review._id.toString(),
      bookingId: review.bookingId.toString(),
      bookingReference: booking?.bookingReference || 'N/A',
      parkingLotId: review.parkingLotId.toString(),
      parkingName: lot?.parkingName || 'Parking Facility',
      parkingAddress: lot?.address || '',
      parkingCity: lot?.city || '',
      parkingImage:
        lot?.parkingImages && lot.parkingImages.length > 0
          ? lot.parkingImages[0]
          : null,
      overallRating: review.overallRating,
      comment: review.comment ?? null,
      ownerReply: review.ownerReply ?? null,
      replyDate: review.replyDate
        ? new Date(review.replyDate).toISOString()
        : null,
      replyEdited: Boolean(review.replyEdited),
      isEdited: Boolean(review.isEdited),
      moderationStatus: review.moderationStatus,
      createdAt: review.createdAt
        ? new Date(review.createdAt).toISOString()
        : new Date().toISOString(),
      updatedAt: review.updatedAt
        ? new Date(review.updatedAt).toISOString()
        : new Date().toISOString(),
    };
  }

  /**
   * Deletes a review submitted by the authenticated customer.
   */
  async deleteReview(
    customerId: string,
    reviewId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!mongoose.isValidObjectId(customerId)) {
      throw new AppError('Invalid customer ID.', 401, 'UNAUTHORIZED');
    }

    if (!mongoose.isValidObjectId(reviewId)) {
      throw new AppError('Invalid review ID format.', 400, 'INVALID_REVIEW_ID');
    }

    const review = await (ReviewModel as any).findById(reviewId);
    if (!review) {
      throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    }

    if (review.customerId.toString() !== customerId) {
      throw new AppError(
        'You are not authorized to delete another customer’s review.',
        403,
        'FORBIDDEN_REVIEW_ACCESS',
      );
    }

    const lotId = review.parkingLotId;

    await (ReviewModel as any).deleteOne({ _id: review._id });

    // Recalculate facility rating
    await recalculateFacilityRating(lotId);

    return {
      success: true,
      message: 'Review deleted successfully. Facility ratings updated.',
    };
  }
}

export const customerReviewService = new CustomerReviewService();
