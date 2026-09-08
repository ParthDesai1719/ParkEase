import mongoose, { type InferSchemaType } from 'mongoose';

const vehicleTypeValues = ['Bike', 'Car', 'SUV', 'EV'] as const;

const fuelTypeValues = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'] as const;

const vehicleStatusValues = ['Active', 'Inactive', 'Suspended'] as const;

const vehicleSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },

    vehicleNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/,
    },

    vehicleType: {
      type: String,
      required: true,
      enum: vehicleTypeValues,
      default: 'Car',
    },

    vehicleBrand: {
      type: String,
      required: true,
      maxlength: 50,
    },

    vehicleModel: {
      type: String,
      required: true,
      maxlength: 50,
    },

    vehicleColor: {
      type: String,
      default: null,
      maxlength: 30,
    },

    manufacturingYear: {
      type: Number,
      default: null,
      min: 1980,
      validate: {
        validator: (value: number | null) => value === null || value <= new Date().getFullYear(),
        message: 'manufacturingYear cannot be greater than the current year.',
      },
    },

    fuelType: {
      type: String,
      enum: fuelTypeValues,
      default: 'Petrol',
    },

    isDefault: {
      type: Boolean,
      required: true,
      default: false,
    },

    rcVerified: {
      type: Boolean,
      required: true,
      default: false,
    },

    vehicleStatus: {
      type: String,
      required: true,
      enum: vehicleStatusValues,
      default: 'Active',
    },

    remarks: {
      type: String,
      default: null,
      maxlength: 250,
    },
  },
  {
    collection: 'vehicles',
    timestamps: true,
  },
);

vehicleSchema.index({ customerId: 1 }, { name: 'IDX_Customer' });

vehicleSchema.index(
  { vehicleNumber: 1 },
  {
    name: 'UQ_VehicleNumber',
    unique: true,
  },
);

vehicleSchema.index({ vehicleType: 1 }, { name: 'IDX_Type' });

vehicleSchema.index({ vehicleStatus: 1 }, { name: 'IDX_Status' });

vehicleSchema.index({ customerId: 1, isDefault: 1 }, { name: 'IDX_CustomerDefault' });

export type Vehicle = InferSchemaType<typeof vehicleSchema>;

export const VehicleModel =
  mongoose.models.Vehicle ?? mongoose.model<Vehicle>('Vehicle', vehicleSchema);
