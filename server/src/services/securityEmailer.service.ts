import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  AuditLogModel,
  EmailLogModel,
  ParkingLotModel,
  SecurityStaffAssignmentModel,
  UserModel,
  type AuditLog,
  type EmailLog,
  type ParkingLot,
  type SecurityStaffAssignment,
  type User,
} from '../models/index.js';
import { emailService, generateParkEaseEmailHtml } from './email.service.js';
import { AppError } from '../utils/AppError.js';
import { normalizeIp } from '../utils/ip.js';

export interface AssignedFacilityOwner {
  assignmentId: string;
  parkingLotId: string;
  parkingLotName: string;
  city?: string | undefined;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | undefined;
}

export interface SendSecurityEmailPayload {
  parkingLotId: string;
  subject: string;
  content: string;
}

export interface SecurityEmailHistoryQueryParams {
  page?: number | string | undefined;
  limit?: number | string | undefined;
  search?: string | undefined;
}

class SecurityEmailerService {
  /**
   * Automatically resolves the assigned facility and respective Parking Owner
   * for the authenticated security staff officer
   */
  public async getAssignedOwners(staffUserId: string): Promise<AssignedFacilityOwner[]> {
    const assignments = await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>)
      .find({
        securityStaffId: new mongoose.Types.ObjectId(staffUserId),
        assignmentStatus: 'Active',
      })
      .populate('parkingLotId', '_id parkingName city ownerId')
      .populate('ownerId', '_id fullName email mobileNumber')
      .lean()
      .exec();

    const results: AssignedFacilityOwner[] = [];

    for (const a of assignments) {
      const lot = a.parkingLotId as any;
      let owner = a.ownerId as any;

      if (!lot || !lot._id) continue;

      // If owner wasn't populated from assignment, populate from lot
      if (!owner || !owner.email) {
        owner = await (UserModel as mongoose.Model<User>)
          .findById(lot.ownerId, '_id fullName email mobileNumber')
          .lean()
          .exec();
      }

      if (owner && owner.email) {
        results.push({
          assignmentId: a._id.toString(),
          parkingLotId: lot._id.toString(),
          parkingLotName: lot.parkingName,
          city: lot.city,
          ownerId: owner._id.toString(),
          ownerName: owner.fullName,
          ownerEmail: owner.email,
          ownerPhone: owner.mobileNumber,
        });
      }
    }

    return results;
  }

  /**
   * Send direct operational email to the respective Parking Owner
   */
  public async sendEmailToOwner(params: {
    staffUserId: string;
    payload: SendSecurityEmailPayload;
    ipAddress?: string | undefined;
  }): Promise<{
    emailReference: string;
    ownerName: string;
    ownerEmail: string;
    message: string;
    deliveryStatus: 'Sent' | 'Failed';
  }> {
    const { staffUserId, payload, ipAddress } = params;
    const { parkingLotId, subject, content } = payload;

    if (!parkingLotId || !mongoose.Types.ObjectId.isValid(parkingLotId)) {
      throw new AppError('Valid assigned parking facility is required.', 400, 'INVALID_FACILITY');
    }
    if (!subject || subject.trim().length === 0) {
      throw new AppError('Email subject is required.', 400, 'SUBJECT_REQUIRED');
    }
    if (!content || content.trim().length === 0) {
      throw new AppError('Email message content is required.', 400, 'CONTENT_REQUIRED');
    }

    const staffUser = await (UserModel as mongoose.Model<User>).findById(staffUserId).lean().exec();
    if (!staffUser) {
      throw new AppError('Security Staff account not found.', 401, 'UNAUTHORIZED');
    }

    // Backend Authorization Check: Verify staff is actively assigned to this parking lot
    const assignment = await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>)
      .findOne({
        securityStaffId: new mongoose.Types.ObjectId(staffUserId),
        parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
        assignmentStatus: 'Active',
      })
      .populate('parkingLotId', '_id parkingName ownerId')
      .populate('ownerId', '_id fullName email')
      .lean()
      .exec();

    if (!assignment) {
      throw new AppError(
        'You are not currently assigned to this parking facility.',
        403,
        'FORBIDDEN_FACILITY_ACCESS',
      );
    }

    const lot = assignment.parkingLotId as any;
    let owner = assignment.ownerId as any;

    if (!owner || !owner.email) {
      owner = await (UserModel as mongoose.Model<User>)
        .findById(lot.ownerId, '_id fullName email')
        .lean()
        .exec();
    }

    if (!owner || !owner.email) {
      throw new AppError('Facility Owner contact details not available.', 404, 'OWNER_NOT_FOUND');
    }

    const emailReference = `EML-SEC-${Date.now().toString().slice(-6)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Render branded HTML
    const emailHtml = generateParkEaseEmailHtml({
      title: subject,
      bodyHtml: `<p>Dear <strong>${owner.fullName}</strong>,</p><div>${content}</div>`,
      footerNotice: `Sent directly by On-Duty Security Officer ${staffUser.fullName} at facility "${lot.parkingName}".`,
    });

    let deliveryStatus: 'Sent' | 'Failed' = 'Sent';
    let errorMessage: string | null = null;

    try {
      await emailService.sendEmail({
        to: owner.email,
        subject: `[Security Alert - ${lot.parkingName}] ${subject}`,
        html: emailHtml,
        text: content.replace(/<[^>]*>/g, ''),
      });
    } catch (err: unknown) {
      deliveryStatus = 'Failed';
      errorMessage = err instanceof Error ? err.message : 'Nodemailer send failed';
    }

    // Persist in EmailLog
    try {
      await (EmailLogModel as mongoose.Model<EmailLog>).create({
        emailReference,
        senderId: new mongoose.Types.ObjectId(staffUserId),
        source: 'Security',
        recipientIds: [new mongoose.Types.ObjectId(owner._id)],
        recipientEmails: [owner.email],
        parkingLotId: new mongoose.Types.ObjectId(parkingLotId),
        emailType: 'OWNER_COMMUNICATION',
        recipientCategory: 'ASSIGNED_OWNER',
        recipientCount: 1,
        subject,
        body: content,
        htmlBody: emailHtml,
        deliveryStatus,
        sentAt: deliveryStatus === 'Sent' ? new Date() : null,
        retryCount: 0,
        lastAttemptAt: new Date(),
        failureReason: errorMessage ? errorMessage.slice(0, 500) : null,
      });
    } catch (logErr) {
      console.warn('[SecurityEmailer] Failed to persist email log:', logErr);
    }

    // Record Audit Log
    try {
      await (AuditLogModel as mongoose.Model<AuditLog>).create({
        userId: new mongoose.Types.ObjectId(staffUserId),
        actionCode: 'SECURITY_EMAIL_SENT',
        module: 'Email Management',
        actionTitle: 'Security Officer Dispatched Email to Facility Owner',
        description: `Security Officer ${staffUser.fullName} sent message "${subject}" to Parking Owner ${owner.fullName} (${owner.email}) for lot "${lot.parkingName}".`,
        ipAddress: normalizeIp(ipAddress) || '127.0.0.1',
        actionStatus: deliveryStatus === 'Sent' ? 'Success' : 'Failed',
        metadata: {
          emailReference,
          parkingLotId,
          ownerId: owner._id,
          ownerEmail: owner.email,
          deliveryStatus,
        },
      });
    } catch (auditErr) {
      console.warn('[SecurityEmailer] Failed to persist audit log:', auditErr);
    }

    return {
      emailReference,
      ownerName: owner.fullName,
      ownerEmail: owner.email,
      deliveryStatus,
      message:
        deliveryStatus === 'Sent'
          ? `Email successfully delivered to Facility Owner ${owner.fullName}.`
          : `Email recorded in audit logs (${emailReference}), but mail delivery encountered an issue: ${errorMessage || 'SMTP delivery pending'}. Check Email History.`,
    };
  }

  /**
   * Get communication history sent by this security officer
   */
  public async getHistory(params: {
    staffUserId: string;
    queryParams: SecurityEmailHistoryQueryParams;
  }): Promise<{
    emails: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { staffUserId, queryParams } = params;
    const page = Math.max(1, Number(queryParams.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(queryParams.limit) || 15));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      senderId: new mongoose.Types.ObjectId(staffUserId),
      source: 'Security',
    };

    if (queryParams.search && queryParams.search.trim().length > 0) {
      const regex = new RegExp(queryParams.search.trim(), 'i');
      filter.$or = [
        { subject: { $regex: regex } },
        { emailReference: { $regex: regex } },
        { recipientEmails: { $in: [regex] } },
      ];
    }

    const [emails, total] = await Promise.all([
      (EmailLogModel as mongoose.Model<EmailLog>)
        .find(filter)
        .populate('parkingLotId', 'parkingName city')
        .populate('recipientIds', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      (EmailLogModel as mongoose.Model<EmailLog>).countDocuments(filter).exec(),
    ]);

    return {
      emails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export const securityEmailerService = new SecurityEmailerService();
