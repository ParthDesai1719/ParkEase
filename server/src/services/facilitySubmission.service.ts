import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { AuditLogModel } from '../models/AuditLog.js';
import { NotificationModel, type Notification } from '../models/Notification.js';
import {
  ParkingFacilitySubmissionModel,
  type ParkingFacilitySubmission,
  type facilityTypeValues,
} from '../models/ParkingFacilitySubmission.js';
import { UserModel, type User } from '../models/User.js';
import { RoleModel, type Role } from '../models/Role.js';
import { AppError } from '../utils/AppError.js';
import { emailService } from './email.service.js';
import { normalizeIp } from '../utils/ip.js';
import { emitFacilityStatusUpdate } from '../socket.js';
import { notificationService } from './notification.service.js';
import { env } from '../config/env.js';

const uploadsRoot = fs.existsSync(path.resolve(process.cwd(), 'server', 'uploads'))
  ? path.resolve(process.cwd(), 'server', 'uploads')
  : path.resolve(process.cwd(), 'uploads');
const submissionsUploadsRoot = path.resolve(uploadsRoot, 'submissions');

export interface SubmissionInput {
  facilityName?: string;
  shortDescription?: string;
  detailedDescription?: string;
  facilityType?: (typeof facilityTypeValues)[number];
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  location?: {
    address?: string;
    addressLine1?: string;
    addressLine2?: string;
    areaLocality?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    confirmed?: boolean;
  };
  capacity?: {
    totalSlots?: number;
    breakdown?: {
      car?: number;
      suv?: number;
      bike?: number;
      ev?: number;
      accessible?: number;
      vip?: number;
      other?: number;
    };
  };
  floors?: Array<{
    floorName: string;
    floorNumber: number;
    slotCount: number;
    floorDescription?: string;
    parkingType?: string;
    specialAreas?: string;
    additionalNotes?: string;
  }>;
  zones?: Array<{
    zoneName: string;
    floorName: string;
    slotCount: number;
    zoneType?: string;
    supportedVehicleType?: string;
    description?: string;
    specialPurpose?: string;
    additionalNotes?: string;
  }>;
  amenities?: string[];
  operatingInfo?: {
    isOpen24x7?: boolean;
    openingTime?: string;
    closingTime?: string;
    scheduleType?: string;
    dailySchedules?: Array<{
      day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
      isOpen: boolean;
      openingTime: string;
      closingTime: string;
    }>;
  };
  pricing?: {
    carHourlyRate?: number;
    suvHourlyRate?: number;
    bikeHourlyRate?: number;
    dailyRate?: number;
    overnightRate?: number;
    evChargingRatePerHour?: number;
    otherHourlyRate?: number;
    gracePeriodMinutes?: number;
    minParkingDurationHours?: number;
    maxParkingDurationHours?: number;
    additionalPricingNotes?: string;
  };
  supportedVehicleTypes?: string[];
  parkingRules?: {
    rules?: string;
    entryExitInstructions?: string;
    vehicleRestrictions?: string;
    heightWeightRestrictions?: string;
    evRules?: string;
    accessibleParkingRules?: string;
    vipParkingRules?: string;
    overnightRules?: string;
    otherInstructions?: string;
  };
  photos?: Array<{
    url: string;
    caption?: string;
    category?: (typeof import('../models/ParkingFacilitySubmission.js').photoCategoryValues)[number];
    isPrimary?: boolean;
  }>;
  primaryImageUrl?: string;
  parkingPlanPdf?: {
    url: string;
    fileName: string;
    fileSize: number;
    uploadedAt?: Date;
  } | null;
  subject?: string;
  additionalDescription?: string;
}

export interface GetAdminFacilitySubmissionsFilter {
  status?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

export interface FacilitySubmissionStats {
  total: number;
  submitted: number;
  underReview: number;
  changesRequested: number;
  approved: number;
  rejected: number;
  draft: number;
}

export interface PaginatedAdminSubmissionsResult {
  submissions: ParkingFacilitySubmission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: FacilitySubmissionStats;
}

class FacilitySubmissionService {
  /**
   * Generate unique Submission Reference: PFS-YYYY-XXXXXX
   */
  private generateReference(): string {
    const year = new Date().getFullYear();
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `PFS-${year}-${randomHex}`;
  }

  /**
   * Verify Owner eligibility (must be active user)
   */
  private async verifyOwner(ownerId: string): Promise<User> {
    const user = await (UserModel as mongoose.Model<User>).findById(ownerId).exec();
    if (!user) {
      throw new AppError('Owner account not found.', 404, 'OWNER_NOT_FOUND');
    }
    if (user.accountStatus !== 'Active') {
      throw new AppError(
        'Owner account is not in Active status. Submissions are restricted to approved active owners.',
        403,
        'OWNER_NOT_ACTIVE',
      );
    }
    return user;
  }

  /**
   * Get all facility submissions belonging to an authenticated owner
   */
  public async getOwnerSubmissions(ownerId: string): Promise<ParkingFacilitySubmission[]> {
    await this.verifyOwner(ownerId);
    return (ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>)
      .find({ ownerId: new mongoose.Types.ObjectId(ownerId) })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
  }

  /**
   * Get a single submission by ID with strict ownership validation
   */
  public async getSubmissionById(
    submissionId: string,
    ownerId: string,
    isAdmin = false,
  ): Promise<ParkingFacilitySubmission> {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      throw new AppError('Invalid submission ID format.', 400, 'INVALID_ID');
    }

    const query: Record<string, unknown> = { _id: submissionId };
    if (!isAdmin) {
      query.ownerId = new mongoose.Types.ObjectId(ownerId);
    }

    const submission = await (
      ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
    )
      .findOne(query)
      .populate('ownerId', 'fullName email mobileNumber accountStatus')
      .populate('reviewedBy', 'fullName email')
      .lean()
      .exec();

    if (!submission) {
      throw new AppError(
        'Parking facility submission not found or you do not have permission to access it.',
        404,
        'SUBMISSION_NOT_FOUND',
      );
    }

    return submission;
  }

  /**
   * Create a new Parking Facility Submission in Draft status
   */
  public async createDraft(
    ownerId: string,
    input: SubmissionInput,
    ipAddress?: string,
  ): Promise<ParkingFacilitySubmission> {
    const owner = await this.verifyOwner(ownerId);
    const submissionReference = this.generateReference();

    // Default primary image if photos exist
    let primaryImg = input.primaryImageUrl || '';
    if (!primaryImg && input.photos && input.photos.length > 0) {
      const primaryPhoto = input.photos.find((p) => p.isPrimary);
      primaryImg = primaryPhoto ? primaryPhoto.url : (input.photos[0]?.url ?? '');
    }

    const newSubmission = await ParkingFacilitySubmissionModel.create({
      submissionReference,
      ownerId: new mongoose.Types.ObjectId(ownerId),
      submissionStatus: 'Draft',
      facilityName: input.facilityName || 'Draft Parking Facility',
      shortDescription: input.shortDescription || '',
      detailedDescription: input.detailedDescription || '',
      facilityType: input.facilityType || 'Commercial Parking',
      contactName: input.contactName || owner.fullName,
      contactPhone: input.contactPhone || owner.mobileNumber,
      contactEmail: input.contactEmail || owner.email,
      location: {
        address: input.location?.address || '',
        addressLine1: input.location?.addressLine1 || '',
        addressLine2: input.location?.addressLine2 || '',
        areaLocality: input.location?.areaLocality || '',
        city: input.location?.city || '',
        state: input.location?.state || '',
        postalCode: input.location?.postalCode || '',
        latitude: input.location?.latitude ?? 23.0225,
        longitude: input.location?.longitude ?? 72.5714,
        confirmed: input.location?.confirmed ?? false,
      },
      capacity: {
        totalSlots: input.capacity?.totalSlots || 0,
        breakdown: {
          car: input.capacity?.breakdown?.car || 0,
          suv: input.capacity?.breakdown?.suv || 0,
          bike: input.capacity?.breakdown?.bike || 0,
          ev: input.capacity?.breakdown?.ev || 0,
          accessible: input.capacity?.breakdown?.accessible || 0,
          vip: input.capacity?.breakdown?.vip || 0,
          other: input.capacity?.breakdown?.other || 0,
        },
      },
      floors: input.floors || [],
      zones: input.zones || [],
      amenities: input.amenities || [],
      operatingInfo: {
        isOpen24x7: input.operatingInfo?.isOpen24x7 ?? false,
        openingTime: input.operatingInfo?.openingTime || '08:00',
        closingTime: input.operatingInfo?.closingTime || '22:00',
        scheduleType: input.operatingInfo?.scheduleType || 'Standard',
        dailySchedules: input.operatingInfo?.dailySchedules || [],
      },
      pricing: {
        carHourlyRate: input.pricing?.carHourlyRate || 0,
        suvHourlyRate: input.pricing?.suvHourlyRate || 0,
        bikeHourlyRate: input.pricing?.bikeHourlyRate || 0,
        dailyRate: input.pricing?.dailyRate || 0,
        overnightRate: input.pricing?.overnightRate || 0,
        evChargingRatePerHour: input.pricing?.evChargingRatePerHour || 0,
        otherHourlyRate: input.pricing?.otherHourlyRate || 0,
        gracePeriodMinutes: input.pricing?.gracePeriodMinutes ?? 15,
        minParkingDurationHours: input.pricing?.minParkingDurationHours ?? 1,
        maxParkingDurationHours: input.pricing?.maxParkingDurationHours ?? 24,
        additionalPricingNotes: input.pricing?.additionalPricingNotes || '',
      },
      supportedVehicleTypes: input.supportedVehicleTypes || ['Car', 'Bike'],
      parkingRules: {
        rules: input.parkingRules?.rules || '',
        entryExitInstructions: input.parkingRules?.entryExitInstructions || '',
        vehicleRestrictions: input.parkingRules?.vehicleRestrictions || '',
        heightWeightRestrictions: input.parkingRules?.heightWeightRestrictions || '',
        evRules: input.parkingRules?.evRules || '',
        accessibleParkingRules: input.parkingRules?.accessibleParkingRules || '',
        vipParkingRules: input.parkingRules?.vipParkingRules || '',
        overnightRules: input.parkingRules?.overnightRules || '',
        otherInstructions: input.parkingRules?.otherInstructions || '',
      },
      photos: input.photos || [],
      primaryImageUrl: primaryImg,
      parkingPlanPdf: input.parkingPlanPdf
        ? {
            url: input.parkingPlanPdf.url,
            fileName: input.parkingPlanPdf.fileName,
            fileSize: input.parkingPlanPdf.fileSize,
            uploadedAt: input.parkingPlanPdf.uploadedAt || new Date(),
          }
        : null,
      subject: input.subject || '',
      additionalDescription: input.additionalDescription || '',
    });

    // Immutable Audit Log
    await AuditLogModel.create({
      userId: new mongoose.Types.ObjectId(ownerId),
      roleId: owner.roleId,
      actionCode: 'PARKING_FACILITY_SUBMISSION_CREATED',
      module: 'Parking Management',
      actionTitle: 'Parking Facility Setup Draft Created',
      description: `Owner created draft parking facility submission ${submissionReference} for facility "${newSubmission.facilityName}"`,
      targetCollection: 'parkingFacilitySubmissions',
      targetDocumentId: newSubmission._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        submissionReference,
        facilityName: newSubmission.facilityName,
        totalSlots: newSubmission.capacity?.totalSlots ?? 0,
      },
    });

    return newSubmission.toObject();
  }

  /**
   * Update an existing Draft or Changes Requested submission
   */
  public async updateSubmission(
    ownerId: string,
    submissionId: string,
    input: SubmissionInput,
    ipAddress?: string,
  ): Promise<ParkingFacilitySubmission> {
    const owner = await this.verifyOwner(ownerId);

    const submission = await (
      ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
    ).findOne({
      _id: new mongoose.Types.ObjectId(submissionId),
      ownerId: new mongoose.Types.ObjectId(ownerId),
    });

    if (!submission) {
      throw new AppError(
        'Parking facility submission not found or access denied.',
        404,
        'SUBMISSION_NOT_FOUND',
      );
    }

    if (
      submission.submissionStatus === 'Approved' ||
      submission.submissionStatus === 'Rejected'
    ) {
      throw new AppError(
        `Submissions with status "${submission.submissionStatus}" cannot be modified.`,
        400,
        'SUBMISSION_IMMUTABLE',
      );
    }

    // Apply updates
    if (input.facilityName !== undefined) submission.facilityName = input.facilityName;
    if (input.shortDescription !== undefined) submission.shortDescription = input.shortDescription;
    if (input.detailedDescription !== undefined)
      submission.detailedDescription = input.detailedDescription;
    if (input.facilityType !== undefined) submission.facilityType = input.facilityType;
    if (input.contactName !== undefined) submission.contactName = input.contactName;
    if (input.contactPhone !== undefined) submission.contactPhone = input.contactPhone;
    if (input.contactEmail !== undefined) submission.contactEmail = input.contactEmail;

    if (input.location) {
      if (input.location.address !== undefined) submission.location.address = input.location.address;
      if (input.location.addressLine1 !== undefined)
        submission.location.addressLine1 = input.location.addressLine1;
      if (input.location.addressLine2 !== undefined)
        submission.location.addressLine2 = input.location.addressLine2;
      if (input.location.areaLocality !== undefined)
        submission.location.areaLocality = input.location.areaLocality;
      if (input.location.city !== undefined) submission.location.city = input.location.city;
      if (input.location.state !== undefined) submission.location.state = input.location.state;
      if (input.location.postalCode !== undefined)
        submission.location.postalCode = input.location.postalCode;
      if (input.location.latitude !== undefined)
        submission.location.latitude = input.location.latitude;
      if (input.location.longitude !== undefined)
        submission.location.longitude = input.location.longitude;
      if (input.location.confirmed !== undefined)
        submission.location.confirmed = input.location.confirmed;
    }

    if (input.capacity) {
      if (input.capacity.totalSlots !== undefined) {
        submission.capacity.totalSlots = input.capacity.totalSlots;
      }
      if (input.capacity.breakdown) {
        const b = input.capacity.breakdown;
        if (b.car !== undefined) submission.capacity.breakdown.car = b.car;
        if (b.suv !== undefined) submission.capacity.breakdown.suv = b.suv;
        if (b.bike !== undefined) submission.capacity.breakdown.bike = b.bike;
        if (b.ev !== undefined) submission.capacity.breakdown.ev = b.ev;
        if (b.accessible !== undefined) submission.capacity.breakdown.accessible = b.accessible;
        if (b.vip !== undefined) submission.capacity.breakdown.vip = b.vip;
        if (b.other !== undefined) submission.capacity.breakdown.other = b.other;
      }
    }

    if (input.floors !== undefined) submission.floors = input.floors as typeof submission.floors;
    if (input.zones !== undefined) submission.zones = input.zones as typeof submission.zones;
    if (input.amenities !== undefined) submission.amenities = input.amenities;

    if (input.operatingInfo) {
      if (input.operatingInfo.isOpen24x7 !== undefined)
        submission.operatingInfo.isOpen24x7 = input.operatingInfo.isOpen24x7;
      if (input.operatingInfo.openingTime !== undefined)
        submission.operatingInfo.openingTime = input.operatingInfo.openingTime;
      if (input.operatingInfo.closingTime !== undefined)
        submission.operatingInfo.closingTime = input.operatingInfo.closingTime;
      if (input.operatingInfo.scheduleType !== undefined)
        submission.operatingInfo.scheduleType = input.operatingInfo.scheduleType;
      if (input.operatingInfo.dailySchedules !== undefined)
        submission.operatingInfo.dailySchedules = input.operatingInfo.dailySchedules as typeof submission.operatingInfo.dailySchedules;
    }

    if (input.pricing) {
      const p = input.pricing;
      if (p.carHourlyRate !== undefined) submission.pricing.carHourlyRate = p.carHourlyRate;
      if (p.suvHourlyRate !== undefined) submission.pricing.suvHourlyRate = p.suvHourlyRate;
      if (p.bikeHourlyRate !== undefined) submission.pricing.bikeHourlyRate = p.bikeHourlyRate;
      if (p.dailyRate !== undefined) submission.pricing.dailyRate = p.dailyRate;
      if (p.overnightRate !== undefined) submission.pricing.overnightRate = p.overnightRate;
      if (p.evChargingRatePerHour !== undefined)
        submission.pricing.evChargingRatePerHour = p.evChargingRatePerHour;
      if (p.otherHourlyRate !== undefined) submission.pricing.otherHourlyRate = p.otherHourlyRate;
      if (p.gracePeriodMinutes !== undefined)
        submission.pricing.gracePeriodMinutes = p.gracePeriodMinutes;
      if (p.minParkingDurationHours !== undefined)
        submission.pricing.minParkingDurationHours = p.minParkingDurationHours;
      if (p.maxParkingDurationHours !== undefined)
        submission.pricing.maxParkingDurationHours = p.maxParkingDurationHours;
      if (p.additionalPricingNotes !== undefined)
        submission.pricing.additionalPricingNotes = p.additionalPricingNotes;
    }

    if (input.supportedVehicleTypes !== undefined) {
      submission.supportedVehicleTypes = input.supportedVehicleTypes;
    }

    if (input.parkingRules) {
      const r = input.parkingRules;
      if (r.rules !== undefined) submission.parkingRules.rules = r.rules;
      if (r.entryExitInstructions !== undefined)
        submission.parkingRules.entryExitInstructions = r.entryExitInstructions;
      if (r.vehicleRestrictions !== undefined)
        submission.parkingRules.vehicleRestrictions = r.vehicleRestrictions;
      if (r.heightWeightRestrictions !== undefined)
        submission.parkingRules.heightWeightRestrictions = r.heightWeightRestrictions;
      if (r.evRules !== undefined) submission.parkingRules.evRules = r.evRules;
      if (r.accessibleParkingRules !== undefined)
        submission.parkingRules.accessibleParkingRules = r.accessibleParkingRules;
      if (r.vipParkingRules !== undefined)
        submission.parkingRules.vipParkingRules = r.vipParkingRules;
      if (r.overnightRules !== undefined) submission.parkingRules.overnightRules = r.overnightRules;
      if (r.otherInstructions !== undefined)
        submission.parkingRules.otherInstructions = r.otherInstructions;
    }

    if (input.photos !== undefined) {
      submission.photos = input.photos as typeof submission.photos;
    }

    if (input.primaryImageUrl !== undefined) {
      submission.primaryImageUrl = input.primaryImageUrl;
    } else if (
      (!submission.primaryImageUrl || submission.primaryImageUrl === '') &&
      submission.photos.length > 0
    ) {
      const p = submission.photos.find((item: { isPrimary: boolean; url: string }) => item.isPrimary);
      submission.primaryImageUrl = p ? p.url : (submission.photos[0]?.url ?? '');
    }

    if (input.parkingPlanPdf !== undefined) {
      submission.parkingPlanPdf = input.parkingPlanPdf
        ? {
            url: input.parkingPlanPdf.url,
            fileName: input.parkingPlanPdf.fileName,
            fileSize: input.parkingPlanPdf.fileSize,
            uploadedAt: input.parkingPlanPdf.uploadedAt || new Date(),
          }
        : null;
    }

    if (input.subject !== undefined) submission.subject = input.subject;
    if (input.additionalDescription !== undefined)
      submission.additionalDescription = input.additionalDescription;

    await submission.save();

    // If submission is already submitted or under review, record history and notify administrators
    const wasAlreadySubmitted =
      submission.submissionStatus === 'Submitted' ||
      submission.submissionStatus === 'Under Review';

    if (wasAlreadySubmitted) {
      const ownerName = (owner as any).fullName || 'Owner';
      await notificationService.notifyAdmins({
        title: 'Facility Submission Updated',
        message: `Owner ${ownerName} updated setup details for facility "${submission.facilityName}" (${submission.submissionReference}).`,
        notificationType: 'Parking Facility',
        eventType: 'Parking Facility Updated',
        actionUrl: `/admin/facilities/${submission._id.toString()}`,
        metadata: {
          submissionId: submission._id.toString(),
          submissionReference: submission.submissionReference,
          ownerId: ownerId.toString(),
        },
      });

      try {
        await notificationService.createNotification({
          userId: ownerId,
          notificationType: 'Parking Facility',
          eventType: 'Parking Facility Updated',
          title: 'Facility Proposal Changes Saved',
          message: `Your updates for "${submission.facilityName}" (${submission.submissionReference}) were saved successfully and sent to administrators.`,
          priority: 'Normal',
          actionUrl: `/owner/parking/submissions/${submission._id}`,
          metadata: {
            submissionId: submission._id.toString(),
            submissionReference: submission.submissionReference,
            facilityName: submission.facilityName,
            status: submission.submissionStatus,
          },
        });
      } catch (ownerNotifErr) {
        console.warn('Failed to send owner update notification:', ownerNotifErr);
      }

      emitFacilityStatusUpdate({
        submissionId: submission._id.toString(),
        ownerId: submission.ownerId.toString(),
        status: submission.submissionStatus,
        adminRemarks: submission.adminRemarks,
      });

      try {
        await emailService.sendEmail({
          to: 'parkease@gmail.com',
          subject: `[ParkEase Admin] Facility Setup Updated: ${submission.facilityName} (${submission.submissionReference})`,
          html: `<p>Hello Administrator,</p><p>Parking Owner <strong>${ownerName}</strong> has revised the setup proposal details for <strong>${submission.facilityName}</strong> (Ref: <code>${submission.submissionReference}</code>).</p><p>Current status: <strong>${submission.submissionStatus}</strong></p><p><a href="${env.CLIENT_URL}/admin/facilities/${submission._id}">Review Facility Details</a></p>`,
        });
      } catch {
        // Non-blocking email
      }
    }

    // Audit log
    await AuditLogModel.create({
      userId: new mongoose.Types.ObjectId(ownerId),
      roleId: owner.roleId,
      actionCode: 'PARKING_FACILITY_SUBMISSION_UPDATED',
      module: 'Parking Management',
      actionTitle: wasAlreadySubmitted
        ? 'Submitted Parking Facility Setup Updated by Owner'
        : 'Parking Facility Setup Draft Updated',
      description: `Owner updated parking facility submission ${submission.submissionReference}`,
      targetCollection: 'parkingFacilitySubmissions',
      targetDocumentId: submission._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        submissionReference: submission.submissionReference,
        status: submission.submissionStatus,
      },
    });

    return submission.toObject();
  }

  /**
   * Finalize and submit a Parking Facility Setup Request for Administrator review
   */
  public async submitForReview(
    ownerId: string,
    submissionId: string,
    input?: SubmissionInput,
    ipAddress?: string,
  ): Promise<ParkingFacilitySubmission> {
    const owner = await this.verifyOwner(ownerId);

    // If input is supplied alongside submit request, update first
    if (input) {
      await this.updateSubmission(ownerId, submissionId, input, ipAddress);
    }

    const submission = await (
      ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
    ).findOne({
      _id: new mongoose.Types.ObjectId(submissionId),
      ownerId: new mongoose.Types.ObjectId(ownerId),
    });

    if (!submission) {
      throw new AppError('Submission not found.', 404, 'SUBMISSION_NOT_FOUND');
    }

    if (
      submission.submissionStatus !== 'Draft' &&
      submission.submissionStatus !== 'Changes Requested'
    ) {
      throw new AppError(
        `Only submissions in Draft or Changes Requested status may be submitted for review. Current status: "${submission.submissionStatus}".`,
        400,
        'INVALID_SUBMISSION_STATE',
      );
    }

    // Strict Validation before formal Administrator review submission
    const errors: string[] = [];

    if (!submission.facilityName || submission.facilityName.trim().length < 3) {
      errors.push('Parking facility name is required (minimum 3 characters).');
    }

    if (!submission.contactPhone && !submission.contactEmail) {
      errors.push('At least one contact method (phone or email) is required.');
    }

    if (!submission.location.address && !submission.location.addressLine1) {
      errors.push('Complete facility address is required.');
    }

    if (!submission.location.city || !submission.location.city.trim()) {
      errors.push('City is required.');
    }

    if (!submission.location.state || !submission.location.state.trim()) {
      errors.push('State is required.');
    }

    if (!submission.location.confirmed) {
      errors.push(
        'Physical facility location must be confirmed on the interactive map before submission.',
      );
    }

    if (
      typeof submission.location.latitude !== 'number' ||
      typeof submission.location.longitude !== 'number'
    ) {
      errors.push('Valid latitude and longitude coordinates must be set.');
    }

    if (
      typeof submission.capacity.totalSlots !== 'number' ||
      !Number.isInteger(submission.capacity.totalSlots) ||
      submission.capacity.totalSlots < 1
    ) {
      errors.push('Total parking capacity must be a positive integer of at least 1 slot.');
    }

    // Validate breakdown counts if provided
    if (submission.capacity.breakdown) {
      const b = submission.capacity.breakdown;
      const counts = [
        { name: 'Car', val: b.car },
        { name: 'SUV', val: b.suv },
        { name: 'Bike', val: b.bike },
        { name: 'EV', val: b.ev },
        { name: 'Accessible', val: b.accessible },
        { name: 'VIP', val: b.vip },
        { name: 'Other', val: b.other },
      ];
      for (const item of counts) {
        if (item.val !== undefined && (!Number.isInteger(item.val) || item.val < 0)) {
          errors.push(`${item.name} capacity must be a non-negative integer.`);
        }
      }
    }

    // Floor validation
    if (submission.floors && submission.floors.length > 0) {
      const floorNumbers = submission.floors.map((f: { floorNumber: number }) => f.floorNumber);
      if (new Set(floorNumbers).size !== floorNumbers.length) {
        errors.push('Duplicate floor numbers are not permitted.');
      }

      const floorNames = submission.floors.map((f: { floorName: string }) =>
        f.floorName.trim().toLowerCase(),
      );
      if (new Set(floorNames).size !== floorNames.length) {
        errors.push('Duplicate floor names are not permitted.');
      }

      for (const f of submission.floors) {
        if (!f.floorName || !f.floorName.trim()) {
          errors.push('Every floor must have a valid Floor Name.');
        }
        if (!Number.isInteger(f.slotCount) || f.slotCount < 0) {
          errors.push(`Floor "${f.floorName}" has an invalid slot count. Must be a non-negative integer.`);
        }
      }

      const sumFloorSlots = submission.floors.reduce(
        (acc: number, f: { slotCount: number }) => acc + (f.slotCount || 0),
        0,
      );
      if (sumFloorSlots !== submission.capacity.totalSlots) {
        errors.push(
          `Sum of floor slot counts (${sumFloorSlots}) does not match the submitted total parking capacity (${submission.capacity.totalSlots}). Please align floor slot counts with total capacity.`,
        );
      }
    }

    // Zone validation
    if (submission.zones && submission.zones.length > 0) {
      const validFloorNames = new Set(
        (submission.floors || []).map((f: { floorName: string }) => f.floorName.trim().toLowerCase()),
      );
      const zoneKeys = new Set<string>();
      const floorZoneSums: Record<string, number> = {};

      for (const z of submission.zones) {
        if (!z.zoneName || !z.zoneName.trim()) {
          errors.push('Every zone must have a valid Zone Name.');
        }

        const trimmedFloorName = (z.floorName || '').trim();
        if (
          !trimmedFloorName ||
          (validFloorNames.size > 0 && !validFloorNames.has(trimmedFloorName.toLowerCase()))
        ) {
          errors.push(
            `Zone "${z.zoneName}" references invalid or unlisted floor "${z.floorName}". Zones must be assigned to a declared floor.`,
          );
        }

        const zoneKey = `${trimmedFloorName.toLowerCase()}::${z.zoneName.trim().toLowerCase()}`;
        if (zoneKeys.has(zoneKey)) {
          errors.push(`Duplicate zone name "${z.zoneName}" found on floor "${z.floorName}".`);
        }
        zoneKeys.add(zoneKey);

        if (!Number.isInteger(z.slotCount) || z.slotCount < 0) {
          errors.push(`Zone "${z.zoneName}" has an invalid slot count. Must be a non-negative integer.`);
        } else {
          floorZoneSums[trimmedFloorName.toLowerCase()] =
            (floorZoneSums[trimmedFloorName.toLowerCase()] || 0) + z.slotCount;
        }
      }

      // Check that zone slot sum matches corresponding floor capacity when zone breakdown is provided
      if (submission.floors && submission.floors.length > 0) {
        for (const f of submission.floors) {
          const floorKey = f.floorName.trim().toLowerCase();
          const hasZonesForFloor = submission.zones.some(
            (z: { floorName: string }) => (z.floorName || '').trim().toLowerCase() === floorKey,
          );
          if (hasZonesForFloor) {
            const fZoneSum = floorZoneSums[floorKey] || 0;
            if (fZoneSum !== f.slotCount) {
              errors.push(
                `Total zone slots on floor "${f.floorName}" (${fZoneSum}) must equal the floor capacity (${f.slotCount}) when zone breakdown is provided.`,
              );
            }
          }
        }
      }
    }

    // Pricing & Duration validation
    if (submission.pricing) {
      const p = submission.pricing;
      const rates = [
        { name: 'Car hourly rate', val: p.carHourlyRate },
        { name: 'SUV hourly rate', val: p.suvHourlyRate },
        { name: 'Bike hourly rate', val: p.bikeHourlyRate },
        { name: 'Daily rate', val: p.dailyRate },
        { name: 'Overnight rate', val: p.overnightRate },
        { name: 'EV charging rate', val: p.evChargingRatePerHour },
        { name: 'Other hourly rate', val: p.otherHourlyRate },
      ];
      for (const r of rates) {
        if (r.val !== undefined && (typeof r.val !== 'number' || isNaN(r.val) || r.val < 0)) {
          errors.push(`${r.name} cannot be negative.`);
        }
      }

      if (
        p.gracePeriodMinutes !== undefined &&
        (!Number.isInteger(p.gracePeriodMinutes) || p.gracePeriodMinutes < 0)
      ) {
        errors.push('Grace period must be a non-negative integer.');
      }
      if (
        p.minParkingDurationHours !== undefined &&
        (!Number.isInteger(p.minParkingDurationHours) || p.minParkingDurationHours < 1)
      ) {
        errors.push('Minimum parking duration must be at least 1 hour.');
      }
      if (
        p.maxParkingDurationHours !== undefined &&
        (!Number.isInteger(p.maxParkingDurationHours) ||
          p.maxParkingDurationHours < (p.minParkingDurationHours || 1))
      ) {
        errors.push('Maximum parking duration must be greater than or equal to minimum duration.');
      }
    }

    // Require at least one photo for administrator visual survey
    if (!submission.photos || submission.photos.length === 0) {
      errors.push('At least one physical facility photo is required for administrator review.');
    }

    // Ensure a primary image is designated
    if (!submission.primaryImageUrl) {
      if (submission.photos && submission.photos.length > 0) {
        submission.primaryImageUrl = submission.photos[0]?.url || '';
      } else {
        errors.push('A primary facility image must be designated.');
      }
    }

    if (errors.length > 0) {
      throw new AppError(
        `Submission validation failed: ${errors.join(' ')}`,
        400,
        'VALIDATION_FAILED',
      );
    }

    const isResubmission = submission.submissionStatus === 'Changes Requested';

    if (isResubmission) {
      submission.resubmittedAt = new Date();
      submission.submissionStatus = 'Submitted';
    } else {
      submission.submittedAt = new Date();
      submission.submissionStatus = 'Submitted';
    }

    await submission.save();

    emitFacilityStatusUpdate({
      submissionId: submission._id.toString(),
      ownerId: submission.ownerId.toString(),
      status: 'Submitted',
      reviewedAt: null,
    });

    const actionCode = isResubmission
      ? 'FACILITY_RESUBMITTED'
      : 'FACILITY_SUBMITTED';

    const actionTitle = isResubmission
      ? 'Parking Facility Submission Resubmitted'
      : 'Parking Facility Submission Submitted for Review';

    // Audit Log
    await AuditLogModel.create({
      userId: new mongoose.Types.ObjectId(ownerId),
      roleId: owner.roleId,
      actionCode,
      module: 'Parking Management',
      actionTitle,
      description: `Owner submitted parking facility setup request ${submission.submissionReference} for facility "${submission.facilityName}"`,
      targetCollection: 'parkingFacilitySubmissions',
      targetDocumentId: submission._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        submissionReference: submission.submissionReference,
        facilityName: submission.facilityName,
        totalSlots: submission.capacity.totalSlots,
        isResubmission,
      },
    });

    // In-App Notification for Owner
    try {
      await notificationService.createNotification({
        userId: new mongoose.Types.ObjectId(ownerId),
        notificationType: 'Parking Facility',
        eventType: 'Parking Facility Submitted',
        title: isResubmission
          ? 'Facility Submission Resubmitted'
          : 'Facility Setup Submission Received',
        message: isResubmission
          ? `Your updated parking facility proposal for "${submission.facilityName}" (${submission.submissionReference}) has been resubmitted for Administrator review.`
          : `Your parking facility setup request for "${submission.facilityName}" (${submission.submissionReference}) has been submitted for Administrator review.`,
        priority: 'Normal',
        actionUrl: `/owner/parking/submissions/${submission._id}`,
        metadata: {
          submissionId: submission._id.toString(),
          submissionReference: submission.submissionReference,
          facilityName: submission.facilityName,
          status: 'Submitted',
          isResubmission,
        },
      });
    } catch (notifErr) {
      console.warn('Failed to dispatch owner submission notification:', notifErr);
    }

    // In-App Notification for Administrator(s)
    try {
      await notificationService.notifyAdmins({
        title: isResubmission
          ? 'Parking Facility Resubmitted for Review'
          : 'New Parking Facility Submitted for Review',
        message: `Owner ${owner.fullName} submitted parking facility "${submission.facilityName}" (${submission.submissionReference}, ${submission.capacity.totalSlots} slots) for review and setup.`,
        notificationType: 'Parking Facility',
        eventType: 'Parking Facility Submitted',
        priority: 'Normal',
        actionUrl: `/admin/facilities/${submission._id}`,
        metadata: {
          submissionId: submission._id.toString(),
          submissionReference: submission.submissionReference,
          facilityName: submission.facilityName,
          ownerId: ownerId.toString(),
          totalSlots: submission.capacity.totalSlots,
          status: 'Submitted',
          isResubmission,
        },
      });
    } catch (adminNotifErr) {
      console.warn('Failed to dispatch admin facility submission notifications:', adminNotifErr);
    }

    // Dispatch "Parking Facility Submission Received" Email to Owner (Nodemailer / Mailpit)
    const emailSubject = `ParkEase — Parking Facility Submission Received [${submission.submissionReference}]`;
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #ea580c; margin: 0; font-size: 24px;">ParkEase</h2>
          <p style="color: #64748b; margin-top: 4px; font-size: 13px;">Smart Parking Mobility Platform</p>
        </div>

        <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
          <h3 style="margin: 0 0 8px 0; color: #9a3412; font-size: 16px;">Parking Facility Setup Request Received</h3>
          <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #7c2d12;">
            Hello <strong>${owner.fullName}</strong>, your parking facility submission for <strong>${submission.facilityName}</strong> has been successfully received by our administration team.
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Submission ID:</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #0f172a;">${submission.submissionReference}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Facility Name:</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #0f172a;">${submission.facilityName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Submitted Capacity:</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #0f172a;">${submission.capacity.totalSlots} Slots</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b;">Status:</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #ea580c;">Submitted (Under Administrator Survey)</td>
          </tr>
        </table>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
          <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Next Steps in the Facility Workflow</h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
            <li>Our Administrator will review your submitted facility reference data, capacity counts, and photos.</li>
            <li>If changes are needed, you will receive feedback and an opportunity to update your submission.</li>
            <li>Once approved, the Administrator creates the official Parking Lot, Floors, Zones, and exact Slots in the 2D Layout Designer.</li>
            <li>After official layout publication and activation, your facility will become bookable by drivers.</li>
          </ol>
        </div>

        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          Note: This submission contains reference information only. Official parking layouts and customer activation are administered exclusively by the platform.
        </p>
      </div>
    `;

    void emailService.sendEmail({
      to: owner.email,
      subject: emailSubject,
      html: emailHtml,
      emailType: 'SYSTEM_NOTIFICATION',
    });

    return submission.toObject();
  }

  /**
   * Delete a draft submission (allowed only while in Draft status)
   */
  public async deleteDraft(
    ownerId: string,
    submissionId: string,
    ipAddress?: string,
  ): Promise<void> {
    const owner = await this.verifyOwner(ownerId);

    const submission = await (
      ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
    ).findOne({
      _id: new mongoose.Types.ObjectId(submissionId),
      ownerId: new mongoose.Types.ObjectId(ownerId),
    });

    if (!submission) {
      throw new AppError('Submission not found.', 404, 'SUBMISSION_NOT_FOUND');
    }

    if (submission.submissionStatus !== 'Draft') {
      throw new AppError(
        'Only submissions in Draft status may be deleted.',
        400,
        'CANNOT_DELETE_NON_DRAFT',
      );
    }

    await (
      ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
    ).deleteOne({ _id: new mongoose.Types.ObjectId(submissionId) });

    // Audit log
    await AuditLogModel.create({
      userId: new mongoose.Types.ObjectId(ownerId),
      roleId: owner.roleId,
      actionCode: 'PARKING_FACILITY_SUBMISSION_DELETED',
      module: 'Parking Management',
      actionTitle: 'Parking Facility Draft Deleted',
      description: `Owner deleted draft parking facility submission ${submission.submissionReference || submissionId}`,
      targetCollection: 'parkingFacilitySubmissions',
      targetDocumentId: submission._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        submissionReference: submission.submissionReference,
        facilityName: submission.facilityName,
      },
    });
  }

  /**
   * Stream a private submission file (photo or plan PDF) with strict path traversal & RBAC protection
   */
  public async streamSubmissionFile(
    userId: string,
    roleCode: string,
    filename: string,
  ): Promise<{ resolvedPath: string; mimeType: string }> {
    // Sanitize filename: alphanumeric, dashes, dots
    const safeFilename = path.basename(filename);

    // Look in photos first, then plans
    let targetPath = path.resolve(submissionsUploadsRoot, 'photos', safeFilename);
    if (!fs.existsSync(targetPath)) {
      targetPath = path.resolve(submissionsUploadsRoot, 'plans', safeFilename);
    }

    if (!fs.existsSync(targetPath)) {
      // Also check general owner uploads directory fallback
      targetPath = path.resolve(uploadsRoot, 'owner', safeFilename);
      if (!fs.existsSync(targetPath)) {
        throw new AppError('Requested file was not found on server.', 404, 'FILE_NOT_FOUND');
      }
    }

    // Path traversal check
    if (!targetPath.startsWith(uploadsRoot)) {
      throw new AppError('Access to requested file is forbidden.', 403, 'FORBIDDEN');
    }

    // If not Admin, ensure this file is referenced in a submission owned by this user OR has the owner's userId prefix in filename
    if (roleCode !== 'ADMIN') {
      const isOwnerByPrefix =
        safeFilename.startsWith(`photo-${userId}-`) ||
        safeFilename.startsWith(`plan-${userId}-`);

      let isAuthorized = isOwnerByPrefix;
      if (!isAuthorized) {
        const isOwnerFile = await ParkingFacilitySubmissionModel.exists({
          ownerId: new mongoose.Types.ObjectId(userId),
          $or: [
            { 'photos.url': { $regex: safeFilename } },
            { primaryImageUrl: { $regex: safeFilename } },
            { 'parkingPlanPdf.url': { $regex: safeFilename } },
          ],
        });
        isAuthorized = !!isOwnerFile;
      }

      if (!isAuthorized) {
        throw new AppError(
          'You are not authorized to view this submission file.',
          403,
          'FORBIDDEN',
        );
      }
    }

    const ext = path.extname(safeFilename).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';

    return { resolvedPath: targetPath, mimeType };
  }

  /**
   * =========================================================================
   * ADMINISTRATOR FACILITY REVIEW MODULE METHODS
   * =========================================================================
   */

  /**
   * 1. Get paginated facility submissions for administrator review with filters and stats
   */
  public async getAdminFacilitySubmissions(
    filter: GetAdminFacilitySubmissionsFilter = {},
  ): Promise<PaginatedAdminSubmissionsResult> {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 10));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (filter.status && filter.status !== 'All') {
      query.submissionStatus = filter.status;
    }

    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { facilityName: searchRegex },
        { submissionReference: searchRegex },
        { contactName: searchRegex },
        { contactEmail: searchRegex },
        { 'location.city': searchRegex },
        { 'location.address': searchRegex },
      ];
    }

    const sortField = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;
    const sortCriteria: Record<string, 1 | -1> = { [sortField]: sortOrder };

    const [submissions, total, statsAggregation] = await Promise.all([
      (ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>)
        .find(query)
        .populate('ownerId', 'fullName email mobileNumber accountStatus')
        .populate('reviewedBy', 'fullName email')
        .sort(sortCriteria)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      (ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>).countDocuments(query),
      (ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>).aggregate([
        {
          $group: {
            _id: '$submissionStatus',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats: FacilitySubmissionStats = {
      total: 0,
      submitted: 0,
      underReview: 0,
      changesRequested: 0,
      approved: 0,
      rejected: 0,
      draft: 0,
    };

    for (const item of statsAggregation) {
      const count = item.count || 0;
      stats.total += count;
      if (item._id === 'Submitted') stats.submitted = count;
      else if (item._id === 'Under Review') stats.underReview = count;
      else if (item._id === 'Changes Requested') stats.changesRequested = count;
      else if (item._id === 'Approved') stats.approved = count;
      else if (item._id === 'Rejected') stats.rejected = count;
      else if (item._id === 'Draft') stats.draft = count;
    }

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      submissions,
      total,
      page,
      limit,
      totalPages,
      stats,
    };
  }

  /**
   * 2. Start Review (Submitted -> Under Review)
   */
  public async startReview(
    submissionId: string,
    adminUserId: string,
    adminRoleId?: string,
    ipAddress?: string,
  ): Promise<ParkingFacilitySubmission> {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      throw new AppError('Invalid submission ID format.', 400, 'INVALID_ID');
    }

    const submission = await (
      ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
    ).findById(submissionId);

    if (!submission) {
      throw new AppError('Parking facility submission not found.', 404, 'SUBMISSION_NOT_FOUND');
    }

    if (submission.submissionStatus === 'Draft') {
      throw new AppError(
        'Cannot review a Draft submission. The owner has not submitted it for review yet.',
        400,
        'INVALID_STATUS_TRANSITION',
      );
    }

    if (submission.submissionStatus === 'Approved') {
      throw new AppError(
        'Cannot start review on an already Approved facility submission.',
        400,
        'ALREADY_APPROVED',
      );
    }

    if (submission.submissionStatus === 'Rejected') {
      throw new AppError(
        'Cannot start review on a Rejected facility submission.',
        400,
        'ALREADY_REJECTED',
      );
    }

    submission.submissionStatus = 'Under Review';
    submission.reviewedBy = new mongoose.Types.ObjectId(adminUserId);
    submission.reviewedAt = new Date();
    await submission.save();

    emitFacilityStatusUpdate({
      submissionId: submission._id.toString(),
      ownerId: submission.ownerId.toString(),
      status: 'Under Review',
      reviewedAt: submission.reviewedAt,
      reviewedBy: submission.reviewedBy,
    });

    // Audit Log
    await AuditLogModel.create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      roleId: adminRoleId ? new mongoose.Types.ObjectId(adminRoleId) : null,
      actionCode: 'PARKING_FACILITY_REVIEW_STARTED',
      module: 'Parking Management',
      actionTitle: 'Parking Facility Review Started',
      description: `Administrator started review of facility submission ${submission.submissionReference} ("${submission.facilityName}")`,
      targetCollection: 'parkingFacilitySubmissions',
      targetDocumentId: submission._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        submissionReference: submission.submissionReference,
        facilityName: submission.facilityName,
        ownerId: submission.ownerId.toString(),
      },
    });

    // In-App Notification to Owner
    try {
      await notificationService.createNotification({
        userId: submission.ownerId,
        senderId: adminUserId,
        notificationType: 'Parking Facility',
        eventType: 'Parking Facility Under Review',
        title: 'Facility Submission Under Review',
        message: `An Administrator has started reviewing your parking facility setup request for "${submission.facilityName}" (${submission.submissionReference}).`,
        priority: 'Normal',
        actionUrl: `/owner/parking/submissions/${submission._id}`,
        metadata: {
          submissionId: submission._id.toString(),
          submissionReference: submission.submissionReference,
          facilityName: submission.facilityName,
          status: 'Under Review',
        },
      });
    } catch (notifErr) {
      console.warn('Failed to send review start notification:', notifErr);
    }

    // Email Dispatch to Owner
    const owner = await (UserModel as mongoose.Model<User>).findById(submission.ownerId).select('email fullName');
    if (owner?.email) {
      const emailSubject = `ParkEase — Facility Setup Under Review [${submission.submissionReference}]`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #ea580c; margin: 0; font-size: 24px;">ParkEase</h2>
            <p style="color: #64748b; margin-top: 4px; font-size: 13px;">Smart Parking Mobility Platform</p>
          </div>
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
            <h3 style="margin: 0 0 8px 0; color: #1e40af; font-size: 16px;">Facility Setup Under Review</h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #1e3a8a;">
              Hello <strong>${owner.fullName}</strong>, an Administrator has started formal review of your parking facility setup request for <strong>${submission.facilityName}</strong> (${submission.submissionReference}).
            </p>
          </div>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">Our team is reviewing the submitted capacity counts, floor/zone declarations, and photos. You will receive an update once the review is completed.</p>
        </div>
      `;
      void emailService.sendEmail({
        to: owner.email,
        subject: emailSubject,
        html: emailHtml,
        emailType: 'SYSTEM_NOTIFICATION',
      }).catch((e) => console.warn('Failed to send review email:', e));
    }

    return submission.toObject ? submission.toObject() : submission;
  }

  /**
   * 3. Request Changes (Submitted/Under Review -> Changes Requested)
   */
  public async requestChanges(
    submissionId: string,
    adminUserId: string,
    adminRoleId: string | undefined,
    remarks: string,
    ipAddress?: string,
  ): Promise<ParkingFacilitySubmission> {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      throw new AppError('Invalid submission ID format.', 400, 'INVALID_ID');
    }

    const trimmedRemarks = (remarks || '').trim();
    if (!trimmedRemarks || trimmedRemarks.length < 5) {
      throw new AppError(
        'Administrative remarks explaining the requested changes are required (minimum 5 characters).',
        400,
        'VALIDATION_ERROR',
      );
    }

    const submission = await (
      ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
    ).findById(submissionId);

    if (!submission) {
      throw new AppError('Parking facility submission not found.', 404, 'SUBMISSION_NOT_FOUND');
    }

    if (submission.submissionStatus === 'Draft') {
      throw new AppError('Cannot request changes on a Draft submission.', 400, 'INVALID_STATUS_TRANSITION');
    }

    if (submission.submissionStatus === 'Approved') {
      throw new AppError('Cannot request changes on an already Approved submission.', 400, 'ALREADY_APPROVED');
    }

    if (submission.submissionStatus === 'Rejected') {
      throw new AppError('Cannot request changes on a Rejected submission.', 400, 'ALREADY_REJECTED');
    }

    submission.submissionStatus = 'Changes Requested';
    submission.adminRemarks = trimmedRemarks;
    submission.requestedChanges = trimmedRemarks;
    submission.reviewedBy = new mongoose.Types.ObjectId(adminUserId);
    submission.reviewedAt = new Date();
    await submission.save();

    emitFacilityStatusUpdate({
      submissionId: submission._id.toString(),
      ownerId: submission.ownerId.toString(),
      status: 'Changes Requested',
      reviewedAt: submission.reviewedAt,
      adminRemarks: submission.adminRemarks,
    });

    // Audit Log
    await AuditLogModel.create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      roleId: adminRoleId ? new mongoose.Types.ObjectId(adminRoleId) : null,
      actionCode: 'PARKING_FACILITY_CHANGES_REQUESTED',
      module: 'Parking Management',
      actionTitle: 'Parking Facility Changes Requested',
      description: `Administrator requested changes for facility submission ${submission.submissionReference}: "${trimmedRemarks}"`,
      targetCollection: 'parkingFacilitySubmissions',
      targetDocumentId: submission._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        submissionReference: submission.submissionReference,
        facilityName: submission.facilityName,
        remarks: trimmedRemarks,
        ownerId: submission.ownerId.toString(),
      },
    });

    // In-App Notification to Owner
    try {
      await notificationService.createNotification({
        userId: submission.ownerId,
        senderId: adminUserId,
        notificationType: 'Parking Facility',
        eventType: 'Parking Facility Changes Requested',
        title: 'Facility Setup Changes Requested',
        message: `Administrator requested adjustments for "${submission.facilityName}": "${trimmedRemarks}". Please update and resubmit.`,
        priority: 'High',
        actionUrl: `/owner/parking/submissions/${submission._id}/edit`,
        metadata: {
          submissionId: submission._id.toString(),
          submissionReference: submission.submissionReference,
          facilityName: submission.facilityName,
          adminRemarks: trimmedRemarks,
          status: 'Changes Requested',
        },
      });
    } catch (notifErr) {
      console.warn('Failed to send changes requested notification:', notifErr);
    }

    // Email to Owner
    const owner = await (UserModel as mongoose.Model<User>).findById(submission.ownerId).select('email fullName');
    if (owner?.email) {
      const emailSubject = `ParkEase — Action Required: Changes Requested [${submission.submissionReference}]`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #ea580c; margin: 0; font-size: 24px;">ParkEase</h2>
            <p style="color: #64748b; margin-top: 4px; font-size: 13px;">Smart Parking Mobility Platform</p>
          </div>
          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
            <h3 style="margin: 0 0 8px 0; color: #b45309; font-size: 16px;">Adjustments Required for Your Submission</h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #92400e;">
              Hello <strong>${owner.fullName}</strong>, the Administrator has reviewed your facility setup request for <strong>${submission.facilityName}</strong> and requested adjustments before proceeding.
            </p>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #475569; text-transform: uppercase;">Administrator Feedback:</h4>
            <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.6;">${trimmedRemarks}</p>
          </div>
          <p style="font-size: 14px; color: #475569;">Please log in to your Owner Dashboard, review the details, update the requested fields, and resubmit your application.</p>
        </div>
      `;
      void emailService.sendEmail({
        to: owner.email,
        subject: emailSubject,
        html: emailHtml,
        emailType: 'SYSTEM_NOTIFICATION',
      }).catch((e) => console.warn('Failed to send changes requested email:', e));
    }

    return submission.toObject ? submission.toObject() : submission;
  }

  /**
   * 4. Approve Submission (Submitted/Under Review -> Approved)
   * CRITICAL ARCHITECTURAL BOUNDARY:
   * Approval ONLY approves the staging record. It DOES NOT create ParkingLot, Floors,
   * Zones, Slots, or 2D Layout. Official structures remain 100% reserved for subsequent workflows.
   */
  public async approveSubmission(
    submissionId: string,
    adminUserId: string,
    adminRoleId: string | undefined,
    remarks?: string,
    ipAddress?: string,
  ): Promise<ParkingFacilitySubmission> {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      throw new AppError('Invalid submission ID format.', 400, 'INVALID_ID');
    }

    const submission = await (
      ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
    ).findById(submissionId);

    if (!submission) {
      throw new AppError('Parking facility submission not found.', 404, 'SUBMISSION_NOT_FOUND');
    }

    if (submission.submissionStatus === 'Draft') {
      throw new AppError('Cannot approve a Draft submission.', 400, 'INVALID_STATUS_TRANSITION');
    }

    if (submission.submissionStatus === 'Approved') {
      throw new AppError('Facility submission is already approved.', 400, 'ALREADY_APPROVED');
    }

    if (submission.submissionStatus === 'Rejected') {
      throw new AppError('Cannot approve a Rejected submission.', 400, 'ALREADY_REJECTED');
    }

    submission.submissionStatus = 'Approved';
    submission.approvedAt = new Date();
    submission.reviewedBy = new mongoose.Types.ObjectId(adminUserId);
    submission.reviewedAt = new Date();
    if (remarks && remarks.trim()) {
      submission.adminRemarks = remarks.trim();
    }
    // Strict isolation: officialParkingLotId remains null until official lot provisioning
    submission.officialParkingLotId = null;
    await submission.save();

    emitFacilityStatusUpdate({
      submissionId: submission._id.toString(),
      ownerId: submission.ownerId.toString(),
      status: 'Approved',
      approvedAt: submission.approvedAt,
      adminRemarks: submission.adminRemarks,
    });

    // Audit Log
    await AuditLogModel.create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      roleId: adminRoleId ? new mongoose.Types.ObjectId(adminRoleId) : null,
      actionCode: 'PARKING_FACILITY_APPROVED',
      module: 'Parking Management',
      actionTitle: 'Parking Facility Submission Approved',
      description: `Administrator approved parking facility submission ${submission.submissionReference} ("${submission.facilityName}")`,
      targetCollection: 'parkingFacilitySubmissions',
      targetDocumentId: submission._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        submissionReference: submission.submissionReference,
        facilityName: submission.facilityName,
        totalSlots: submission.capacity.totalSlots,
        ownerId: submission.ownerId.toString(),
      },
    });

    // In-App Notification to Owner
    try {
      await notificationService.createNotification({
        userId: submission.ownerId,
        senderId: adminUserId,
        notificationType: 'Parking Facility',
        eventType: 'Parking Facility Approved',
        title: 'Facility Submission Approved',
        message: `Congratulations! Your parking facility setup request for "${submission.facilityName}" has been approved. Administrator layout design will follow.`,
        priority: 'High',
        actionUrl: `/owner/parking/submissions/${submission._id}`,
        metadata: {
          submissionId: submission._id.toString(),
          submissionReference: submission.submissionReference,
          facilityName: submission.facilityName,
          status: 'Approved',
        },
      });
    } catch (notifErr) {
      console.warn('Failed to send approval notification:', notifErr);
    }

    // Email to Owner
    const owner = await (UserModel as mongoose.Model<User>).findById(submission.ownerId).select('email fullName');
    if (owner?.email) {
      const emailSubject = `ParkEase — Facility Setup Approved [${submission.submissionReference}]`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #ea580c; margin: 0; font-size: 24px;">ParkEase</h2>
            <p style="color: #64748b; margin-top: 4px; font-size: 13px;">Smart Parking Mobility Platform</p>
          </div>
          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
            <h3 style="margin: 0 0 8px 0; color: #15803d; font-size: 16px;">Facility Setup Request Approved!</h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #166534;">
              Hello <strong>${owner.fullName}</strong>, your parking facility survey and setup details for <strong>${submission.facilityName}</strong> (${submission.submissionReference}) have been reviewed and approved by the platform administration.
            </p>
          </div>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">
            <strong>Next Steps:</strong> Approval completes Stage 1. Platform Administrators will independently configure the official parking lot records, map physical floors and slots in the 2D layout designer, and activate driver bookings.
          </p>
        </div>
      `;
      void emailService.sendEmail({
        to: owner.email,
        subject: emailSubject,
        html: emailHtml,
        emailType: 'SYSTEM_NOTIFICATION',
      }).catch((e) => console.warn('Failed to send approval email:', e));
    }

    return submission.toObject ? submission.toObject() : submission;
  }

  /**
   * 5. Reject Submission (Submitted/Under Review -> Rejected)
   */
  public async rejectSubmission(
    submissionId: string,
    adminUserId: string,
    adminRoleId: string | undefined,
    rejectionReason: string,
    remarks?: string,
    ipAddress?: string,
  ): Promise<ParkingFacilitySubmission> {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      throw new AppError('Invalid submission ID format.', 400, 'INVALID_ID');
    }

    const trimmedReason = (rejectionReason || '').trim();
    if (!trimmedReason || trimmedReason.length < 10) {
      throw new AppError(
        'A comprehensive rejection reason is required (minimum 10 characters).',
        400,
        'VALIDATION_ERROR',
      );
    }

    const submission = await (
      ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
    ).findById(submissionId);

    if (!submission) {
      throw new AppError('Parking facility submission not found.', 404, 'SUBMISSION_NOT_FOUND');
    }

    if (submission.submissionStatus === 'Draft') {
      throw new AppError('Cannot reject a Draft submission.', 400, 'INVALID_STATUS_TRANSITION');
    }

    if (submission.submissionStatus === 'Approved') {
      throw new AppError('Cannot reject an already Approved facility submission.', 400, 'ALREADY_APPROVED');
    }

    submission.submissionStatus = 'Rejected';
    submission.rejectionReason = trimmedReason;
    if (remarks && remarks.trim()) {
      submission.adminRemarks = remarks.trim();
    }
    submission.reviewedBy = new mongoose.Types.ObjectId(adminUserId);
    submission.reviewedAt = new Date();
    await submission.save();

    emitFacilityStatusUpdate({
      submissionId: submission._id.toString(),
      ownerId: submission.ownerId.toString(),
      status: 'Rejected',
      reviewedAt: submission.reviewedAt,
      rejectionReason: submission.rejectionReason,
      adminRemarks: submission.adminRemarks,
    });

    // Audit Log
    await AuditLogModel.create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      roleId: adminRoleId ? new mongoose.Types.ObjectId(adminRoleId) : null,
      actionCode: 'PARKING_FACILITY_REJECTED',
      module: 'Parking Management',
      actionTitle: 'Parking Facility Submission Rejected',
      description: `Administrator rejected facility submission ${submission.submissionReference}: "${trimmedReason}"`,
      targetCollection: 'parkingFacilitySubmissions',
      targetDocumentId: submission._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        submissionReference: submission.submissionReference,
        facilityName: submission.facilityName,
        rejectionReason: trimmedReason,
        ownerId: submission.ownerId.toString(),
      },
    });

    // In-App Notification to Owner
    try {
      await notificationService.createNotification({
        userId: submission.ownerId,
        senderId: adminUserId,
        notificationType: 'Parking Facility',
        eventType: 'Parking Facility Rejected',
        title: 'Facility Submission Rejected',
        message: `Your facility setup request for "${submission.facilityName}" was rejected. Reason: ${trimmedReason}`,
        priority: 'High',
        actionUrl: `/owner/parking/submissions/${submission._id}`,
        metadata: {
          submissionId: submission._id.toString(),
          submissionReference: submission.submissionReference,
          facilityName: submission.facilityName,
          rejectionReason: trimmedReason,
          status: 'Rejected',
        },
      });
    } catch (notifErr) {
      console.warn('Failed to send rejection notification:', notifErr);
    }

    // Email to Owner
    const owner = await (UserModel as mongoose.Model<User>).findById(submission.ownerId).select('email fullName');
    if (owner?.email) {
      const emailSubject = `ParkEase — Facility Setup Rejected [${submission.submissionReference}]`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #ea580c; margin: 0; font-size: 24px;">ParkEase</h2>
            <p style="color: #64748b; margin-top: 4px; font-size: 13px;">Smart Parking Mobility Platform</p>
          </div>
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
            <h3 style="margin: 0 0 8px 0; color: #b91c1c; font-size: 16px;">Facility Setup Request Not Approved</h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #991b1b;">
              Hello <strong>${owner.fullName}</strong>, your parking facility setup request for <strong>${submission.facilityName}</strong> (${submission.submissionReference}) was not approved by the platform administration.
            </p>
          </div>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
            <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #475569; text-transform: uppercase;">Rejection Reason:</h4>
            <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.6;">${trimmedReason}</p>
          </div>
        </div>
      `;
      void emailService.sendEmail({
        to: owner.email,
        subject: emailSubject,
        html: emailHtml,
        emailType: 'SYSTEM_NOTIFICATION',
      }).catch((e) => console.warn('Failed to send rejection email:', e));
    }

    return submission.toObject ? submission.toObject() : submission;
  }

  /**
   * 6. Update Administrative Remarks
   */
  public async updateAdminRemarks(
    submissionId: string,
    adminUserId: string,
    remarks: string,
    ipAddress?: string,
  ): Promise<ParkingFacilitySubmission> {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      throw new AppError('Invalid submission ID format.', 400, 'INVALID_ID');
    }

    const submission = await (
      ParkingFacilitySubmissionModel as mongoose.Model<ParkingFacilitySubmission>
    ).findById(submissionId);

    if (!submission) {
      throw new AppError('Parking facility submission not found.', 404, 'SUBMISSION_NOT_FOUND');
    }

    submission.adminRemarks = (remarks || '').trim();
    submission.reviewedBy = new mongoose.Types.ObjectId(adminUserId);
    await submission.save();

    await AuditLogModel.create({
      userId: new mongoose.Types.ObjectId(adminUserId),
      actionCode: 'PARKING_FACILITY_REMARKS_UPDATED',
      module: 'Parking Management',
      actionTitle: 'Parking Facility Remarks Updated',
      description: `Administrator updated remarks on facility submission ${submission.submissionReference}`,
      targetCollection: 'parkingFacilitySubmissions',
      targetDocumentId: submission._id,
      ipAddress: normalizeIp(ipAddress),
      actionStatus: 'Success',
      metadata: {
        submissionReference: submission.submissionReference,
        adminRemarks: submission.adminRemarks,
      },
    });

    return submission.toObject ? submission.toObject() : submission;
  }
}

export const facilitySubmissionService = new FacilitySubmissionService();
