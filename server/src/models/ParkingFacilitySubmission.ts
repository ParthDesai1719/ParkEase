import mongoose, { type InferSchemaType } from 'mongoose';

export const submissionStatusValues = [
  'Draft',
  'Submitted',
  'Under Review',
  'Changes Requested',
  'Approved',
  'Rejected',
] as const;

export const facilityTypeValues = [
  'Commercial Parking',
  'Shopping Mall',
  'Hospital',
  'Hotel',
  'Airport',
  'Railway Station',
  'Residential Society',
  'Educational Institution',
  'Independent Plot',
  'Other',
] as const;

export const vehicleTypeValues = ['Car', 'SUV', 'Bike', 'EV', 'Other'] as const;

export const photoCategoryValues = [
  'Exterior',
  'Complex / Building',
  'Entrance',
  'Exit',
  'Floors',
  'Areas',
  'Zones',
  'Slots',
  'Lanes',
  'Pillars / Walls / Obstacles',
  'Signage',
  'EV',
  'Accessible',
  'Security / CCTV',
  'Waiting Area',
  'Other',
] as const;

// 1. Location Sub-schema
const submissionLocationSchema = new mongoose.Schema(
  {
    address: { type: String, default: '', trim: true, maxlength: 300 },
    addressLine1: { type: String, default: '', trim: true, maxlength: 150 },
    addressLine2: { type: String, default: '', trim: true, maxlength: 150 },
    areaLocality: { type: String, default: '', trim: true, maxlength: 100 },
    city: { type: String, default: '', trim: true, maxlength: 100 },
    state: { type: String, default: '', trim: true, maxlength: 100 },
    postalCode: { type: String, default: '', trim: true },
    latitude: { type: Number, default: 23.0225, min: -90, max: 90 },
    longitude: { type: Number, default: 72.5714, min: -180, max: 180 },
    confirmed: { type: Boolean, default: false },
  },
  { _id: false },
);

// 2. Capacity Breakdown Sub-schema
const capacityBreakdownSchema = new mongoose.Schema(
  {
    car: { type: Number, default: 0, min: 0 },
    suv: { type: Number, default: 0, min: 0 },
    bike: { type: Number, default: 0, min: 0 },
    ev: { type: Number, default: 0, min: 0 },
    accessible: { type: Number, default: 0, min: 0 },
    vip: { type: Number, default: 0, min: 0 },
    other: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

// 3. Capacity Sub-schema
const submissionCapacitySchema = new mongoose.Schema(
  {
    totalSlots: { type: Number, default: 0, min: 0 },
    breakdown: { type: capacityBreakdownSchema, required: true, default: () => ({}) },
  },
  { _id: false },
);

// 4. Floor Reference Sub-schema
const floorReferenceSchema = new mongoose.Schema(
  {
    floorName: { type: String, required: true, trim: true, maxlength: 100 },
    floorNumber: { type: Number, required: true },
    slotCount: { type: Number, required: true, min: 0 },
    floorDescription: { type: String, default: '', trim: true, maxlength: 500 },
    parkingType: { type: String, default: 'Covered', trim: true, maxlength: 100 },
    specialAreas: { type: String, default: '', trim: true, maxlength: 300 },
    additionalNotes: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { _id: false },
);

// 5. Zone Reference Sub-schema
const zoneReferenceSchema = new mongoose.Schema(
  {
    zoneName: { type: String, required: true, trim: true, maxlength: 100 },
    floorName: { type: String, required: true, trim: true, maxlength: 100 },
    slotCount: { type: Number, required: true, min: 0 },
    zoneType: { type: String, default: 'Standard', trim: true, maxlength: 100 },
    supportedVehicleType: { type: String, default: 'Car', trim: true },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    specialPurpose: { type: String, default: '', trim: true, maxlength: 300 },
    additionalNotes: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { _id: false },
);

// 6. Operating Info Sub-schema
const dailyScheduleItemSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    isOpen: { type: Boolean, default: true },
    openingTime: { type: String, default: '08:00' },
    closingTime: { type: String, default: '22:00' },
  },
  { _id: false },
);

const submissionOperatingSchema = new mongoose.Schema(
  {
    isOpen24x7: { type: Boolean, default: false },
    openingTime: { type: String, default: '08:00' },
    closingTime: { type: String, default: '22:00' },
    scheduleType: { type: String, default: 'Standard' },
    dailySchedules: { type: [dailyScheduleItemSchema], default: [] },
  },
  { _id: false },
);

// 7. Pricing Sub-schema
const submissionPricingSchema = new mongoose.Schema(
  {
    carHourlyRate: { type: Number, default: 0, min: 0 },
    suvHourlyRate: { type: Number, default: 0, min: 0 },
    bikeHourlyRate: { type: Number, default: 0, min: 0 },
    dailyRate: { type: Number, default: 0, min: 0 },
    overnightRate: { type: Number, default: 0, min: 0 },
    evChargingRatePerHour: { type: Number, default: 0, min: 0 },
    otherHourlyRate: { type: Number, default: 0, min: 0 },
    gracePeriodMinutes: { type: Number, default: 15, min: 0 },
    minParkingDurationHours: { type: Number, default: 1, min: 1 },
    maxParkingDurationHours: { type: Number, default: 24, min: 1 },
    additionalPricingNotes: { type: String, default: '', maxlength: 1000 },
  },
  { _id: false },
);

// 8. Rules Sub-schema
const submissionRulesSchema = new mongoose.Schema(
  {
    rules: { type: String, default: '', maxlength: 2000 },
    entryExitInstructions: { type: String, default: '', maxlength: 1000 },
    vehicleRestrictions: { type: String, default: '', maxlength: 1000 },
    heightWeightRestrictions: { type: String, default: '', maxlength: 500 },
    evRules: { type: String, default: '', maxlength: 500 },
    accessibleParkingRules: { type: String, default: '', maxlength: 500 },
    vipParkingRules: { type: String, default: '', maxlength: 500 },
    overnightRules: { type: String, default: '', maxlength: 500 },
    otherInstructions: { type: String, default: '', maxlength: 1000 },
  },
  { _id: false },
);

// 9. Photo Item Sub-schema
const photoItemSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    caption: { type: String, default: '', trim: true, maxlength: 200 },
    category: { type: String, enum: photoCategoryValues, default: 'Exterior' },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
);

// 10. Reference PDF Sub-schema
const parkingPlanPdfSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    fileSize: { type: Number, required: true, min: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const parkingFacilitySubmissionSchema = new mongoose.Schema(
  {
    submissionReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
      uppercase: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },

    submissionStatus: {
      type: String,
      required: true,
      enum: submissionStatusValues,
      default: 'Draft',
      index: true,
    },

    // 1. Basic Parking Information
    facilityName: { type: String, required: true, trim: true, maxlength: 150 },
    shortDescription: { type: String, default: '', trim: true, maxlength: 250 },
    detailedDescription: { type: String, default: '', trim: true, maxlength: 2000 },
    facilityType: {
      type: String,
      required: true,
      enum: facilityTypeValues,
      default: 'Commercial Parking',
    },
    contactName: { type: String, default: '', trim: true, maxlength: 120 },
    contactPhone: { type: String, default: '', trim: true },
    contactEmail: { type: String, default: '', trim: true, lowercase: true },

    // 2. Location Information
    location: { type: submissionLocationSchema, required: true, default: () => ({}) },

    // 3. Parking Capacity
    capacity: { type: submissionCapacitySchema, required: true, default: () => ({}) },

    // 4. Floor Reference Information
    floors: { type: [floorReferenceSchema], default: [] },

    // 5. Zone Reference Information
    zones: { type: [zoneReferenceSchema], default: [] },

    // 6. Facilities & Features (Amenities)
    amenities: { type: [String], default: [] },

    // 7. Operating Information
    operatingInfo: { type: submissionOperatingSchema, required: true, default: () => ({}) },

    // 8. Pricing Information
    pricing: { type: submissionPricingSchema, required: true, default: () => ({}) },

    // 9. Supported Vehicle Types
    supportedVehicleTypes: { type: [String], default: ['Car', 'Bike'] },

    // 10. Parking Rules and Instructions
    parkingRules: { type: submissionRulesSchema, required: true, default: () => ({}) },

    // 11. Parking Photos
    photos: { type: [photoItemSchema], default: [] },
    primaryImageUrl: { type: String, default: '' },

    // 12. Parking Plan PDF (Reference Material Only - Max 1 PDF)
    parkingPlanPdf: { type: parkingPlanPdfSchema, default: null },

    // 13. Subject and Additional Description
    subject: { type: String, default: '', trim: true, maxlength: 200 },
    additionalDescription: { type: String, default: '', trim: true, maxlength: 2000 },

    // Review & Workflow Metadata
    submittedAt: { type: Date, default: null },
    resubmittedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    adminRemarks: { type: String, default: null, trim: true, maxlength: 2000 },
    requestedChanges: { type: String, default: null, trim: true, maxlength: 2000 },
    rejectionReason: { type: String, default: null, trim: true, maxlength: 1000 },
    approvedAt: { type: Date, default: null },
    officialParkingLotId: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingLot', default: null },
  },
  {
    collection: 'parkingFacilitySubmissions',
    timestamps: true,
  },
);

parkingFacilitySubmissionSchema.index(
  { submissionReference: 1 },
  { name: 'UQ_SubmissionReference', unique: true },
);
parkingFacilitySubmissionSchema.index({ ownerId: 1 }, { name: 'IDX_OwnerSubmissions' });
parkingFacilitySubmissionSchema.index({ submissionStatus: 1 }, { name: 'IDX_Status' });
parkingFacilitySubmissionSchema.index({ submittedAt: -1 }, { name: 'IDX_SubmittedAt' });

export type ParkingFacilitySubmission = InferSchemaType<typeof parkingFacilitySubmissionSchema>;

export const ParkingFacilitySubmissionModel =
  mongoose.models.ParkingFacilitySubmission ??
  mongoose.model<ParkingFacilitySubmission>(
    'ParkingFacilitySubmission',
    parkingFacilitySubmissionSchema,
  );
