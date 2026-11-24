import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  AuditLogModel,
  BookingModel,
  EmailLogModel,
  ParkingLotModel,
  SecurityStaffAssignmentModel,
  UserModel,
  type AuditLog,
  type Booking,
  type EmailLog,
  type ParkingLot,
  type SecurityStaffAssignment,
  type User,
} from '../models/index.js';
import { emailService, generateParkEaseEmailHtml } from './email.service.js';
import { AppError } from '../utils/AppError.js';
import { normalizeIp } from '../utils/ip.js';

export type OwnerRecipientCategory = 'CUSTOMERS' | 'SECURITY_STAFF';

export interface OwnerRecipientOption {
  _id: string;
  fullName: string;
  email: string;
  mobileNumber?: string | undefined;
  accountStatus: string;
  roleCode: string;
  facilityNames?: string[] | undefined;
}

export interface SendOwnerEmailPayload {
  recipientCategory: OwnerRecipientCategory;
  recipientIds: string[];
  subject: string;
  content: string;
  parkingLotId?: string | undefined;
  massEmailConfirmed?: boolean | undefined;
}

export interface OwnerEmailHistoryQueryParams {
  page?: number | string | undefined;
  limit?: number | string | undefined;
  search?: string | undefined;
  recipientCategory?: string | undefined;
  deliveryStatus?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

class OwnerEmailCenterService {
  /**
   * Helper: Resolves all active parking lot IDs owned by the authenticated owner
   */
  private async getOwnerParkingLotIds(ownerUserId: string): Promise<mongoose.Types.ObjectId[]> {
    const lots = await (ParkingLotModel as mongoose.Model<ParkingLot>)
      .find({ ownerId: new mongoose.Types.ObjectId(ownerUserId) }, '_id')
      .lean()
      .exec();
    return lots.map((l) => l._id as mongoose.Types.ObjectId);
  }

  /**
   * Get authorized recipient options for the authenticated owner
   */
  public async getRecipients(params: {
    ownerUserId: string;
    category: OwnerRecipientCategory;
    parkingLotId?: string | undefined;
    search?: string | undefined;
  }): Promise<{ recipients: OwnerRecipientOption[]; total: number }> {
    const { ownerUserId, category, parkingLotId, search } = params;

    let targetLotIds = await this.getOwnerParkingLotIds(ownerUserId);

    if (parkingLotId) {
      if (!mongoose.Types.ObjectId.isValid(parkingLotId)) {
        throw new AppError('Invalid parking facility ID.', 400, 'INVALID_FACILITY_ID');
      }
      const isOwned = targetLotIds.some((id) => id.toString() === parkingLotId);
      if (!isOwned) {
        throw new AppError('You do not own this parking facility.', 403, 'FORBIDDEN');
      }
      targetLotIds = [new mongoose.Types.ObjectId(parkingLotId)];
    }

    if (targetLotIds.length === 0) {
      return { recipients: [], total: 0 };
    }

    if (category === 'CUSTOMERS') {
      // Find all distinct customer IDs from bookings belonging to owner's lots
      const customerIds = await (BookingModel as mongoose.Model<Booking>).distinct('customerId', {
        parkingLotId: { $in: targetLotIds },
        bookingStatus: { $in: ['Confirmed', 'Active', 'Completed', 'Overstay'] },
      });

      if (!customerIds || customerIds.length === 0) {
        return { recipients: [], total: 0 };
      }

      const userFilter: Record<string, unknown> = {
        _id: { $in: customerIds },
      };

      if (search && search.trim().length > 0) {
        const regex = new RegExp(search.trim(), 'i');
        userFilter.$or = [
          { fullName: { $regex: regex } },
          { email: { $regex: regex } },
          { mobileNumber: { $regex: regex } },
        ];
      }

      const users = await (UserModel as mongoose.Model<User>)
        .find(userFilter, '_id fullName email mobileNumber accountStatus')
        .sort({ fullName: 1 })
        .limit(300)
        .lean()
        .exec();

      const recipients: OwnerRecipientOption[] = users.map((u) => ({
        _id: u._id.toString(),
        fullName: u.fullName,
        email: u.email,
        mobileNumber: u.mobileNumber || undefined,
        accountStatus: u.accountStatus,
        roleCode: 'CUSTOMER',
      }));

      return { recipients, total: recipients.length };
    }

    if (category === 'SECURITY_STAFF') {
      // Find active security staff assignments for owner's lots
      const assignments = await (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>)
        .find({
          parkingLotId: { $in: targetLotIds },
          assignmentStatus: 'Active',
        })
        .populate('securityStaffId', '_id fullName email mobileNumber accountStatus')
        .populate('parkingLotId', '_id parkingName')
        .lean()
        .exec();

      const staffMap = new Map<string, { user: any; facilities: Set<string> }>();

      for (const a of assignments) {
        const staff = a.securityStaffId as any;
        const lot = a.parkingLotId as any;
        if (!staff || !staff._id) continue;

        const idStr = staff._id.toString();
        if (!staffMap.has(idStr)) {
          staffMap.set(idStr, { user: staff, facilities: new Set() });
        }
        if (lot?.parkingName) {
          staffMap.get(idStr)!.facilities.add(lot.parkingName);
        }
      }

      let staffList = Array.from(staffMap.values());

      if (search && search.trim().length > 0) {
        const query = search.trim().toLowerCase();
        staffList = staffList.filter(
          (s) =>
            s.user.fullName?.toLowerCase().includes(query) ||
            s.user.email?.toLowerCase().includes(query) ||
            s.user.mobileNumber?.toLowerCase().includes(query),
        );
      }

      const recipients: OwnerRecipientOption[] = staffList.map((s) => ({
        _id: s.user._id.toString(),
        fullName: s.user.fullName,
        email: s.user.email,
        mobileNumber: s.user.mobileNumber || undefined,
        accountStatus: s.user.accountStatus || 'Active',
        roleCode: 'SECURITY_STAFF',
        facilityNames: Array.from(s.facilities),
      }));

      return { recipients, total: recipients.length };
    }

    throw new AppError('Invalid recipient category specified.', 400, 'INVALID_CATEGORY');
  }

  /**
   * Send email to authorized customers or assigned security staff
   */
  public async sendEmail(params: {
    ownerUserId: string;
    payload: SendOwnerEmailPayload;
    ipAddress?: string | undefined;
  }): Promise<{
    emailReference: string;
    totalAttempted: number;
    successfulCount: number;
    failedCount: number;
    message: string;
  }> {
    const { ownerUserId, payload, ipAddress } = params;
    const { recipientCategory, recipientIds, subject, content, parkingLotId } = payload;

    if (!subject || subject.trim().length === 0) {
      throw new AppError('Email subject is required.', 400, 'SUBJECT_REQUIRED');
    }
    if (!content || content.trim().length === 0) {
      throw new AppError('Email content is required.', 400, 'CONTENT_REQUIRED');
    }
    if (!recipientIds || recipientIds.length === 0) {
      throw new AppError('At least one recipient must be selected.', 400, 'RECIPIENTS_REQUIRED');
    }

    const ownerUser = await (UserModel as mongoose.Model<User>).findById(ownerUserId).lean().exec();
    if (!ownerUser) {
      throw new AppError('Owner account not found.', 401, 'UNAUTHORIZED');
    }

    // Backend Authorization Check: Re-verify that all requested recipientIds are strictly authorized
    const { recipients: eligibleRecipients } = await this.getRecipients({
      ownerUserId,
      category: recipientCategory,
      parkingLotId,
    });

    const eligibleMap = new Map(eligibleRecipients.map((r) => [r._id, r]));

    const unauthorized = recipientIds.filter((id) => !eligibleMap.has(id));
    if (unauthorized.length > 0) {
      throw new AppError(
        'One or more selected recipients are not authorized under your parking facilities.',
        403,
        'UNAUTHORIZED_RECIPIENTS',
      );
    }

    const recipientsToSend = recipientIds.map((id) => eligibleMap.get(id)!);
    const recipientEmails = recipientsToSend.map((r) => r.email);

    const emailReference = `EML-OWN-${Date.now().toString().slice(-6)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    let successfulCount = 0;
    let failedCount = 0;
    const errors: Array<{ email: string; error: string }> = [];

    // Dispatch email to recipients using branded ParkEase template
    for (const recipient of recipientsToSend) {
      try {
        const personalizedHtml = generateParkEaseEmailHtml({
          title: subject,
          bodyHtml: `<p>Dear <strong>${recipient.fullName}</strong>,</p><div>${content}</div>`,
          footerNotice: `This official communication was sent by ${ownerUser.fullName} via ParkEase Facility Management.`,
        });

        await emailService.sendEmail({
          to: recipient.email,
          subject,
          html: personalizedHtml,
          text: content.replace(/<[^>]*>/g, ''),
        });

        successfulCount++;
      } catch (err: unknown) {
        failedCount++;
        const msg = err instanceof Error ? err.message : 'Send error';
        errors.push({ email: recipient.email, error: msg });
      }
    }

    const deliveryStatus: 'Sent' | 'Failed' = failedCount === 0 ? 'Sent' : successfulCount > 0 ? 'Sent' : 'Failed';

    const baseHtml = generateParkEaseEmailHtml({
      title: subject,
      bodyHtml: `<p>Dear <strong>${recipientsToSend[0]?.fullName || 'User'}</strong>,</p><div>${content}</div>`,
      footerNotice: `This official communication was sent by ${ownerUser.fullName} via ParkEase Facility Management.`,
    });

    // Persist official EmailLog
    try {
      await (EmailLogModel as mongoose.Model<EmailLog>).create({
        emailReference,
        senderId: new mongoose.Types.ObjectId(ownerUserId),
        source: 'Owner',
        recipientIds: recipientIds.map((id) => new mongoose.Types.ObjectId(id)),
        recipientEmails,
        parkingLotId: parkingLotId ? new mongoose.Types.ObjectId(parkingLotId) : null,
        emailType: recipientCategory === 'CUSTOMERS' ? 'CUSTOMER_COMMUNICATION' : 'STAFF_COMMUNICATION',
        recipientCategory: recipientCategory === 'CUSTOMERS' ? 'FACILITY_CUSTOMERS' : 'ALL_STAFF',
        recipientCount: recipientIds.length,
        subject,
        body: content,
        htmlBody: baseHtml,
        deliveryStatus,
        sentAt: new Date(),
        retryCount: 0,
        lastAttemptAt: new Date(),
        failureReason: errors.length > 0 ? JSON.stringify(errors).slice(0, 500) : null,
      });
    } catch (logErr) {
      console.warn('[OwnerEmailCenter] Failed to persist email log:', logErr);
    }

    // Record Audit Log
    try {
      await (AuditLogModel as mongoose.Model<AuditLog>).create({
        userId: new mongoose.Types.ObjectId(ownerUserId),
        actionCode: 'OWNER_EMAIL_SENT',
        module: 'Email Management',
        actionTitle: 'Owner Email Broadcast Sent',
        description: `Parking Owner ${ownerUser.fullName} dispatched email "${subject}" to ${recipientIds.length} ${recipientCategory.toLowerCase()} (Success: ${successfulCount}, Failed: ${failedCount}).`,
        ipAddress: normalizeIp(ipAddress) || '127.0.0.1',
        actionStatus: deliveryStatus === 'Sent' ? 'Success' : 'Failed',
        metadata: {
          emailReference,
          recipientCategory,
          recipientCount: recipientIds.length,
          successfulCount,
          failedCount,
        },
      });
    } catch (auditErr) {
      console.warn('[OwnerEmailCenter] Failed to persist audit log:', auditErr);
    }

    return {
      emailReference,
      totalAttempted: recipientIds.length,
      successfulCount,
      failedCount,
      message:
        failedCount === 0
          ? `Email successfully sent to all ${successfulCount} recipient(s).`
          : `Sent to ${successfulCount} recipient(s), ${failedCount} delivery attempt(s) failed.`,
    };
  }

  /**
   * Get communication history scoped exclusively to the authenticated owner
   */
  public async getHistory(params: {
    ownerUserId: string;
    queryParams: OwnerEmailHistoryQueryParams;
  }): Promise<{
    emails: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { ownerUserId, queryParams } = params;
    const page = Math.max(1, Number(queryParams.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(queryParams.limit) || 15));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      senderId: new mongoose.Types.ObjectId(ownerUserId),
      source: 'Owner',
    };

    if (queryParams.deliveryStatus) {
      filter.deliveryStatus = queryParams.deliveryStatus;
    }
    if (queryParams.recipientCategory) {
      filter.recipientCategory = queryParams.recipientCategory;
    }
    if (queryParams.search && queryParams.search.trim().length > 0) {
      const regex = new RegExp(queryParams.search.trim(), 'i');
      filter.$or = [
        { subject: { $regex: regex } },
        { emailReference: { $regex: regex } },
        { recipientEmails: { $in: [regex] } },
      ];
    }
    if (queryParams.dateFrom || queryParams.dateTo) {
      filter.createdAt = {};
      if (queryParams.dateFrom) {
        (filter.createdAt as Record<string, unknown>).$gte = new Date(queryParams.dateFrom);
      }
      if (queryParams.dateTo) {
        (filter.createdAt as Record<string, unknown>).$lte = new Date(queryParams.dateTo);
      }
    }

    const [emails, total] = await Promise.all([
      (EmailLogModel as mongoose.Model<EmailLog>)
        .find(filter)
        .populate('parkingLotId', 'parkingName city')
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

  /**
   * Get communication overview metrics for the owner
   */
  public async getOverview(ownerUserId: string): Promise<{
    totalEmailsSent: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    deliverySuccessRate: number;
    activeCustomersCount: number;
    assignedStaffCount: number;
    recentEmails: any[];
  }> {
    const lotIds = await this.getOwnerParkingLotIds(ownerUserId);

    const [totalSent, successful, failed, distinctCustomers, distinctStaff, recent] = await Promise.all([
      (EmailLogModel as mongoose.Model<EmailLog>).countDocuments({
        senderId: new mongoose.Types.ObjectId(ownerUserId),
        source: 'Owner',
      }),
      (EmailLogModel as mongoose.Model<EmailLog>).countDocuments({
        senderId: new mongoose.Types.ObjectId(ownerUserId),
        source: 'Owner',
        deliveryStatus: 'Sent',
      }),
      (EmailLogModel as mongoose.Model<EmailLog>).countDocuments({
        senderId: new mongoose.Types.ObjectId(ownerUserId),
        source: 'Owner',
        deliveryStatus: 'Failed',
      }),
      lotIds.length > 0
        ? (BookingModel as mongoose.Model<Booking>).distinct('customerId', {
            parkingLotId: { $in: lotIds },
          })
        : Promise.resolve([]),
      lotIds.length > 0
        ? (SecurityStaffAssignmentModel as mongoose.Model<SecurityStaffAssignment>).distinct('securityStaffId', {
            parkingLotId: { $in: lotIds },
            assignmentStatus: 'Active',
          })
        : Promise.resolve([]),
      (EmailLogModel as mongoose.Model<EmailLog>)
        .find({
          senderId: new mongoose.Types.ObjectId(ownerUserId),
          source: 'Owner',
        })
        .populate('parkingLotId', 'parkingName')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec(),
    ]);

    const deliverySuccessRate = totalSent > 0 ? Math.round((successful / totalSent) * 100) : 100;

    return {
      totalEmailsSent: totalSent,
      successfulDeliveries: successful,
      failedDeliveries: failed,
      deliverySuccessRate,
      activeCustomersCount: distinctCustomers.length,
      assignedStaffCount: distinctStaff.length,
      recentEmails: recent,
    };
  }
}

export const ownerEmailCenterService = new OwnerEmailCenterService();
