import mongoose, { type InferSchemaType } from 'mongoose';

const parkingAmenities = [
  'CCTV Surveillance',
  'Covered Parking',
  'EV Charging',
  'Disabled Parking',
  'Security Staff',
  'Car Wash',
  'Washroom',
  'Drinking Water',
  'Lift Access',
  'Fire Safety System',
] as const;

const parkingStatusValues = [
  'Active',
  'Inactive',
  'Under Maintenance',
  'Temporarily Closed',
] as const;

const parkingLotSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },

    parkingName: {
      type: String,
      required: true,
      maxlength: 120,
    },

    description: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    address: {
      type: String,
      required: true,
      maxlength: 300,
    },

    city: {
      type: String,
      required: true,
      maxlength: 100,
    },

    state: {
      type: String,
      required: true,
      maxlength: 100,
    },

    country: {
      type: String,
      required: true,
      default: 'India',
      maxlength: 100,
    },

    postalCode: {
      type: String,
      required: true,
    },

    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },

    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coordinates: unknown[]) =>
            coordinates.length === 2 &&
            typeof coordinates[0] === 'number' &&
            typeof coordinates[1] === 'number' &&
            coordinates[0] >= -180 &&
            coordinates[0] <= 180 &&
            coordinates[1] >= -90 &&
            coordinates[1] <= 90,
          message: 'location.coordinates must be [longitude, latitude] within valid ranges.',
        },
      },
    },

    contactNumber: {
      type: String,
      required: true,
    },

    supportEmail: {
      type: String,
      default: null,
    },

    openingTime: {
      type: String,
      required: true,
      default: '00:00',
    },

    closingTime: {
      type: String,
      required: true,
      default: '23:59',
    },

    isOpen24Hours: {
      type: Boolean,
      required: true,
      default: false,
    },

    hourlyRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    gracePeriodMinutes: {
      type: Number,
      required: true,
      default: 15,
      min: 0,
    },

    totalFloors: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },

    totalSlots: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    availableSlots: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    occupiedSlots: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    reservedSlots: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    occupancyPercentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },

    averageRating: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 5,
    },

    totalReviews: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    amenities: {
      type: [String],
      enum: parkingAmenities,
      default: [],
    },

    parkingImages: {
      type: [String],
      default: [],
    },

    isVerified: {
      type: Boolean,
      required: true,
      default: false,
    },

    parkingStatus: {
      type: String,
      required: true,
      enum: parkingStatusValues,
      default: 'Active',
    },
  },
  {
    collection: 'parkingLots',
    timestamps: true,
  },
);

parkingLotSchema.index(
  { ownerId: 1 },
  {
    name: 'IDX_Owner',
  },
);

parkingLotSchema.index(
  { ownerId: 1, parkingName: 1 },
  {
    name: 'IDX_OwnerName',
    unique: true,
  },
);

parkingLotSchema.index(
  { parkingName: 'text' },
  {
    name: 'IDX_Name',
  },
);

parkingLotSchema.index(
  { location: '2dsphere' },
  {
    name: 'IDX_Location',
  },
);

parkingLotSchema.index(
  { city: 1 },
  {
    name: 'IDX_City',
  },
);

parkingLotSchema.index(
  { parkingStatus: 1 },
  {
    name: 'IDX_Status',
  },
);

parkingLotSchema.index(
  { averageRating: -1 },
  {
    name: 'IDX_Rating',
  },
);

parkingLotSchema.index(
  { occupancyPercentage: 1 },
  {
    name: 'IDX_Occupancy',
  },
);

export type ParkingLot = InferSchemaType<typeof parkingLotSchema>;

export const ParkingLotModel =
  mongoose.models.ParkingLot ?? mongoose.model<ParkingLot>('ParkingLot', parkingLotSchema);
