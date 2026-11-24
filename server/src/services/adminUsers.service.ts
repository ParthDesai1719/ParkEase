import mongoose from 'mongoose';
import { z } from 'zod';
import { UserModel, type User } from '../models/User.js';
import { RoleModel, type Role } from '../models/Role.js';
import { BookingModel, type Booking } from '../models/Booking.js';
import { PaymentModel, type Payment } from '../models/Payment.js';
import { VehicleModel, type Vehicle } from '../models/Vehicle.js';
import { SessionModel, type Session } from '../models/Session.js';
import { NotificationModel } from '../models/Notification.js';
import { auditService } from './audit.service.js';
import { notificationService } from './notification.service.js';
import { emailService } from './email.service.js';
import { AppError } from '../utils/AppError.js';

export const updateCustomerProfileSchema = z.object({
  fullName: z.string().trim().min(3, 'Full name must be at least 3 characters').max(100).optional(),
  mobileNumber: z
    .string()
    .trim()
    .regex(/^\+91\d{10}$/, 'Mobile number must be in format +91XXXXXXXXXX')
    .optional(),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer Not To Say']).optional(),
  preferredLanguage: z.enum(['English', 'Hindi', 'Gujarati']).optional(),
  timezone: z.string().trim().min(1, 'Timezone cannot be empty').optional(),
});

export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;

export interface CustomerListQuery {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  status?: string | undefined;
  bookingActivity?: 'ALL' | 'HAS_BOOKINGS' | 'NO_BOOKINGS' | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  sortBy?: 'createdAt' | 'fullName' | 'lastLogin' | 'bookingCount' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

export class AdminUsersService {
  /**
   * Helper to retrieve the ObjectId of the Customer role
   */
  private async getCustomerRoleId(): Promise<mongoose.Types.ObjectId> {
    const customerRole = await (RoleModel as mongoose.Model<Role>)
      .findOne({ roleCode: 'CUSTOMER' })
      .lean()
      .exec();
    if (!customerRole) {
      throw new AppError('Customer role is not configured in the system.', 500, 'ROLE_NOT_FOUND');
    }
    return customerRole._id as mongoose.Types.ObjectId;
  }

  /**
   * List customer directory with server-side filters, search, aggregation & pagination.
   */
  public async listCustomers(query: CustomerListQuery) {
    const customerRoleId = await this.getCustomerRoleId();

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    // Base match filter strictly targeting CUSTOMER accounts
    const matchFilter: Record<string, unknown> = {
      roleId: customerRoleId,
    };

    // Account status filter
    if (query.status && query.status !== 'ALL') {
      matchFilter.accountStatus = query.status;
    }

    // Created date range filter
    if (query.dateFrom || query.dateTo) {
      const createdAtFilter: Record<string, Date> = {};
      if (query.dateFrom) {
        createdAtFilter.$gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        const toDate = new Date(query.dateTo);
        toDate.setHours(23, 59, 59, 999);
        createdAtFilter.$lte = toDate;
      }
      matchFilter.createdAt = createdAtFilter;
    }

    // Search filter across name, email, mobile, or user ID
    if (query.search && query.search.trim()) {
      const trimmed = query.search.trim();
      const searchConditions: Array<Record<string, unknown>> = [
        { fullName: { $regex: trimmed, $options: 'i' } },
        { email: { $regex: trimmed, $options: 'i' } },
        { mobileNumber: { $regex: trimmed, $options: 'i' } },
      ];

      if (mongoose.Types.ObjectId.isValid(trimmed)) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(trimmed) });
      }

      matchFilter.$or = searchConditions;
    }

    // Aggregation pipeline to join booking counts and filter by booking activity
    const pipeline: mongoose.PipelineStage[] = [
      { $match: matchFilter },
      {
        $lookup: {
          from: 'bookings',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$customerId', '$$userId'] } } },
            { $count: 'count' },
          ],
          as: 'bookingCountData',
        },
      },
      {
        $addFields: {
          bookingCount: {
            $ifNull: [{ $arrayElemAt: ['$bookingCountData.count', 0] }, 0],
          },
        },
      },
    ];

    // Filter by booking activity if requested
    if (query.bookingActivity === 'HAS_BOOKINGS') {
      pipeline.push({ $match: { bookingCount: { $gt: 0 } } });
    } else if (query.bookingActivity === 'NO_BOOKINGS') {
      pipeline.push({ $match: { bookingCount: 0 } });
    }

    // Sorting
    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const sortStage: Record<string, 1 | -1> = { [sortField]: sortDir };

    // Facet for pagination and total count
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $sort: sortStage },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              fullName: 1,
              email: 1,
              mobileNumber: 1,
              gender: 1,
              accountStatus: 1,
              emailVerified: 1,
              mobileVerified: 1,
              preferredLanguage: 1,
              timezone: 1,
              lastLogin: 1,
              createdAt: 1,
              bookingCount: 1,
              suspensionReason: 1,
              suspendedAt: 1,
              suspendedBy: 1,
            },
          },
        ],
      },
    });

    const [aggregateResult] = await UserModel.aggregate(pipeline);
    const total = aggregateResult?.metadata[0]?.total || 0;
    const users = aggregateResult?.data || [];

    // Global summary metrics for Customer cards
    const [totalCustomers, activeCustomers, suspendedCustomers, deactivatedCustomers] =
      await Promise.all([
        (UserModel as mongoose.Model<User>).countDocuments({ roleId: customerRoleId }),
        (UserModel as mongoose.Model<User>).countDocuments({
          roleId: customerRoleId,
          accountStatus: 'Active',
        }),
        (UserModel as mongoose.Model<User>).countDocuments({
          roleId: customerRoleId,
          accountStatus: 'Suspended',
        }),
        (UserModel as mongoose.Model<User>).countDocuments({
          roleId: customerRoleId,
          accountStatus: 'Deactivated',
        }),
      ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalCustomers,
        activeCustomers,
        suspendedCustomers,
        deactivatedCustomers,
      },
    };
  }

  /**
   * Get detailed profile, booking statistics, registered vehicles, and activity for a Customer.
   */
  public async getCustomerDetails(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID provided.', 400, 'INVALID_USER_ID');
    }

    const customerRoleId = await this.getCustomerRoleId();

    const user = await (UserModel as mongoose.Model<User>)
      .findOne({
        _id: new mongoose.Types.ObjectId(userId),
        roleId: customerRoleId,
      })
      .populate('suspendedBy', 'fullName email')
      .lean()
      .exec();

    if (!user) {
      throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    }

    const customerObjId = new mongoose.Types.ObjectId(userId);

    // Booking KPIs
    const [
      totalBookings,
      activeBookings,
      completedBookings,
      cancelledBookings,
      noShowBookings,
      overstayBookings,
    ] = await Promise.all([
      (BookingModel as mongoose.Model<Booking>).countDocuments({ customerId: customerObjId }),
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        customerId: customerObjId,
        bookingStatus: 'Active',
      }),
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        customerId: customerObjId,
        bookingStatus: 'Completed',
      }),
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        customerId: customerObjId,
        bookingStatus: 'Cancelled',
      }),
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        customerId: customerObjId,
        bookingStatus: 'No Show',
      }),
      (BookingModel as mongoose.Model<Booking>).countDocuments({
        customerId: customerObjId,
        bookingStatus: 'Overstay',
      }),
    ]);

    // Registered vehicles
    const vehicles = await (VehicleModel as mongoose.Model<Vehicle>)
      .find({ customerId: customerObjId })
      .select(
        'vehicleNumber vehicleType vehicleBrand vehicleModel vehicleColor isPrimary vehicleStatus',
      )
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean()
      .exec();

    // Recent sessions / logins
    const recentSessions = await (SessionModel as mongoose.Model<Session>)
      .find({ userId: customerObjId })
      .select(
        'sessionId loginTime lastActivity logoutTime logoutReason sessionStatus ipAddress deviceName',
      )
      .sort({ loginTime: -1 })
      .limit(5)
      .lean()
      .exec();

    return {
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        gender: user.gender,
        accountStatus: user.accountStatus,
        emailVerified: user.emailVerified,
        mobileVerified: user.mobileVerified,
        preferredLanguage: user.preferredLanguage,
        timezone: user.timezone,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        suspensionReason: user.suspensionReason,
        suspendedAt: user.suspendedAt,
        suspendedBy: user.suspendedBy,
      },
      bookingSummary: {
        totalBookings,
        activeBookings,
        completedBookings,
        cancelledBookings,
        noShowBookings,
        overstayBookings,
      },
      vehicles,
      recentSessions,
    };
  }

  /**
   * Get paginated booking history for a specific customer.
   */
  public async getCustomerBookings(
    userId: string,
    query: { page?: number | undefined; limit?: number | undefined; status?: string | undefined },
  ) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID provided.', 400, 'INVALID_USER_ID');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      customerId: new mongoose.Types.ObjectId(userId),
    };

    if (query.status && query.status !== 'ALL') {
      filter.bookingStatus = query.status;
    }

    const [total, bookings] = await Promise.all([
      (BookingModel as mongoose.Model<Booking>).countDocuments(filter),
      (BookingModel as mongoose.Model<Booking>)
        .find(filter)
        .populate('parkingLotId', 'facilityName parkingName address')
        .populate('vehicleId', 'vehicleNumber vehicleType vehicleModel')
        .populate('slotId', 'slotNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    // Attach payment info for each booking
    const bookingIds = bookings.map((b) => b._id);
    const payments = await (PaymentModel as mongoose.Model<Payment>)
      .find({
        bookingId: { $in: bookingIds },
      })
      .select('bookingId paymentReference paymentStatus paymentMethod totalAmount amount')
      .lean()
      .exec();

    const paymentMap = new Map(payments.map((p) => [p.bookingId?.toString(), p]));

    const enrichedBookings = bookings.map((b) => ({
      ...b,
      payment: paymentMap.get(b._id.toString()) || null,
    }));

    return {
      bookings: enrichedBookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Update permitted profile fields for a Customer.
   */
  public async updateCustomerProfile(
    userId: string,
    input: UpdateCustomerProfileInput,
    adminUserId: string,
    roleId?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID provided.', 400, 'INVALID_USER_ID');
    }

    const validated = updateCustomerProfileSchema.parse(input);
    const customerRoleId = await this.getCustomerRoleId();

    const user = await (UserModel as mongoose.Model<User>).findOne({
      _id: new mongoose.Types.ObjectId(userId),
      roleId: customerRoleId,
    });
    if (!user) {
      throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    }

    // If mobile number changed, ensure no conflict
    if (validated.mobileNumber && validated.mobileNumber !== user.mobileNumber) {
      const existing = await (UserModel as mongoose.Model<User>).findOne({
        mobileNumber: validated.mobileNumber,
        _id: { $ne: user._id },
      });
      if (existing) {
        throw new AppError(
          'Mobile number is already registered by another user.',
          409,
          'MOBILE_ALREADY_EXISTS',
        );
      }
    }

    const beforeData = {
      fullName: user.fullName,
      mobileNumber: user.mobileNumber,
      gender: user.gender,
      preferredLanguage: user.preferredLanguage,
      timezone: user.timezone,
    };

    const changedFields: Record<string, { from: unknown; to: unknown }> = {};

    if (validated.fullName !== undefined && validated.fullName !== user.fullName) {
      changedFields.fullName = { from: user.fullName, to: validated.fullName };
      user.fullName = validated.fullName;
    }
    if (validated.mobileNumber !== undefined && validated.mobileNumber !== user.mobileNumber) {
      changedFields.mobileNumber = { from: user.mobileNumber, to: validated.mobileNumber };
      user.mobileNumber = validated.mobileNumber;
    }
    if (validated.gender !== undefined && validated.gender !== user.gender) {
      changedFields.gender = { from: user.gender, to: validated.gender };
      user.gender = validated.gender;
    }
    if (
      validated.preferredLanguage !== undefined &&
      validated.preferredLanguage !== user.preferredLanguage
    ) {
      changedFields.preferredLanguage = {
        from: user.preferredLanguage,
        to: validated.preferredLanguage,
      };
      user.preferredLanguage = validated.preferredLanguage;
    }
    if (validated.timezone !== undefined && validated.timezone !== user.timezone) {
      changedFields.timezone = { from: user.timezone, to: validated.timezone };
      user.timezone = validated.timezone;
    }

    await user.save();

    const afterData = {
      fullName: user.fullName,
      mobileNumber: user.mobileNumber,
      gender: user.gender,
      preferredLanguage: user.preferredLanguage,
      timezone: user.timezone,
    };

    await auditService.log({
      userId: new mongoose.Types.ObjectId(adminUserId),
      roleId: roleId ? new mongoose.Types.ObjectId(roleId) : null,
      module: 'User Management',
      actionCode: 'USER_PROFILE_UPDATED',
      actionTitle: 'Customer Profile Updated by Admin',
      description: `Administrator updated profile fields for customer ${user.fullName} (${user.email}).`,
      targetCollection: 'users',
      targetDocumentId: user._id,
      beforeData,
      afterData,
      changedFields: changedFields as Record<string, unknown>,
      actionStatus: 'Success',
    });

    return user;
  }

  /**
   * Suspend a customer account, terminating active sessions and dispatching notifications.
   */
  public async suspendCustomer(
    userId: string,
    reason: string,
    adminUserId: string,
    roleId?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID provided.', 400, 'INVALID_USER_ID');
    }

    if (!reason || reason.trim().length < 5) {
      throw new AppError('Suspension reason must be at least 5 characters.', 400, 'INVALID_REASON');
    }

    const customerRoleId = await this.getCustomerRoleId();

    const user = await (UserModel as mongoose.Model<User>).findOne({
      _id: new mongoose.Types.ObjectId(userId),
      roleId: customerRoleId,
    });
    if (!user) {
      throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    }

    if (user.accountStatus === 'Suspended') {
      throw new AppError('Customer account is already suspended.', 400, 'ALREADY_SUSPENDED');
    }

    const previousStatus = user.accountStatus;
    const adminObjId = new mongoose.Types.ObjectId(adminUserId);

    user.accountStatus = 'Suspended';
    user.suspensionReason = reason.trim();
    user.suspendedAt = new Date();
    user.suspendedBy = adminObjId;

    await user.save();

    // Revoke all active sessions immediately
    await (SessionModel as mongoose.Model<Session>).updateMany(
      { userId: user._id, sessionStatus: 'Active' },
      {
        sessionStatus: 'Revoked',
        logoutReason: 'Account Suspended',
        logoutTime: new Date(),
        revokedAt: new Date(),
        revokedBy: adminObjId,
      },
    );

    // Create in-app notification
    await notificationService
      .createNotification({
        userId: user._id,
        senderId: adminObjId,
        notificationType: 'Account',
        eventType: 'Customer Account Suspended',
        title: 'Account Suspended',
        message: `Your ParkEase account has been suspended by an administrator. Reason: ${reason.trim()}`,
        priority: 'Critical',
        deliveryChannel: 'In-App',
      })
      .catch((e) => {
        console.error('Failed to create suspension notification:', e);
      });

    // Send email notification
    await emailService
      .sendEmail({
        to: user.email,
        subject: 'ParkEase Notice: Account Suspended',
        text: `Hello ${user.fullName},\n\nYour ParkEase customer account has been suspended.\nReason: ${reason.trim()}\n\nActive sessions have been terminated. If you believe this is in error, please contact support.\n\nParkEase Support Team`,
        emailType: 'SYSTEM_NOTIFICATION',
        senderId: adminObjId,
      })
      .catch(() => {});

    // Audit log
    await auditService.log({
      userId: adminObjId,
      roleId: roleId ? new mongoose.Types.ObjectId(roleId) : null,
      module: 'User Management',
      actionCode: 'USER_SUSPENDED',
      actionTitle: 'Customer Account Suspended',
      description: `Suspended customer ${user.fullName} (${user.email}). Reason: ${reason.trim()}`,
      targetCollection: 'users',
      targetDocumentId: user._id,
      beforeData: { accountStatus: previousStatus },
      afterData: { accountStatus: 'Suspended', suspensionReason: reason.trim() },
      actionStatus: 'Success',
    });

    return user;
  }

  /**
   * Reactivate a suspended or deactivated customer account.
   */
  public async activateCustomer(
    userId: string,
    remarks?: string,
    adminUserId?: string,
    roleId?: string,
  ) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID provided.', 400, 'INVALID_USER_ID');
    }

    const customerRoleId = await this.getCustomerRoleId();

    const user = await (UserModel as mongoose.Model<User>).findOne({
      _id: new mongoose.Types.ObjectId(userId),
      roleId: customerRoleId,
    });
    if (!user) {
      throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    }

    if (user.accountStatus === 'Active') {
      throw new AppError('Customer account is already active.', 400, 'ALREADY_ACTIVE');
    }

    const previousStatus = user.accountStatus;
    const adminObjId = adminUserId ? new mongoose.Types.ObjectId(adminUserId) : null;

    user.accountStatus = 'Active';
    user.suspensionReason = null;
    user.suspendedAt = null;
    user.suspendedBy = null;

    await user.save();

    // In-app notification
    await notificationService
      .createNotification({
        userId: user._id,
        senderId: adminObjId,
        notificationType: 'Account',
        eventType: 'Customer Account Reactivated',
        title: 'Account Reactivated',
        message:
          'Your ParkEase customer account has been reactivated. You can now log in and book parking spots.',
        priority: 'Normal',
        deliveryChannel: 'In-App',
      })
      .catch((e) => {
        console.error('Failed to create activation notification:', e);
      });

    // Email notification
    await emailService
      .sendEmail({
        to: user.email,
        subject: 'ParkEase Notice: Account Reactivated',
        text: `Hello ${user.fullName},\n\nYour ParkEase customer account has been reactivated. You can now log in and use all ParkEase services.\n\nParkEase Support Team`,
        emailType: 'SYSTEM_NOTIFICATION',
        senderId: adminObjId,
      })
      .catch(() => {});

    // Audit log
    await auditService.log({
      userId: adminObjId,
      roleId: roleId ? new mongoose.Types.ObjectId(roleId) : null,
      module: 'User Management',
      actionCode: 'USER_ACTIVATED',
      actionTitle: 'Customer Account Reactivated',
      description: `Reactivated customer ${user.fullName} (${user.email}). ${remarks ? `Remarks: ${remarks}` : ''}`,
      targetCollection: 'users',
      targetDocumentId: user._id,
      beforeData: { accountStatus: previousStatus },
      afterData: { accountStatus: 'Active' },
      actionStatus: 'Success',
    });

    return user;
  }

  /**
   * Delete customer account with strict dependency checks:
   * 1. Blocks deletion if active bookings exist.
   * 2. Blocks deletion if any booking or payment history exists (prompts suspension instead for audit preservation).
   * 3. Permitted only if 0 bookings and 0 payments.
   */
  public async deleteCustomer(userId: string, adminUserId: string, roleId?: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID provided.', 400, 'INVALID_USER_ID');
    }

    const customerRoleId = await this.getCustomerRoleId();

    const user = await (UserModel as mongoose.Model<User>).findOne({
      _id: new mongoose.Types.ObjectId(userId),
      roleId: customerRoleId,
    });
    if (!user) {
      throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    }

    // Check 1: Active / Ongoing bookings
    const activeBookingsCount = await (BookingModel as mongoose.Model<Booking>).countDocuments({
      customerId: user._id,
      bookingStatus: { $in: ['Pending Payment', 'Confirmed', 'Active', 'Overstay'] },
    });

    if (activeBookingsCount > 0) {
      throw new AppError(
        `Cannot delete customer account. Customer has ${activeBookingsCount} active or in-progress booking(s). Please complete or cancel them first.`,
        409,
        'CUSTOMER_HAS_ACTIVE_BOOKINGS',
      );
    }

    // Check 2: Historical bookings or payments
    const [totalBookingsCount, totalPaymentsCount] = await Promise.all([
      (BookingModel as mongoose.Model<Booking>).countDocuments({ customerId: user._id }),
      (PaymentModel as mongoose.Model<Payment>).countDocuments({ customerId: user._id }),
    ]);

    if (totalBookingsCount > 0 || totalPaymentsCount > 0) {
      throw new AppError(
        `Cannot delete customer account with existing booking (${totalBookingsCount}) or financial transaction (${totalPaymentsCount}) history. To preserve financial audit integrity, suspend or deactivate this account instead.`,
        409,
        'CUSTOMER_HAS_TRANSACTION_HISTORY',
      );
    }

    const adminObjId = new mongoose.Types.ObjectId(adminUserId);

    // Delete customer vehicles, sessions, and notifications
    await Promise.all([
      (VehicleModel as mongoose.Model<Vehicle>).deleteMany({ customerId: user._id }),
      (SessionModel as mongoose.Model<Session>).deleteMany({ userId: user._id }),
      NotificationModel.deleteMany({ userId: user._id }),
      (UserModel as mongoose.Model<User>).deleteOne({ _id: user._id }),
    ]);

    // Audit log
    await auditService.log({
      userId: adminObjId,
      roleId: roleId ? new mongoose.Types.ObjectId(roleId) : null,
      module: 'User Management',
      actionCode: 'USER_DELETED',
      actionTitle: 'Customer Account Deleted',
      description: `Permanently deleted customer ${user.fullName} (${user.email}). Account had 0 bookings and 0 payment records.`,
      targetCollection: 'users',
      targetDocumentId: user._id,
      beforeData: {
        fullName: user.fullName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        accountStatus: user.accountStatus,
      },
      actionStatus: 'Success',
    });

    return {
      message: `Customer account ${user.fullName} (${user.email}) has been permanently deleted.`,
    };
  }
}

export const adminUsersService = new AdminUsersService();
