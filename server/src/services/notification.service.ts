import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { NotificationModel, type Notification } from '../models/Notification.js';
import { UserModel, type User } from '../models/User.js';
import { RoleModel, type Role } from '../models/Role.js';
import { emitNewNotification } from '../socket.js';
import { AppError } from '../utils/AppError.js';

export interface CreateNotificationParams {
  userId: string | mongoose.Types.ObjectId;
  senderId?: string | mongoose.Types.ObjectId | null | undefined;
  bookingId?: string | mongoose.Types.ObjectId | null | undefined;
  paymentId?: string | mongoose.Types.ObjectId | null | undefined;
  templateId?: string | mongoose.Types.ObjectId | null | undefined;
  notificationType: string;
  eventType: string;
  title: string;
  message: string;
  priority?: 'Low' | 'Normal' | 'High' | 'Critical' | undefined;
  deliveryChannel?: 'In-App' | 'Email' | 'Push Notification' | undefined;
  actionUrl?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
  expiresAt?: Date | null | undefined;
}

export class NotificationService {
  /**
   * Generates a unique canonical notification reference
   */
  private generateNotificationReference(): string {
    const year = new Date().getFullYear();
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `NOTIF-${year}-${rand}`;
  }

  /**
   * Create an in-app notification for a specific user and broadcast in real-time
   */
  public async createNotification(params: CreateNotificationParams): Promise<Notification> {
    const reference = this.generateNotificationReference();

    const notif = await NotificationModel.create({
      notificationReference: reference,
      userId: new mongoose.Types.ObjectId(params.userId.toString()),
      senderId: params.senderId ? new mongoose.Types.ObjectId(params.senderId.toString()) : null,
      bookingId: params.bookingId ? new mongoose.Types.ObjectId(params.bookingId.toString()) : null,
      paymentId: params.paymentId ? new mongoose.Types.ObjectId(params.paymentId.toString()) : null,
      templateId: params.templateId ? new mongoose.Types.ObjectId(params.templateId.toString()) : null,
      notificationType: params.notificationType,
      eventType: params.eventType,
      title: params.title.trim().slice(0, 100),
      message: params.message.trim().slice(0, 500),
      priority: params.priority || 'Normal',
      deliveryChannel: params.deliveryChannel || 'In-App',
      deliveryStatus: 'Delivered',
      deliveredAt: new Date(),
      isRead: false,
      readAt: null,
      actionUrl: params.actionUrl || null,
      metadata: params.metadata || {},
      expiresAt: params.expiresAt || null,
    });

    // Real-time dispatch via Socket.IO
    try {
      emitNewNotification(params.userId.toString(), notif.toJSON());
    } catch {
      // Non-blocking socket dispatch
    }

    return notif.toObject();
  }

  /**
   * Broadcast notification to all active system administrators
   */
  public async notifyAdmins(params: {
    title: string;
    message: string;
    notificationType?: string;
    eventType?: string;
    priority?: 'Low' | 'Normal' | 'High' | 'Critical';
    actionUrl?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const adminRole = await (RoleModel as mongoose.Model<Role>).findOne({ roleCode: 'ADMIN' });
    if (!adminRole) return;

    const admins = await (UserModel as mongoose.Model<User>).find({
      roleId: adminRole._id,
      accountStatus: 'Active',
    }).select('_id');

    for (const admin of admins) {
      await this.createNotification({
        userId: admin._id.toString(),
        notificationType: params.notificationType || 'System',
        eventType: (params.eventType as any) || 'Parking Facility Submitted',
        title: params.title,
        message: params.message,
        priority: params.priority || 'Normal',
        actionUrl: params.actionUrl || null,
        metadata: params.metadata,
      });
    }
  }

  /**
   * Get user notifications with filtering, pagination, and unread counts
   */
  public async getUserNotifications(
    userId: string,
    options: {
      isRead?: boolean | undefined;
      notificationType?: string | undefined;
      page?: number | undefined;
      limit?: number | undefined;
    } = {},
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
    page: number;
    totalPages: number;
  }> {
    const userConditions = mongoose.Types.ObjectId.isValid(userId)
      ? [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: userId }]
      : [{ userId: userId }];

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = { $or: userConditions };

    if (options.isRead !== undefined) {
      filter.isRead = options.isRead;
    }

    if (options.notificationType && options.notificationType !== 'All') {
      filter.notificationType = options.notificationType;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      (NotificationModel as mongoose.Model<Notification>)
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationModel.countDocuments(filter),
      NotificationModel.countDocuments({ $or: userConditions, isRead: false }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      notifications: notifications as unknown as Notification[],
      total,
      unreadCount,
      page,
      totalPages,
    };
  }

  /**
   * Quick unread notifications count query
   */
  public async getUnreadCount(userId: string): Promise<number> {
    const userConditions = mongoose.Types.ObjectId.isValid(userId)
      ? [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: userId }]
      : [{ userId: userId }];
    return NotificationModel.countDocuments({
      $or: userConditions,
      isRead: false,
    });
  }

  /**
   * Mark a specific notification as read
   */
  public async markAsRead(userId: string, notificationId: string): Promise<Notification> {
    const userConditions = mongoose.Types.ObjectId.isValid(userId)
      ? [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: userId }]
      : [{ userId: userId }];
    const notifObjId = mongoose.Types.ObjectId.isValid(notificationId)
      ? new mongoose.Types.ObjectId(notificationId)
      : notificationId;

    const notif = await (NotificationModel as mongoose.Model<Notification>).findOneAndUpdate(
      {
        _id: notifObjId,
        $or: userConditions,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true },
    );

    if (!notif) {
      throw new AppError('Notification not found.', 404, 'NOTIFICATION_NOT_FOUND');
    }

    return (notif as any).toObject ? (notif as any).toObject() : notif;
  }

  /**
   * Mark all notifications as read for current user
   */
  public async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    const userConditions = mongoose.Types.ObjectId.isValid(userId)
      ? [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: userId }]
      : [{ userId: userId }];
    const result = await NotificationModel.updateMany(
      {
        $or: userConditions,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
    );

    return { modifiedCount: result.modifiedCount };
  }

  /**
   * Delete a notification
   */
  public async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const userConditions = mongoose.Types.ObjectId.isValid(userId)
      ? [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: userId }]
      : [{ userId: userId }];
    const notifObjId = mongoose.Types.ObjectId.isValid(notificationId)
      ? new mongoose.Types.ObjectId(notificationId)
      : notificationId;

    const result = await NotificationModel.deleteOne({
      _id: notifObjId,
      $or: userConditions,
    });

    if (result.deletedCount === 0) {
      throw new AppError('Notification not found.', 404, 'NOTIFICATION_NOT_FOUND');
    }
  }

  /**
   * Clear all read notifications (or all notifications) for user
   */
  public async clearAll(userId: string): Promise<{ deletedCount: number }> {
    const userConditions = mongoose.Types.ObjectId.isValid(userId)
      ? [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: userId }]
      : [{ userId: userId }];
    const result = await NotificationModel.deleteMany({
      $or: userConditions,
    });

    return { deletedCount: result.deletedCount };
  }
}

export const notificationService = new NotificationService();
