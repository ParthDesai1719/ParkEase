import mongoose, { type InferSchemaType } from 'mongoose';

const moderationStatusValues = ['Published', 'Under Review', 'Hidden'] as const;

const reviewSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Booking',
      immutable: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      immutable: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      immutable: true,
    },

    parkingLotId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'ParkingLot',
      immutable: true,
    },

    overallRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: (value: number) => Number.isInteger(value),
        message: 'overallRating must be an integer from 1 to 5.',
      },
    },

    comment: {
      type: String,
      default: null,
      maxlength: 1000,
      trim: true,
    },

    ownerReply: {
      type: String,
      default: null,
      maxlength: 1000,
      trim: true,
    },

    replyDate: {
      type: Date,
      default: null,
    },

    replyEdited: {
      type: Boolean,
      required: true,
      default: false,
    },

    isEdited: {
      type: Boolean,
      required: true,
      default: false,
    },

    moderationStatus: {
      type: String,
      required: true,
      enum: moderationStatusValues,
      default: 'Published',
    },

    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    moderatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'reviews',
    timestamps: true,
  },
);

// One Review per Booking
reviewSchema.index({ bookingId: 1 }, { name: 'IDX_Booking', unique: true });

reviewSchema.index({ customerId: 1 }, { name: 'IDX_Customer' });

reviewSchema.index({ parkingLotId: 1 }, { name: 'IDX_ParkingLot' });

reviewSchema.index({ ownerId: 1 }, { name: 'IDX_Owner' });

reviewSchema.index({ overallRating: -1 }, { name: 'IDX_Rating' });

reviewSchema.index({ moderationStatus: 1 }, { name: 'IDX_Status' });

reviewSchema.index({ createdAt: -1 }, { name: 'IDX_CreatedAt' });

export type Review = InferSchemaType<typeof reviewSchema>;

export const ReviewModel = mongoose.models.Review ?? mongoose.model<Review>('Review', reviewSchema);
