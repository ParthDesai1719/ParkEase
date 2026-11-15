import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { notificationService } from '../services/notification.service.js';
import { AppError } from '../utils/AppError.js';

function getAuthUserId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  const id = authReq.userId || (req as any).user?._id || (req as any).user?.id;
  if (!id) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }
  return id.toString();
}

export class NotificationController {
  public async getMyNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const { isRead, type, page, limit } = req.query;

      let isReadFilter: boolean | undefined = undefined;
      if (isRead === 'true') isReadFilter = true;
      if (isRead === 'false') isReadFilter = false;

      const result = await notificationService.getUserNotifications(userId, {
        isRead: isReadFilter,
        notificationType: typeof type === 'string' ? type : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const unreadCount = await notificationService.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        data: { unreadCount },
      });
    } catch (err) {
      next(err);
    }
  }

  public async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const id = String(req.params.id);

      const updated = await notificationService.markAsRead(userId, id);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  public async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const result = await notificationService.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public async deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const id = String(req.params.id);

      await notificationService.deleteNotification(userId, id);

      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  }

  public async clearAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getAuthUserId(req);
      const result = await notificationService.clearAll(userId);

      res.status(200).json({
        success: true,
        message: 'All notifications cleared.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const notificationController = new NotificationController();
