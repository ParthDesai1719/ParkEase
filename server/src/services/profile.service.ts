import mongoose from 'mongoose';
import { UserModel, type User } from '../models/User.js';
import { RoleModel, type Role } from '../models/Role.js';
import { OwnerApplicationModel, type OwnerApplication } from '../models/OwnerApplication.js';
import { SecurityStaffAssignmentModel, type SecurityStaffAssignment } from '../models/SecurityStaffAssignment.js';
import { VehicleModel, type Vehicle } from '../models/Vehicle.js';
import { BookingModel, type Booking } from '../models/Booking.js';
import { auditService } from './audit.service.js';
import { otpService } from './otp.service.js';
import { AppError } from '../utils/AppError.js';
import type {
  UpdatePersonalInfoInput,
} from '../validators/profile.validator.js';

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  if (!name || !domain) return email;
  const visible = name.slice(0, Math.min(3, name.length));
  return `${visible}***@${domain}`;
}

export class ProfileService {
  /**
   * Fetch complete profile for the authenticated user with role-specific context.
   */
  public async getProfile(userId: string): Promise<Record<string, unknown>> {
    const userModel = UserModel as unknown as mongoose.Model<User>;
    const user = await userModel.findOne({ _id: userId }).populate('roleId').exec();
    if (!user) {
      throw new AppError('User not found.', 404, 'E009');
    }

    const roleDoc = user.roleId as unknown as Role | null;
    const roleCode = (roleDoc?.roleCode || '').toUpperCase();

    const baseUser = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.roleId,
      roleId: user.roleId,
      profileImage: user.profileImage,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      accountStatus: user.accountStatus,
      emailVerified: user.emailVerified,
      mobileVerified: user.mobileVerified,
      preferredLanguage: user.preferredLanguage,
      timezone: user.timezone,
      lastLogin: user.lastLogin,
      createdAt: (user as unknown as { createdAt?: Date }).createdAt,
      updatedAt: (user as unknown as { updatedAt?: Date }).updatedAt,
    };

    // Role-specific contextual data
    let roleDetails: Record<string, unknown> = {};

    if (roleCode === 'CUSTOMER') {
      const vehicleModel = VehicleModel as unknown as mongoose.Model<Vehicle>;
      const bookingModel = BookingModel as unknown as mongoose.Model<Booking>;
      const [vehicles, totalBookings] = await Promise.all([
        vehicleModel.find({ customerId: user._id, vehicleStatus: 'Active' }).sort({ createdAt: -1 }).exec(),
        bookingModel.countDocuments({ customerId: user._id }),
      ]);
      roleDetails = {
        roleType: 'CUSTOMER',
        vehicles,
        totalBookings,
      };
    } else if (roleCode === 'OWNER' || roleCode === 'PARKING_OWNER') {
      const ownerAppModel = OwnerApplicationModel as unknown as mongoose.Model<OwnerApplication>;
      const application = await ownerAppModel.findOne({ applicantId: user._id })
        .sort({ createdAt: -1 })
        .exec();
      roleDetails = {
        roleType: 'OWNER',
        business: application
          ? {
              applicationReference: application.applicationReference,
              businessName: application.businessName,
              businessType: application.businessType,
              businessAddress: application.businessAddress,
              city: application.city,
              state: application.state,
              postalCode: application.postalCode,
              parkingCapacity: application.parkingCapacity,
              businessDescription: application.businessDescription,
              ownerName: application.ownerName,
              businessEmail: application.businessEmail,
              businessPhone: application.businessPhone,
              applicationStatus: application.applicationStatus,
              adminRemarks: application.adminRemarks,
              submittedAt: application.submittedAt,
            }
          : null,
      };
    } else if (roleCode === 'SECURITY_STAFF' || roleCode === 'SECURITY') {
      const staffModel = SecurityStaffAssignmentModel as unknown as mongoose.Model<SecurityStaffAssignment>;
      const assignment = await staffModel.findOne({
        securityStaffId: user._id,
        assignmentStatus: 'Active',
      })
        .populate('parkingLotId', 'lotName physicalAddress city state postalCode contactPhone')
        .exec();
      roleDetails = {
        roleType: 'SECURITY_STAFF',
        assignment: assignment
          ? {
              assignmentStatus: assignment.assignmentStatus,
              assignedAt: assignment.assignedAt,
              parkingLot: assignment.parkingLotId,
              assignmentReason: assignment.assignmentReason,
            }
          : null,
      };
    } else if (roleCode === 'ADMIN') {
      roleDetails = {
        roleType: 'ADMIN',
        adminId: user._id,
        isSystemAdmin: true,
      };
    }

    return {
      user: baseUser,
      ...roleDetails,
    };
  }

  /**
   * Update permitted personal information.
   * Strictly forbids updating role, account status, email, or mobile directly.
   */
  public async updatePersonalInfo(
    userId: string,
    data: UpdatePersonalInfoInput,
  ): Promise<Record<string, unknown>> {
    const userModel = UserModel as unknown as mongoose.Model<User>;
    const user = await userModel.findOne({ _id: userId }).populate('roleId').exec();
    if (!user) {
      throw new AppError('User not found.', 404, 'E009');
    }

    if (data.fullName !== undefined) {
      user.fullName = data.fullName.trim();
    }
    if (data.profileImage !== undefined) {
      user.profileImage = data.profileImage;
    }
    if (data.dateOfBirth !== undefined) {
      user.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    }
    if (data.gender !== undefined) {
      user.gender = data.gender;
    }
    if (data.preferredLanguage !== undefined) {
      user.preferredLanguage = data.preferredLanguage;
    }
    if (data.timezone !== undefined) {
      user.timezone = data.timezone.trim();
    }

    await user.save();

    // If user is an Owner, check if business info was submitted and update owner application
    const roleDoc = user.roleId as unknown as Role | null;
    const roleCode = (roleDoc?.roleCode || '').toUpperCase();
    if (roleCode === 'OWNER' || roleCode === 'PARKING_OWNER') {
      const businessFields = [
        'businessName',
        'businessDescription',
        'businessAddress',
        'city',
        'state',
        'postalCode',
        'businessEmail',
        'businessPhone',
      ] as const;

      const hasBusinessUpdate = businessFields.some((f) => data[f] !== undefined);
      if (hasBusinessUpdate) {
        const updatePayload: Record<string, unknown> = {};
        for (const f of businessFields) {
          if (data[f] !== undefined) {
            updatePayload[f] = data[f];
          }
        }
        await OwnerApplicationModel.updateOne(
          { applicantId: user._id },
          { $set: updatePayload },
        ).exec();
      }
    }

    await auditService.log({
      userId: user._id as mongoose.Types.ObjectId,
      roleId: (user.roleId as unknown as { _id?: mongoose.Types.ObjectId })?._id ?? null,
      actionCode: 'PROFILE_UPDATED',
      module: 'User Management',
      actionTitle: 'Profile Information Updated',
      description: `User updated personal profile fields: ${Object.keys(data).join(', ')}`,
      targetCollection: 'users',
      targetDocumentId: user._id as mongoose.Types.ObjectId,
      metadata: { updatedFields: Object.keys(data) },
    });

    return this.getProfile(userId);
  }

  /**
   * Request OTP to initiate email address change.
   * Delivered to currently registered email per authoritative specification (finalproject-5.txt:10154).
   */
  public async requestEmailChangeOtp(
    userId: string,
    newEmail: string,
  ): Promise<{ message: string; cooldownSeconds: number; targetEmailMasked: string }> {
    const userModel = UserModel as unknown as mongoose.Model<User>;
    const user = await userModel.findOne({ _id: userId }).exec();
    if (!user) {
      throw new AppError('User not found.', 404, 'E009');
    }

    const normalizedNewEmail = newEmail.trim().toLowerCase();
    if (normalizedNewEmail === user.email.toLowerCase()) {
      throw new AppError(
        'New email address cannot be identical to your current email address.',
        400,
        'E_SAME_EMAIL',
      );
    }

    // Check if new email is already in use by any other user
    const existing = await userModel.findOne({
      _id: { $ne: user._id },
      email: normalizedNewEmail,
      accountStatus: { $ne: 'Deleted' },
    }).exec();

    if (existing) {
      throw new AppError(
        'This email address is already registered to another ParkEase account.',
        409,
        'E_EMAIL_EXISTS',
      );
    }

    const otpResult = await otpService.requestOtp({
      userId: user._id as mongoose.Types.ObjectId,
      email: user.email,
      verificationType: 'CHANGE_EMAIL',
      deliveryMethod: 'Email',
      purposeLabel: 'Email Change Verification',
    });

    return {
      message: `Verification code sent to your registered email (${maskEmail(user.email)}).`,
      cooldownSeconds: otpResult.cooldownSeconds,
      targetEmailMasked: maskEmail(user.email),
    };
  }

  /**
   * Verify OTP and finalize email address update.
   */
  public async verifyEmailChangeOtp(
    userId: string,
    newEmail: string,
    otp: string,
  ): Promise<Record<string, unknown>> {
    const userModel = UserModel as unknown as mongoose.Model<User>;
    const user = await userModel.findOne({ _id: userId }).exec();
    if (!user) {
      throw new AppError('User not found.', 404, 'E009');
    }

    const normalizedNewEmail = newEmail.trim().toLowerCase();
    if (normalizedNewEmail === user.email.toLowerCase()) {
      throw new AppError(
        'New email address cannot be identical to your current email address.',
        400,
        'E_SAME_EMAIL',
      );
    }

    // Uniqueness re-check
    const existing = await userModel.findOne({
      _id: { $ne: user._id },
      email: normalizedNewEmail,
      accountStatus: { $ne: 'Deleted' },
    }).exec();

    if (existing) {
      throw new AppError(
        'This email address is already registered to another ParkEase account.',
        409,
        'E_EMAIL_EXISTS',
      );
    }

    // Verify OTP sent to current registered email
    const otpRecord = await otpService.verifyOtp({
      email: user.email,
      verificationType: 'CHANGE_EMAIL',
      otp,
    });

    // Consume OTP so it cannot be reused
    await otpService.consumeOtp(otpRecord._id as mongoose.Types.ObjectId);

    const oldEmail = user.email;
    user.email = normalizedNewEmail;
    user.emailVerified = true;
    await user.save();

    await auditService.log({
      userId: user._id as mongoose.Types.ObjectId,
      roleId: (user.roleId as unknown as { _id?: mongoose.Types.ObjectId })?._id ?? null,
      actionCode: 'EMAIL_CHANGED',
      module: 'User Management',
      actionTitle: 'Email Address Changed via OTP',
      description: `User changed registered email from ${oldEmail} to ${normalizedNewEmail}`,
      targetCollection: 'users',
      targetDocumentId: user._id as mongoose.Types.ObjectId,
      beforeData: { email: oldEmail },
      afterData: { email: normalizedNewEmail },
    });

    return this.getProfile(userId);
  }

  /**
   * Request OTP to initiate mobile number change.
   * Delivered to currently registered email address per authoritative specification (finalproject-5.txt:10156).
   */
  public async requestMobileChangeOtp(
    userId: string,
    newMobileNumber: string,
  ): Promise<{ message: string; cooldownSeconds: number; targetEmailMasked: string }> {
    const userModel = UserModel as unknown as mongoose.Model<User>;
    const user = await userModel.findOne({ _id: userId }).exec();
    if (!user) {
      throw new AppError('User not found.', 404, 'E009');
    }

    const normalizedNewMobile = newMobileNumber.trim();
    if (normalizedNewMobile === user.mobileNumber) {
      throw new AppError(
        'New mobile number cannot be identical to your current mobile number.',
        400,
        'E_SAME_MOBILE',
      );
    }

    // Check if new mobile number is already taken
    const existing = await userModel.findOne({
      _id: { $ne: user._id },
      mobileNumber: normalizedNewMobile,
      accountStatus: { $ne: 'Deleted' },
    }).exec();

    if (existing) {
      throw new AppError(
        'This mobile number is already registered to another ParkEase account.',
        409,
        'E_MOBILE_EXISTS',
      );
    }

    const otpResult = await otpService.requestOtp({
      userId: user._id as mongoose.Types.ObjectId,
      email: user.email,
      verificationType: 'CHANGE_MOBILE',
      deliveryMethod: 'Email',
      purposeLabel: 'Mobile Number Change Verification',
    });

    return {
      message: `Verification code sent to your registered email (${maskEmail(user.email)}).`,
      cooldownSeconds: otpResult.cooldownSeconds,
      targetEmailMasked: maskEmail(user.email),
    };
  }

  /**
   * Verify OTP and finalize mobile number update.
   */
  public async verifyMobileChangeOtp(
    userId: string,
    newMobileNumber: string,
    otp: string,
  ): Promise<Record<string, unknown>> {
    const userModel = UserModel as unknown as mongoose.Model<User>;
    const user = await userModel.findOne({ _id: userId }).exec();
    if (!user) {
      throw new AppError('User not found.', 404, 'E009');
    }

    const normalizedNewMobile = newMobileNumber.trim();
    if (normalizedNewMobile === user.mobileNumber) {
      throw new AppError(
        'New mobile number cannot be identical to your current mobile number.',
        400,
        'E_SAME_MOBILE',
      );
    }

    // Uniqueness re-check
    const existing = await userModel.findOne({
      _id: { $ne: user._id },
      mobileNumber: normalizedNewMobile,
      accountStatus: { $ne: 'Deleted' },
    }).exec();

    if (existing) {
      throw new AppError(
        'This mobile number is already registered to another ParkEase account.',
        409,
        'E_MOBILE_EXISTS',
      );
    }

    // Verify OTP sent to current registered email
    const otpRecord = await otpService.verifyOtp({
      email: user.email,
      verificationType: 'CHANGE_MOBILE',
      otp,
    });

    await otpService.consumeOtp(otpRecord._id as mongoose.Types.ObjectId);

    const oldMobile = user.mobileNumber;
    user.mobileNumber = normalizedNewMobile;
    user.mobileVerified = true;
    await user.save();

    await auditService.log({
      userId: user._id as mongoose.Types.ObjectId,
      roleId: (user.roleId as unknown as { _id?: mongoose.Types.ObjectId })?._id ?? null,
      actionCode: 'MOBILE_CHANGED',
      module: 'User Management',
      actionTitle: 'Mobile Number Changed via OTP',
      description: `User changed registered mobile from ${oldMobile} to ${normalizedNewMobile}`,
      targetCollection: 'users',
      targetDocumentId: user._id as mongoose.Types.ObjectId,
      beforeData: { mobileNumber: oldMobile },
      afterData: { mobileNumber: normalizedNewMobile },
    });

    return this.getProfile(userId);
  }
}

export const profileService = new ProfileService();
