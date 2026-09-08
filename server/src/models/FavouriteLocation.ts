import mongoose, { type InferSchemaType } from 'mongoose';

const favouriteLocationSchema = new mongoose.Schema(
  {
    customerId: {
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

    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    collection: 'favouriteLocations',
    timestamps: true,
  },
);

// IDX_Customer
favouriteLocationSchema.index({ customerId: 1 }, { name: 'IDX_Customer' });

// IDX_Parking
favouriteLocationSchema.index({ parkingLotId: 1 }, { name: 'IDX_Parking' });

// IDX_CustomerDate
favouriteLocationSchema.index({ customerId: 1, createdAt: 1 }, { name: 'IDX_CustomerDate' });

// UQ_CustomerParking
favouriteLocationSchema.index(
  { customerId: 1, parkingLotId: 1 },
  {
    name: 'UQ_CustomerParking',
    unique: true,
  },
);

export type FavouriteLocation = InferSchemaType<typeof favouriteLocationSchema>;

export const FavouriteLocationModel =
  mongoose.models.FavouriteLocation ??
  mongoose.model<FavouriteLocation>('FavouriteLocation', favouriteLocationSchema);
