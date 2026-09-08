import mongoose, { type InferSchemaType } from 'mongoose';

const businessTypeValues = [
  'Commercial Parking',
  'Shopping Mall',
  'Hospital',
  'Hotel',
  'Airport',
  'Railway Station',
  'Residential Society',
  'Educational Institution',
  'Other',
] as const;

const governmentIdTypeValues = ['Aadhaar', 'PAN', 'Driving Licence', 'Passport'] as const;

const applicationStatusValues = [
  'Draft',
  'Submitted',
  'Pending Review',
  'Approved',
  'Rejected',
] as const;

const activeApplicationStatuses = ['Draft', 'Submitted', 'Pending Review'] as const;

const ownerApplicationSchema = new mongoose.Schema(
  {
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },

    applicationReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },

    businessName: {
      type: String,
      required: true,
      maxlength: 150,
      trim: true,
    },

    businessType: {
      type: String,
      required: true,
      enum: businessTypeValues,
    },

    businessAddress: {
      type: String,
      required: true,
      maxlength: 300,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },

    postalCode: {
      type: String,
      required: true,
      trim: true,
      match: /^[1-9][0-9]{5}$/,
    },

    parkingCapacity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (value: number) => Number.isInteger(value),
        message: 'parkingCapacity must be a positive integer.',
      },
    },

    businessDescription: {
      type: String,
      required: true,
      maxlength: 1000,
      trim: true,
    },

    ownerName: {
      type: String,
      required: true,
      maxlength: 120,
      trim: true,
    },

    businessEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },

    businessPhone: {
      type: String,
      required: true,
      trim: true,
      match: /^\+91\d{10}$/,
    },

    governmentIdType: {
      type: String,
      required: true,
      enum: governmentIdTypeValues,
      default: 'Aadhaar',
    },

    governmentIdNumber: {
      type: String,
      required: true,
      trim: true,
    },

    identityProofUrl: {
      type: String,
      required: true,
      trim: true,
    },

    businessLicenseUrl: {
      type: String,
      required: true,
      trim: true,
    },

    propertyProofUrl: {
      type: String,
      required: true,
      trim: true,
    },

    parkingImageUrls: {
      type: [String],
      required: true,
      default: [],
    },

    termsAccepted: {
      type: Boolean,
      required: true,
      default: false,
    },

    emailOtpVerified: {
      type: Boolean,
      required: true,
      default: false,
    },

    mobileOtpVerified: {
      type: Boolean,
      required: true,
      default: false,
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },

    registrationFeeAmount: {
      type: Number,
      required: true,
      default: 999,
      min: 0,
    },

    applicationStatus: {
      type: String,
      required: true,
      enum: applicationStatusValues,
      default: 'Draft',
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    adminRemarks: {
      type: String,
      default: null,
      maxlength: 1000,
      trim: true,
    },

    rejectionReason: {
      type: String,
      default: null,
      maxlength: 500,
      trim: true,
    },

    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'ownerApplications',
    timestamps: true,
  },
);

ownerApplicationSchema.index(
  { applicationReference: 1 },
  {
    name: 'UQ_ApplicationReference',
    unique: true,
  },
);

ownerApplicationSchema.index({ applicantId: 1 }, { name: 'IDX_Applicant' });

ownerApplicationSchema.index({ applicationStatus: 1 }, { name: 'IDX_Status' });

ownerApplicationSchema.index({ paymentId: 1 }, { name: 'IDX_Payment' });

ownerApplicationSchema.index({ reviewedBy: 1 }, { name: 'IDX_Reviewer' });

ownerApplicationSchema.index({ submittedAt: -1 }, { name: 'IDX_Submitted' });

ownerApplicationSchema.index(
  { applicantId: 1 },
  {
    name: 'UQ_ApplicantActiveApplication',
    unique: true,
    partialFilterExpression: {
      applicationStatus: {
        $in: activeApplicationStatuses,
      },
    },
  },
);

export type OwnerApplication = InferSchemaType<typeof ownerApplicationSchema>;

export const OwnerApplicationModel =
  mongoose.models.OwnerApplication ??
  mongoose.model<OwnerApplication>('OwnerApplication', ownerApplicationSchema);
