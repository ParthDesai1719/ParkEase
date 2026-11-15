import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { AuditLogModel } from '../models/AuditLog.js';
import { NotificationModel } from '../models/Notification.js';
import { OwnerApplicationModel, type OwnerApplication } from '../models/OwnerApplication.js';
import { PaymentModel } from '../models/Payment.js';
import { RoleModel, type Role } from '../models/Role.js';
import { UserModel, type User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { auditService } from './audit.service.js';
import { emailService } from './email.service.js';
import { notificationService } from './notification.service.js';

export interface DashboardOverviewMetrics {
  totalOwners: number;
  pendingApprovals: number;
  approvedOwners: number;
  suspendedOwners: number;
}

export interface GetOwnerApplicationsFilter {
  status?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface PaginatedApplicationsResult {
  applications: OwnerApplication[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DocumentPathResult {
  isRemote: boolean;
  url?: string;
  filePath?: string;
  mimeType?: string;
  fileName?: string;
}

export interface PublicRegistrationStatusResult {
  applicationReference: string;
  businessName: string;
  businessType: string;
  city: string;
  state: string;
  parkingCapacity: number;
  applicationStatus: string;
  registrationFeeAmount: number;
  paymentStatus: string;
  paymentReference: string | null;
  submittedAt: Date;
  updatedAt: Date;
  adminRemarks: string | null;
  rejectionReason: string | null;
  hasIdentityProof: boolean;
  hasBusinessLicense: boolean;
  hasPropertyProof: boolean;
  parkingImagesCount: number;
}

export interface ApproveApplicationParams {
  id: string;
  adminUserId: string;
  adminRoleId?: string | null | undefined;
  remarks?: string | null | undefined;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export interface RejectApplicationParams {
  id: string;
  adminUserId: string;
  adminRoleId?: string | null | undefined;
  rejectionReason: string;
  remarks?: string | null | undefined;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

class AdminService {
  /**
   * Derive real dashboard metrics from canonical models.
   */
  public async getDashboardOverview(): Promise<DashboardOverviewMetrics> {
    // Locate the canonical Parking Owner role (roleCode: 'OWNER')
    const ownerRole = await (RoleModel as mongoose.Model<Role>)
      .findOne({ roleCode: 'OWNER', isActive: true })
      .lean()
      .exec();

    const ownerRoleId = ownerRole?._id;

    const [totalOwners, pendingApprovals, approvedOwners, suspendedOwners] = await Promise.all([
      ownerRoleId
        ? (UserModel as mongoose.Model<User>).countDocuments({ roleId: ownerRoleId }).exec()
        : 0,
      OwnerApplicationModel.countDocuments({ applicationStatus: 'Pending Review' }).exec(),
      OwnerApplicationModel.countDocuments({ applicationStatus: 'Approved' }).exec(),
      ownerRoleId
        ? (UserModel as mongoose.Model<User>)
            .countDocuments({ roleId: ownerRoleId, accountStatus: 'Suspended' })
            .exec()
        : 0,
    ]);

    return {
      totalOwners,
      pendingApprovals,
      approvedOwners,
      suspendedOwners,
    };
  }

  /**
   * Retrieve real owner applications with search, status filtering, and pagination.
   */
  public async getOwnerApplications(
    filter: GetOwnerApplicationsFilter,
  ): Promise<PaginatedApplicationsResult> {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(filter.limit) || 10));
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {};

    if (filter.status && filter.status !== 'All') {
      query.applicationStatus = filter.status;
    }

    if (filter.search && filter.search.trim()) {
      const escapedSearch = filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      query.$or = [
        { applicationReference: searchRegex },
        { businessName: searchRegex },
        { ownerName: searchRegex },
        { businessEmail: searchRegex },
        { city: searchRegex },
      ];
    }

    // Ensure Payment model is loaded for populate
    void PaymentModel;

    const appModel = OwnerApplicationModel as mongoose.Model<OwnerApplication>;

    const [applications, total] = await Promise.all([
      appModel
        .find(query)
        .sort({ submittedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('paymentId', 'paymentReference amount paymentStatus paymentMethod createdAt')
        .populate('reviewedBy', 'fullName email')
        .lean()
        .exec(),
      appModel.countDocuments(query).exec(),
    ]);

    return {
      applications: applications as unknown as OwnerApplication[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieve single application detail with populated applicant and payment records.
   * Optionally logs OWNER_APPLICATION_REVIEW_STARTED audit log if admin opens a Pending Review application.
   */
  public async getOwnerApplicationById(id: string, adminUserId?: string): Promise<OwnerApplication> {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query: Record<string, unknown> = isObjectId
      ? { $or: [{ _id: id }, { applicationReference: id }] }
      : { applicationReference: id };

    // Ensure Payment model is loaded for populate
    void PaymentModel;

    const application = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne(query)
      .populate('applicantId', 'fullName email mobileNumber accountStatus emailVerified mobileVerified createdAt')
      .populate('paymentId', 'paymentReference amount paymentStatus paymentMethod createdAt currency')
      .populate('reviewedBy', 'fullName email')
      .lean()
      .exec();

    if (!application) {
      throw new AppError('Owner application not found.', 404, 'E002');
    }

    if (adminUserId && application.applicationStatus === 'Pending Review') {
      try {
        const alreadyLogged = await AuditLogModel.exists({
          targetDocumentId: application._id,
          actionCode: 'OWNER_APPLICATION_REVIEW_STARTED',
        });

        if (!alreadyLogged) {
          await auditService.log({
            userId: new mongoose.Types.ObjectId(adminUserId),
            actionCode: 'OWNER_APPLICATION_REVIEW_STARTED',
            module: 'Owner Application Management',
            actionTitle: 'Owner Application Review Started',
            description: `Administrator opened and began reviewing application ${application.applicationReference}.`,
            targetCollection: 'ownerApplications',
            targetDocumentId: application._id as mongoose.Types.ObjectId,
            beforeData: { applicationStatus: application.applicationStatus },
            afterData: { applicationStatus: application.applicationStatus },
            metadata: {
              applicationReference: application.applicationReference,
              businessName: application.businessName,
            },
            actionStatus: 'Success',
          });
        }
      } catch (auditErr) {
        console.error('Failed to log review started audit:', auditErr);
      }
    }

    return application as unknown as OwnerApplication;
  }

  /**
   * Approve an eligible Pending Review application.
   * Promotes applicant to canonical Parking Owner role and activates account.
   * Does NOT create a Parking Lot or facility.
   */
  public async approveOwnerApplication(params: ApproveApplicationParams): Promise<OwnerApplication> {
    const isObjectId = mongoose.Types.ObjectId.isValid(params.id);
    const query: Record<string, unknown> = isObjectId
      ? { $or: [{ _id: params.id }, { applicationReference: params.id }] }
      : { applicationReference: params.id };

    const application = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne(query)
      .exec();

    if (!application) {
      throw new AppError('Owner application not found.', 404, 'E002');
    }

    // Duplicate action and state eligibility check
    if (application.applicationStatus === 'Approved') {
      throw new AppError('Application is already approved and cannot be approved again.', 400, 'E040');
    }

    if (application.applicationStatus === 'Rejected') {
      throw new AppError('Application has already been rejected and cannot subsequently be approved.', 400, 'E040');
    }

    if (application.applicationStatus !== 'Pending Review' && application.applicationStatus !== 'Submitted') {
      throw new AppError(
        `Application is in '${application.applicationStatus}' status and is not eligible for approval.`,
        400,
        'E040',
      );
    }

    // 1. Locate canonical Parking Owner role (roleCode: 'OWNER')
    const ownerRole = await (RoleModel as mongoose.Model<Role>)
      .findOne({ roleCode: 'OWNER', isActive: true })
      .exec();

    if (!ownerRole) {
      throw new AppError('Canonical Parking Owner role was not found in the system.', 500, 'E000');
    }

    const adminObjectId = new mongoose.Types.ObjectId(params.adminUserId);

    // 2. Update Application State
    const previousStatus = application.applicationStatus;
    application.applicationStatus = 'Approved';
    application.reviewedBy = adminObjectId;
    application.reviewedAt = new Date();
    if (params.remarks !== undefined) {
      application.adminRemarks = params.remarks ? params.remarks.trim().slice(0, 1000) : null;
    }

    await application.save();

    // 3. Promote Applicant User to canonical Parking Owner role and activate account
    const applicant = await (UserModel as mongoose.Model<User>).findById(application.applicantId).exec();
    if (applicant) {
      applicant.roleId = ownerRole._id as mongoose.Types.ObjectId;
      applicant.accountStatus = 'Active';
      await applicant.save();
    }

    // 4. Create In-App Notification using canonical event name
    try {
      await notificationService.createNotification({
        userId: application.applicantId,
        senderId: adminObjectId,
        notificationType: 'Parking Owner Registration',
        eventType: 'Parking Owner Application Approved',
        title: 'Parking Owner Application Approved',
        message: `Congratulations! Your application for "${application.businessName}" has been approved. You now have access to the Parking Owner Dashboard.`,
        priority: 'High',
        actionUrl: '/owner/dashboard',
        metadata: {
          applicationReference: application.applicationReference,
          businessName: application.businessName,
          status: 'Approved',
        },
      });
    } catch (notifErr) {
      console.error('Failed to create in-app approval notification:', notifErr);
    }

    // 5. Create Audit Log Entry
    await auditService.log({
      userId: adminObjectId,
      roleId: params.adminRoleId ? new mongoose.Types.ObjectId(params.adminRoleId) : null,
      actionCode: 'OWNER_APPLICATION_APPROVED',
      module: 'Owner Application Management',
      actionTitle: 'Parking Owner Application Approved',
      description: `Application ${application.applicationReference} for "${application.businessName}" was approved by Administrator.`,
      targetCollection: 'ownerApplications',
      targetDocumentId: application._id as mongoose.Types.ObjectId,
      beforeData: { applicationStatus: previousStatus },
      afterData: { applicationStatus: 'Approved', reviewedAt: application.reviewedAt },
      metadata: {
        applicationReference: application.applicationReference,
        applicantId: application.applicantId.toString(),
        businessName: application.businessName,
      },
      ipAddress: params.ipAddress,
      deviceInfo: params.userAgent,
      actionStatus: 'Success',
    });

    // 6. Send Approval Email via existing EmailService
    const recipientEmail = application.businessEmail || applicant?.email;
    if (recipientEmail) {
      try {
        await emailService.sendEmail({
          to: recipientEmail,
          subject: 'ParkEase — Parking Owner Application Approved',
          text: `Dear ${application.ownerName},\n\nCongratulations! Your application for "${application.businessName}" (Reference: ${application.applicationReference}) has been approved by the Administrator.\n\nYour account has been activated with the Parking Owner role. You can now log in to ParkEase to access your Parking Owner Dashboard.\n\nBest regards,\nThe ParkEase Team`,
          html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #ea580c; margin-top: 0;">Application Approved</h2>
            <p>Dear <strong>${application.ownerName}</strong>,</p>
            <p>We are pleased to inform you that your parking owner registration for <strong>${application.businessName}</strong> (Reference: <code>${application.applicationReference}</code>) has been <strong>approved</strong> by the Administrator.</p>
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #16a34a;">
              <p style="margin: 0; font-weight: bold; color: #16a34a;">Status: Approved &amp; Active</p>
              <p style="margin: 6px 0 0 0; font-size: 14px; color: #64748b;">You now have full access to the Parking Owner Dashboard.</p>
            </div>
            <p>You can now log in to the ParkEase platform with your registered credentials to manage your business profile.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">This is an automated notification from ParkEase Platform Administration.</p>
          </div>`,
          emailType: 'OWNER_REGISTRATION',
          senderId: adminObjectId,
        });
      } catch (emailErr) {
        console.error('Failed to send approval email:', emailErr);
      }
    }

    return this.getOwnerApplicationById(application._id.toString());
  }

  /**
   * Reject an eligible Pending Review application.
   * Requires mandatory rejectionReason (<= 500 chars).
   * Keeps applicant role unchanged.
   */
  public async rejectOwnerApplication(params: RejectApplicationParams): Promise<OwnerApplication> {
    const isObjectId = mongoose.Types.ObjectId.isValid(params.id);
    const query: Record<string, unknown> = isObjectId
      ? { $or: [{ _id: params.id }, { applicationReference: params.id }] }
      : { applicationReference: params.id };

    const application = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne(query)
      .exec();

    if (!application) {
      throw new AppError('Owner application not found.', 404, 'E002');
    }

    // Duplicate action and state eligibility check
    if (application.applicationStatus === 'Rejected') {
      throw new AppError('Application is already rejected and cannot be rejected again.', 400, 'E040');
    }

    if (application.applicationStatus === 'Approved') {
      throw new AppError('Application has already been approved and cannot subsequently be rejected.', 400, 'E040');
    }

    if (application.applicationStatus !== 'Pending Review' && application.applicationStatus !== 'Submitted') {
      throw new AppError(
        `Application is in '${application.applicationStatus}' status and is not eligible for rejection.`,
        400,
        'E040',
      );
    }

    // Validate rejection reason
    const trimmedReason = params.rejectionReason?.trim();
    if (!trimmedReason) {
      throw new AppError('Rejection reason is required.', 400, 'E001');
    }

    if (trimmedReason.length > 500) {
      throw new AppError('Rejection reason cannot exceed 500 characters.', 400, 'E001');
    }

    const adminObjectId = new mongoose.Types.ObjectId(params.adminUserId);

    // 1. Update Application State
    const previousStatus = application.applicationStatus;
    application.applicationStatus = 'Rejected';
    application.rejectionReason = trimmedReason;
    application.reviewedBy = adminObjectId;
    application.reviewedAt = new Date();
    if (params.remarks !== undefined) {
      application.adminRemarks = params.remarks ? params.remarks.trim().slice(0, 1000) : null;
    }

    await application.save();

    // Applicant user role remains unchanged

    // 2. Create In-App Notification using canonical event name
    try {
      await notificationService.createNotification({
        userId: application.applicantId,
        senderId: adminObjectId,
        notificationType: 'Parking Owner Registration',
        eventType: 'Parking Owner Application Rejected',
        title: 'Parking Owner Application Rejected',
        message: `Your parking owner application for "${application.businessName}" was rejected. Reason: ${trimmedReason}`,
        priority: 'High',
        actionUrl: '/owner/registration-status',
        metadata: {
          applicationReference: application.applicationReference,
          businessName: application.businessName,
          rejectionReason: trimmedReason,
          status: 'Rejected',
        },
      });
    } catch (notifErr) {
      console.error('Failed to create in-app rejection notification:', notifErr);
    }

    // 3. Create Audit Log Entry
    await auditService.log({
      userId: adminObjectId,
      roleId: params.adminRoleId ? new mongoose.Types.ObjectId(params.adminRoleId) : null,
      actionCode: 'OWNER_APPLICATION_REJECTED',
      module: 'Owner Application Management',
      actionTitle: 'Parking Owner Application Rejected',
      description: `Application ${application.applicationReference} was rejected. Reason: ${trimmedReason}`,
      targetCollection: 'ownerApplications',
      targetDocumentId: application._id as mongoose.Types.ObjectId,
      beforeData: { applicationStatus: previousStatus },
      afterData: { applicationStatus: 'Rejected', rejectionReason: trimmedReason, reviewedAt: application.reviewedAt },
      metadata: {
        applicationReference: application.applicationReference,
        applicantId: application.applicantId.toString(),
        businessName: application.businessName,
        rejectionReason: trimmedReason,
      },
      ipAddress: params.ipAddress,
      deviceInfo: params.userAgent,
      actionStatus: 'Success',
    });

    // 4. Send Rejection Email via existing EmailService
    const recipientEmail = application.businessEmail;
    if (recipientEmail) {
      try {
        await emailService.sendEmail({
          to: recipientEmail,
          subject: 'ParkEase — Update Regarding Your Parking Owner Application',
          text: `Dear ${application.ownerName},\n\nThank you for submitting your parking owner application for "${application.businessName}" (Reference: ${application.applicationReference}).\n\nAfter review, the Administrator was unable to approve your application for the following reason:\n\n${trimmedReason}\n\nIf you have any questions or wish to clarify details, please contact platform support.\n\nBest regards,\nThe ParkEase Team`,
          html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #dc2626; margin-top: 0;">Application Status Update</h2>
            <p>Dear <strong>${application.ownerName}</strong>,</p>
            <p>Thank you for your interest in partnering with ParkEase. After reviewing your application for <strong>${application.businessName}</strong> (Reference: <code>${application.applicationReference}</code>), the Administrator was unable to approve your registration at this time.</p>
            <div style="background-color: #fef2f2; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 0; font-weight: bold; color: #dc2626;">Reason for Rejection:</p>
              <p style="margin: 6px 0 0 0; font-size: 14px; color: #7f1d1d;">${trimmedReason}</p>
            </div>
            <p>If you believe this was in error or if you have questions regarding the requirements, please contact our support team.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">This is an automated notification from ParkEase Platform Administration.</p>
          </div>`,
          emailType: 'OWNER_REGISTRATION',
          senderId: adminObjectId,
        });
      } catch (emailErr) {
        console.error('Failed to send rejection email:', emailErr);
      }
    }

    return this.getOwnerApplicationById(application._id.toString());
  }

  /**
   * Update administrative remarks on an Owner Application.
   */
  public async updateAdminRemarks(params: {
    id: string;
    remarks: string;
    adminUserId: string;
    ipAddress?: string | null | undefined;
    userAgent?: string | null | undefined;
  }): Promise<OwnerApplication> {
    const isObjectId = mongoose.Types.ObjectId.isValid(params.id);
    const query: Record<string, unknown> = isObjectId
      ? { $or: [{ _id: params.id }, { applicationReference: params.id }] }
      : { applicationReference: params.id };

    const application = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne(query)
      .exec();

    if (!application) {
      throw new AppError('Owner application not found.', 404, 'E002');
    }

    const trimmedRemarks = (params.remarks || '').trim();
    if (trimmedRemarks.length > 1000) {
      throw new AppError('Administrative remarks cannot exceed 1000 characters.', 400, 'E003');
    }

    application.adminRemarks = trimmedRemarks || null;
    const adminObjectId = new mongoose.Types.ObjectId(params.adminUserId);

    if (!application.reviewedBy) {
      application.reviewedBy = adminObjectId;
    }
    if (!application.reviewedAt) {
      application.reviewedAt = new Date();
    }

    await (application as mongoose.Document).save();

    if (application.applicationStatus === 'Pending Review') {
      try {
        const alreadyLogged = await AuditLogModel.exists({
          targetDocumentId: application._id,
          actionCode: 'OWNER_APPLICATION_REVIEW_STARTED',
        });

        if (!alreadyLogged) {
          await auditService.log({
            userId: adminObjectId,
            actionCode: 'OWNER_APPLICATION_REVIEW_STARTED',
            module: 'Owner Application Management',
            actionTitle: 'Owner Application Review Started',
            description: `Administrator opened and began reviewing application ${application.applicationReference}.`,
            targetCollection: 'ownerApplications',
            targetDocumentId: application._id as mongoose.Types.ObjectId,
            beforeData: { applicationStatus: application.applicationStatus },
            afterData: { applicationStatus: application.applicationStatus },
            metadata: {
              applicationReference: application.applicationReference,
              businessName: application.businessName,
            },
            ipAddress: params.ipAddress,
            deviceInfo: params.userAgent,
            actionStatus: 'Success',
          });
        }
      } catch (auditErr) {
        console.error('Failed to check/log review started audit on remarks update:', auditErr);
      }
    }

    return this.getOwnerApplicationById(application._id.toString());
  }

  /**
   * Securely retrieve the file path / remote URL for an applicant's submitted document.
   * Strictly enforces path traversal protection and verifies storage integrity.
   */
  public async getOwnerApplicationDocumentPath(
    applicationId: string,
    docType: string,
    index?: number,
  ): Promise<DocumentPathResult> {
    const isObjectId = mongoose.Types.ObjectId.isValid(applicationId);
    const query: Record<string, unknown> = isObjectId
      ? { $or: [{ _id: applicationId }, { applicationReference: applicationId }] }
      : { applicationReference: applicationId };

    const application = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne(query)
      .exec();

    if (!application) {
      throw new AppError('Owner application not found.', 404, 'E002');
    }

    let targetUrlOrPath: string | undefined;

    switch (docType) {
      case 'identityProof':
        targetUrlOrPath = application.identityProofUrl;
        break;
      case 'businessLicense':
        targetUrlOrPath = application.businessLicenseUrl;
        break;
      case 'propertyProof':
        targetUrlOrPath = application.propertyProofUrl;
        break;
      case 'parkingImage': {
        const imgIndex = typeof index === 'number' ? index : 0;
        if (Array.isArray(application.parkingImageUrls) && application.parkingImageUrls[imgIndex]) {
          targetUrlOrPath = application.parkingImageUrls[imgIndex];
        }
        break;
      }
      default:
        throw new AppError(`Invalid document type: ${docType}`, 400, 'E001');
    }

    if (!targetUrlOrPath || !targetUrlOrPath.trim()) {
      throw new AppError('Requested document has not been uploaded for this application.', 404, 'DOCUMENT_NOT_FOUND');
    }

    const trimmed = targetUrlOrPath.trim();

    // 1. Remote or CDN URL handling
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return {
        isRemote: true,
        url: trimmed,
      };
    }

    // 2. Local file path resolution & path traversal safety
    const uploadsRoot = fs.existsSync(path.resolve(process.cwd(), 'server', 'uploads'))
      ? path.resolve(process.cwd(), 'server', 'uploads')
      : path.resolve(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadsRoot)) {
      fs.mkdirSync(uploadsRoot, { recursive: true });
    }
    const ownerUploadsDir = path.resolve(uploadsRoot, 'owner');
    if (!fs.existsSync(ownerUploadsDir)) {
      fs.mkdirSync(ownerUploadsDir, { recursive: true });
    }

    let relPath = trimmed;
    if (relPath.startsWith('server/uploads/')) {
      relPath = relPath.slice('server/uploads/'.length);
    } else if (relPath.startsWith('uploads/')) {
      relPath = relPath.slice('uploads/'.length);
    } else if (relPath.startsWith('/uploads/')) {
      relPath = relPath.slice('/uploads/'.length);
    }

    let resolvedFile = path.resolve(uploadsRoot, relPath);
    if (!fs.existsSync(resolvedFile)) {
      const fallbackFile = path.resolve(ownerUploadsDir, path.basename(trimmed));
      if (fs.existsSync(fallbackFile)) {
        resolvedFile = fallbackFile;
      }
    }

    // Path traversal check: must stay within uploads directory
    if (!resolvedFile.startsWith(uploadsRoot)) {
      throw new AppError('Access denied: Invalid file path traversal attempt.', 403, 'FORBIDDEN');
    }

    if (!fs.existsSync(resolvedFile)) {
      throw new AppError('Document file not found on storage server.', 404, 'DOCUMENT_NOT_FOUND');
    }

    const ext = path.extname(resolvedFile).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.svg') mimeType = 'image/svg+xml';

    return {
      isRemote: false,
      filePath: resolvedFile,
      mimeType,
      fileName: path.basename(resolvedFile),
    };
  }

  /**
   * Public / Owner lookup for Registration Status by application reference or registered mobile number.
   * Returns sanitized, non-sensitive information matching Page 5B specifications.
   */
  public async getPublicRegistrationStatus(query: string): Promise<PublicRegistrationStatusResult> {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      throw new AppError('Please provide an application reference ID or registered mobile number.', 400, 'E001');
    }

    // Ensure Payment model is loaded for populate
    void PaymentModel;

    const normalizedPhone = trimmed.startsWith('+91')
      ? trimmed
      : trimmed.length === 10 && /^\d+$/.test(trimmed)
      ? `+91${trimmed}`
      : trimmed;

    const filter: Record<string, unknown> = {
      $or: [
        { applicationReference: { $regex: new RegExp(`^${trimmed}$`, 'i') } },
        { businessPhone: normalizedPhone },
      ],
    };

    const application = await (OwnerApplicationModel as mongoose.Model<OwnerApplication>)
      .findOne(filter)
      .populate('paymentId', 'paymentReference amount paymentStatus paymentMethod createdAt currency')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!application) {
      throw new AppError('No application found for the provided reference number or mobile number.', 404, 'APPLICATION_NOT_FOUND');
    }

    const payment = application.paymentId as unknown as { paymentStatus?: string; paymentReference?: string } | null;

    return {
      applicationReference: application.applicationReference,
      businessName: application.businessName,
      businessType: application.businessType,
      city: application.city,
      state: application.state,
      parkingCapacity: application.parkingCapacity,
      applicationStatus: application.applicationStatus,
      registrationFeeAmount: application.registrationFeeAmount,
      paymentStatus: payment?.paymentStatus || 'PENDING',
      paymentReference: payment?.paymentReference || null,
      submittedAt: application.submittedAt || application.createdAt,
      updatedAt: application.updatedAt,
      adminRemarks: application.adminRemarks ?? null,
      rejectionReason: application.applicationStatus === 'Rejected' ? (application.rejectionReason ?? null) : null,
      hasIdentityProof: !!application.identityProofUrl,
      hasBusinessLicense: !!application.businessLicenseUrl,
      hasPropertyProof: !!application.propertyProofUrl,
      parkingImagesCount: Array.isArray(application.parkingImageUrls) ? application.parkingImageUrls.length : 0,
    };
  }
}

export const adminService = new AdminService();


