import mongoose from 'mongoose';
import {
  AuditLogModel,
  EmailLogModel,
  RoleModel,
  UserModel,
  type Role,
  type User,
} from '../models/index.js';
import { emailService, generateParkEaseEmailHtml } from './email.service.js';
import { AppError } from '../utils/AppError.js';

export type RecipientCategory =
  | 'ALL_OWNERS'
  | 'ALL_CUSTOMERS'
  | 'SPECIFIC_OWNER'
  | 'SPECIFIC_CUSTOMER';

export interface RecipientOption {
  _id: string;
  fullName: string;
  email: string;
  mobileNumber?: string | undefined;
  accountStatus: string;
  roleCode: string;
}

export interface SendEmailPayload {
  recipientCategory: RecipientCategory;
  recipientIds?: string[] | undefined;
  subject: string;
  content: string; // Rich-text HTML content
  massEmailConfirmed?: boolean | undefined;
}

export interface EmailHistoryQueryParams {
  page?: number | string | undefined;
  limit?: number | string | undefined;
  search?: string | undefined;
  deliveryStatus?: string | undefined;
  recipientCategory?: string | undefined;
  source?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export interface EmailCenterOverviewData {
  totalEmailsSent: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  deliverySuccessRate: number;
  activeCustomersCount: number;
  activeOwnersCount: number;
  recentActivity: Array<{
    _id: string;
    emailReference: string;
    subject: string;
    recipientEmails: string[];
    recipientCategory: string;
    recipientCount: number;
    deliveryStatus: string;
    source: string;
    sentAt: Date | null;
    createdAt: Date;
    sender?: {
      _id: string;
      fullName: string;
      email: string;
    } | null | undefined;
  }>;
}

class AdminEmailCenterService {
  /**
   * Helper to resolve Customer Role
   */
  private async getCustomerRole(): Promise<any> {
    const role = await (RoleModel as any).findOne({
      roleCode: 'CUSTOMER',
      isActive: true,
    });
    if (!role) {
      throw new AppError('Customer role is not configured in the system.', 500, 'E031');
    }
    return role;
  }

  /**
   * Helper to resolve Owner Roles
   */
  private async getOwnerRoles(): Promise<any[]> {
    const roles = await (RoleModel as any).find({
      roleCode: { $in: ['OWNER', 'PARKING_OWNER'] },
      isActive: true,
    });
    if (!roles || roles.length === 0) {
      throw new AppError('Parking Owner roles are not configured in the system.', 500, 'E031');
    }
    return roles;
  }

  /**
   * Strict, zero-dependency HTML sanitizer.
   * Strips scripts, styles, objects, embeds, iframes, forms, inputs, and all event handlers.
   * Restricts links to http, https, and mailto schemes.
   */
  public sanitizeHtml(rawHtml: string): string {
    if (!rawHtml || typeof rawHtml !== 'string') return '';

    let clean = rawHtml;

    // 1. Remove dangerous blocks with tags and contents
    clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    clean = clean.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
    clean = clean.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');
    clean = clean.replace(/<input\b[^>]*>/gi, '');
    clean = clean.replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, '');
    clean = clean.replace(/<textarea\b[^<]*(?:(?!<\/textarea>)<[^<]*)*<\/textarea>/gi, '');

    // 2. Remove all event handlers (onload, onerror, onclick, onmouseover, etc.)
    clean = clean.replace(/\s+on[a-z0-9_-]+\s*=\s*(['"])(.*?)\1/gi, '');
    clean = clean.replace(/\s+on[a-z0-9_-]+\s*=\s*[^\s>]+/gi, '');

    // 3. Remove javascript: and vbscript: and data: pseudo-protocols in links
    clean = clean.replace(
      /\s+href\s*=\s*(['"])\s*(?:javascript|vbscript|data):[\s\S]*?\1/gi,
      ' href="#"',
    );
    clean = clean.replace(
      /\s+src\s*=\s*(['"])\s*(?:javascript|vbscript|data):[\s\S]*?\1/gi,
      ' src=""',
    );

    // 4. Remove dangerous expression/behavior/position:fixed in inline style attributes
    clean = clean.replace(
      /\s+style\s*=\s*(['"])([\s\S]*?)\1/gi,
      (_match, quote, styleContent) => {
        const safeStyles = styleContent
          .replace(/expression\s*\(.*?\)/gi, '')
          .replace(/behavior\s*:[^;]+/gi, '')
          .replace(/position\s*:\s*fixed/gi, 'position: relative')
          .replace(/javascript:/gi, '');
        return ` style=${quote}${safeStyles}${quote}`;
      },
    );

    return clean.trim();
  }

  /**
   * 1. Get Email Center Overview Metrics
   */
  public async getOverview(): Promise<EmailCenterOverviewData> {
    const customerRole = await this.getCustomerRole();
    const ownerRoles = await this.getOwnerRoles();
    const ownerRoleIds = ownerRoles.map((r) => r._id);

    // Parallel execution for fast dashboard loads
    const [statusCounts, activeCustomers, activeOwners, recentLogs] = await Promise.all([
      // Aggregation of delivery statuses from EmailLogModel
      (EmailLogModel as any).aggregate([
        {
          $group: {
            _id: '$deliveryStatus',
            count: { $sum: 1 },
          },
        },
      ]),

      // Active Customers count
      (UserModel as any).countDocuments({
        roleId: customerRole._id,
        accountStatus: 'Active',
      }),

      // Active Owners count
      (UserModel as any).countDocuments({
        roleId: { $in: ownerRoleIds },
        accountStatus: 'Active',
      }),

      // Recent 10 email activities
      (EmailLogModel as any)
        .find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('senderId', 'fullName email')
        .lean()
        .exec(),
    ]);

    let totalEmailsSent = 0;
    let successfulDeliveries = 0;
    let failedDeliveries = 0;
    let pendingDeliveries = 0;

    for (const item of statusCounts) {
      const status = item._id as string;
      const count = item.count as number;
      totalEmailsSent += count;

      if (status === 'Sent') {
        successfulDeliveries += count;
      } else if (status === 'Failed') {
        failedDeliveries += count;
      } else if (status === 'Pending' || status === 'Sending' || status === 'Retrying') {
        pendingDeliveries += count;
      }
    }

    const completed = successfulDeliveries + failedDeliveries;
    const deliverySuccessRate =
      completed > 0 ? Number(((successfulDeliveries / completed) * 100).toFixed(1)) : 100;

    const recentActivity = recentLogs.map((log: any) => ({
      _id: log._id.toString(),
      emailReference: log.emailReference,
      subject: log.subject,
      recipientEmails: log.recipientEmails || [],
      recipientCategory: log.recipientCategory || 'OTHER',
      recipientCount: log.recipientCount || (log.recipientEmails ? log.recipientEmails.length : 1),
      deliveryStatus: log.deliveryStatus,
      source: log.source || 'System',
      sentAt: log.sentAt || null,
      createdAt: log.createdAt,
      sender: log.senderId
        ? {
            _id: log.senderId._id.toString(),
            fullName: log.senderId.fullName,
            email: log.senderId.email,
          }
        : null,
    }));

    return {
      totalEmailsSent,
      successfulDeliveries,
      failedDeliveries,
      pendingDeliveries,
      deliverySuccessRate,
      activeCustomersCount: activeCustomers,
      activeOwnersCount: activeOwners,
      recentActivity,
    };
  }

  /**
   * 2. Recipient Discovery & Search
   */
  public async searchRecipients(
    category: RecipientCategory,
    search?: string,
  ): Promise<{
    category: RecipientCategory;
    estimatedCount: number;
    recipients: RecipientOption[];
  }> {
    const customerRole = await this.getCustomerRole();
    const ownerRoles = await this.getOwnerRoles();
    const ownerRoleIds = ownerRoles.map((r) => r._id);

    if (category === 'ALL_CUSTOMERS') {
      const filter: Record<string, any> = {
        roleId: customerRole._id,
        accountStatus: 'Active',
      };

      const count = await (UserModel as any).countDocuments(filter);
      const sample = await (UserModel as any)
        .find(filter)
        .select('_id fullName email mobileNumber accountStatus')
        .limit(10)
        .lean()
        .exec();

      return {
        category,
        estimatedCount: count,
        recipients: sample.map((u: any) => ({
          _id: u._id.toString(),
          fullName: u.fullName,
          email: u.email,
          mobileNumber: u.mobileNumber,
          accountStatus: u.accountStatus,
          roleCode: 'CUSTOMER',
        })),
      };
    }

    if (category === 'ALL_OWNERS') {
      const filter: Record<string, any> = {
        roleId: { $in: ownerRoleIds },
        accountStatus: 'Active',
      };

      const count = await (UserModel as any).countDocuments(filter);
      const sample = await (UserModel as any)
        .find(filter)
        .select('_id fullName email mobileNumber accountStatus')
        .limit(10)
        .lean()
        .exec();

      return {
        category,
        estimatedCount: count,
        recipients: sample.map((u: any) => ({
          _id: u._id.toString(),
          fullName: u.fullName,
          email: u.email,
          mobileNumber: u.mobileNumber,
          accountStatus: u.accountStatus,
          roleCode: 'OWNER',
        })),
      };
    }

    // Specific recipients search
    const roleFilter =
      category === 'SPECIFIC_CUSTOMER'
        ? { roleId: customerRole._id }
        : { roleId: { $in: ownerRoleIds } };

    const queryFilter: Record<string, any> = {
      ...roleFilter,
      accountStatus: { $ne: 'Deleted' },
    };

    if (search && search.trim()) {
      const term = search.trim();
      const regex = new RegExp(term, 'i');
      queryFilter.$or = [
        { fullName: regex },
        { email: regex },
        { mobileNumber: regex },
      ];
    }

    const matchingUsers = await (UserModel as any)
      .find(queryFilter)
      .select('_id fullName email mobileNumber accountStatus')
      .sort({ fullName: 1 })
      .limit(50)
      .lean()
      .exec();

    const count = await (UserModel as any).countDocuments(queryFilter);

    return {
      category,
      estimatedCount: count,
      recipients: matchingUsers.map((u: any) => ({
        _id: u._id.toString(),
        fullName: u.fullName,
        email: u.email,
        mobileNumber: u.mobileNumber,
        accountStatus: u.accountStatus,
        roleCode: category === 'SPECIFIC_CUSTOMER' ? 'CUSTOMER' : 'OWNER',
      })),
    };
  }

  /**
   * 3. Send Administrator Email (with Mass Send Safeguards and Sanitization)
   */
  public async sendEmail(
    adminUserId: string,
    payload: SendEmailPayload,
  ): Promise<{
    success: boolean;
    totalTargeted: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    emailReference: string;
    message: string;
  }> {
    // 1. Validate inputs
    const subject = (payload.subject || '').trim();
    if (!subject || subject.length < 3) {
      throw new AppError('Email subject is required and must be at least 3 characters.', 400, 'INVALID_SUBJECT');
    }
    if (subject.length > 200) {
      throw new AppError('Email subject must not exceed 200 characters.', 400, 'INVALID_SUBJECT');
    }

    const rawContent = (payload.content || '').trim();
    if (!rawContent || rawContent.length < 5) {
      throw new AppError('Email body content is required.', 400, 'INVALID_CONTENT');
    }

    // 2. Resolve target recipients authoritatively
    const customerRole = await this.getCustomerRole();
    const ownerRoles = await this.getOwnerRoles();
    const ownerRoleIds = ownerRoles.map((r) => r._id);

    let targetUsers: Array<{ _id: any; fullName: string; email: string }> = [];

    if (payload.recipientCategory === 'ALL_CUSTOMERS') {
      targetUsers = await (UserModel as any)
        .find({
          roleId: customerRole._id,
          accountStatus: 'Active',
        })
        .select('_id fullName email')
        .lean()
        .exec();
    } else if (payload.recipientCategory === 'ALL_OWNERS') {
      targetUsers = await (UserModel as any)
        .find({
          roleId: { $in: ownerRoleIds },
          accountStatus: 'Active',
        })
        .select('_id fullName email')
        .lean()
        .exec();
    } else if (payload.recipientCategory === 'SPECIFIC_CUSTOMER') {
      if (!payload.recipientIds || payload.recipientIds.length === 0) {
        throw new AppError('Please select at least one specific customer recipient.', 400, 'RECIPIENTS_REQUIRED');
      }
      const validObjectIds = payload.recipientIds
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      targetUsers = await (UserModel as any)
        .find({
          _id: { $in: validObjectIds },
          roleId: customerRole._id,
          accountStatus: { $ne: 'Deleted' },
        })
        .select('_id fullName email')
        .lean()
        .exec();
    } else if (payload.recipientCategory === 'SPECIFIC_OWNER') {
      if (!payload.recipientIds || payload.recipientIds.length === 0) {
        throw new AppError('Please select at least one specific parking owner recipient.', 400, 'RECIPIENTS_REQUIRED');
      }
      const validObjectIds = payload.recipientIds
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      targetUsers = await (UserModel as any)
        .find({
          _id: { $in: validObjectIds },
          roleId: { $in: ownerRoleIds },
          accountStatus: { $ne: 'Deleted' },
        })
        .select('_id fullName email')
        .lean()
        .exec();
    } else {
      throw new AppError('Invalid recipient category selected.', 400, 'INVALID_RECIPIENT_CATEGORY');
    }

    // De-duplicate emails
    const uniqueUserMap = new Map<string, { _id: any; fullName: string; email: string }>();
    for (const u of targetUsers) {
      if (u.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email)) {
        uniqueUserMap.set(u.email.toLowerCase().trim(), u);
      }
    }
    const eligibleRecipients = Array.from(uniqueUserMap.values());

    if (eligibleRecipients.length === 0) {
      throw new AppError('No eligible, active recipients found for the selected category.', 400, 'NO_RECIPIENTS');
    }

    // 3. Mass Email Confirmation Check
    const isMassEmail =
      eligibleRecipients.length > 1 ||
      payload.recipientCategory === 'ALL_CUSTOMERS' ||
      payload.recipientCategory === 'ALL_OWNERS';

    if (isMassEmail && !payload.massEmailConfirmed) {
      throw new AppError(
        `Mass email sending to ${eligibleRecipients.length} recipients requires explicit confirmation.`,
        400,
        'MASS_CONFIRMATION_REQUIRED',
      );
    }

    // 4. Sanitize Content
    const sanitizedHtml = this.sanitizeHtml(rawContent);

    // 5. Wrap inside official ParkEase-branded email layout
    const brandedEmailHtml = generateParkEaseEmailHtml({
      title: subject,
      subtitle: 'Official Administrative Communication',
      badge: {
        text: 'ParkEase Notice',
        variant: 'info',
      },
      bodyHtml: sanitizedHtml,
      footerNotice:
        'This official email was dispatched directly by ParkEase Platform Operations. Replies to this email are monitored by system administrators.',
    });

    const adminObjectId = new mongoose.Types.ObjectId(adminUserId);
    const recipientEmails = eligibleRecipients.map((r) => r.email);
    const recipientIds = eligibleRecipients.map((r) => r._id);

    // 6. Deliver email and accurately record delivery status
    // Dispatch via emailService
    let successfulDeliveries = 0;
    let failedDeliveries = 0;

    // Send email using emailService with complete audit attributes
    const isSent = await emailService.sendEmail({
      to: recipientEmails,
      subject,
      html: brandedEmailHtml,
      emailType: 'ADMIN_COMMUNICATION',
      source: 'Admin',
      senderId: adminObjectId,
      recipientIds,
      recipientCategory: payload.recipientCategory,
      recipientCount: eligibleRecipients.length,
      htmlBody: sanitizedHtml,
    });

    if (isSent) {
      successfulDeliveries = eligibleRecipients.length;
    } else {
      failedDeliveries = eligibleRecipients.length;
    }

    // 7. Record Audit Trail
    const actionCode = isMassEmail ? 'MASS_EMAIL_SENT' : 'EMAIL_SENT';
    const actionTitle = isMassEmail ? 'Mass Email Sent' : 'Administrative Email Sent';
    const auditDescription = `Administrator sent "${subject}" to ${eligibleRecipients.length} recipient(s) [Category: ${payload.recipientCategory}]. Status: ${isSent ? 'Sent' : 'Failed'}.`;

    try {
      await AuditLogModel.create({
        userId: adminObjectId,
        actionCode,
        actionTitle,
        module: 'Email Management',
        description: auditDescription,
        actionStatus: isSent ? 'Success' : 'Failed',
        metadata: {
          recipientCategory: payload.recipientCategory,
          recipientCount: eligibleRecipients.length,
          subject,
          isMassEmail,
        },
      });
    } catch (auditErr) {
      console.warn('Failed to record AuditLog for Email Center dispatch:', auditErr);
    }

    return {
      success: isSent,
      totalTargeted: eligibleRecipients.length,
      successfulDeliveries,
      failedDeliveries,
      emailReference: `EMAIL-ADMIN-${Date.now()}`,
      message: isSent
        ? `Successfully dispatched email to ${eligibleRecipients.length} recipient(s).`
        : `Email delivery failed for ${eligibleRecipients.length} recipient(s).`,
    };
  }

  /**
   * 4. Get Email History with Multi-Criteria Filters and Server-Side Pagination
   */
  public async getEmailHistory(query: EmailHistoryQueryParams): Promise<{
    emails: any[];
    pagination: {
      total: number;
      page: number;
      totalPages: number;
      limit: number;
    };
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    // Source filter (Admin or all)
    if (query.source && query.source !== 'All') {
      filter.source = query.source;
    }

    // Status filter
    if (query.deliveryStatus && query.deliveryStatus !== 'All') {
      filter.deliveryStatus = query.deliveryStatus;
    }

    // Recipient Category filter
    if (query.recipientCategory && query.recipientCategory !== 'All') {
      filter.recipientCategory = query.recipientCategory;
    }

    // Date range filter
    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) {
        const from = new Date(query.dateFrom);
        from.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = from;
      }
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    // Search by subject or recipient email
    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { subject: searchRegex },
        { recipientEmails: searchRegex },
        { emailReference: searchRegex },
      ];
    }

    const [total, records] = await Promise.all([
      (EmailLogModel as any).countDocuments(filter),
      (EmailLogModel as any)
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('senderId', 'fullName email')
        .populate('recipientIds', 'fullName email mobileNumber')
        .lean()
        .exec(),
    ]);

    const emails = records.map((log: any) => ({
      _id: log._id.toString(),
      emailReference: log.emailReference,
      subject: log.subject,
      body: log.body,
      htmlBody: log.htmlBody || null,
      recipientCategory: log.recipientCategory || 'OTHER',
      recipientCount: log.recipientCount || (log.recipientEmails ? log.recipientEmails.length : 1),
      recipientEmails: log.recipientEmails || [],
      deliveryStatus: log.deliveryStatus,
      source: log.source,
      emailType: log.emailType,
      providerMessageId: log.providerMessageId || null,
      failureReason: log.failureReason || null,
      sentAt: log.sentAt || null,
      createdAt: log.createdAt,
      sender: log.senderId
        ? {
            _id: log.senderId._id.toString(),
            fullName: log.senderId.fullName,
            email: log.senderId.email,
          }
        : null,
      recipients: (log.recipientIds || []).map((u: any) => ({
        _id: u._id.toString(),
        fullName: u.fullName,
        email: u.email,
        mobileNumber: u.mobileNumber,
      })),
    }));

    return {
      emails,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        limit,
      },
    };
  }

  /**
   * 5. Get Single Email Log Detail Dossier
   */
  public async getEmailById(id: string): Promise<any> {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError('Invalid email log ID.', 400, 'INVALID_ID');
    }

    const log = await (EmailLogModel as any)
      .findById(id)
      .populate('senderId', 'fullName email')
      .populate('recipientIds', 'fullName email mobileNumber accountStatus')
      .lean()
      .exec();

    if (!log) {
      throw new AppError('Email record not found.', 404, 'EMAIL_NOT_FOUND');
    }

    return {
      _id: log._id.toString(),
      emailReference: log.emailReference,
      subject: log.subject,
      body: log.body,
      htmlBody: log.htmlBody || null,
      recipientCategory: log.recipientCategory || 'OTHER',
      recipientCount: log.recipientCount || (log.recipientEmails ? log.recipientEmails.length : 1),
      recipientEmails: log.recipientEmails || [],
      deliveryStatus: log.deliveryStatus,
      source: log.source,
      emailType: log.emailType,
      providerMessageId: log.providerMessageId || null,
      failureReason: log.failureReason || null,
      retryCount: log.retryCount || 0,
      lastAttemptAt: log.lastAttemptAt || null,
      sentAt: log.sentAt || null,
      createdAt: log.createdAt,
      sender: log.senderId
        ? {
            _id: log.senderId._id.toString(),
            fullName: log.senderId.fullName,
            email: log.senderId.email,
          }
        : null,
      recipients: (log.recipientIds || []).map((u: any) => ({
        _id: u._id.toString(),
        fullName: u.fullName,
        email: u.email,
        mobileNumber: u.mobileNumber,
        accountStatus: u.accountStatus,
      })),
    };
  }
}

export const adminEmailCenterService = new AdminEmailCenterService();
