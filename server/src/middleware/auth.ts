import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { PermissionModel } from '../models/Permission.js';
import { RoleModel, type Role } from '../models/Role.js';
import { SessionModel, type Session } from '../models/Session.js';
import { UserModel, type User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  roleId?: string;
  sessionId?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      throw new AppError('Authentication required.', 401, 'E006');
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppError('Invalid authorization header format.', 401, 'E006');
    }

    const payload = verifyAccessToken(token);

    // If session ID is included in payload, verify active server-side session
    if (payload.sessionId) {
      const session = await (SessionModel as mongoose.Model<Session>)
        .findOne({ sessionId: payload.sessionId })
        .exec();

      if (
        !session ||
        session.sessionStatus !== 'Active' ||
        session.expiresAt.getTime() <= Date.now()
      ) {
        throw new AppError('Session has expired or been revoked.', 401, 'E039');
      }

      // Periodically update lastActivity (e.g. if older than 1 minute)
      if (Date.now() - session.lastActivity.getTime() > 60 * 1000) {
        session.lastActivity = new Date();
        await session.save().catch(() => {});
      }

      req.sessionId = payload.sessionId;
    }

    // Verify user eligibility
    const user = await (UserModel as mongoose.Model<User>).findOne({ _id: payload.userId }).exec();

    if (!user) {
      throw new AppError('User not found.', 401, 'E002');
    }

    if (user.accountStatus === 'Suspended') {
      throw new AppError('Account is suspended.', 403, 'E007');
    }

    if (user.accountStatus === 'Pending Approval') {
      throw new AppError('Your account is pending administrator approval.', 403, 'E043');
    }

    if (user.accountStatus === 'Pending Verification') {
      throw new AppError('Account verification is pending.', 403, 'E043');
    }

    if (user.accountStatus === 'Deactivated' || user.accountStatus === 'Deleted') {
      throw new AppError('Account is not eligible for authentication.', 403, 'E042');
    }

    req.userId = payload.userId;
    req.roleId = payload.roleId;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(new AppError('Invalid or expired access token.', 401, 'E039'));
  }
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.roleId || !mongoose.isValidObjectId(req.roleId)) {
        throw new AppError('Access denied: role not associated with session.', 403, 'E007');
      }

      const role = await (RoleModel as mongoose.Model<Role>).findById(req.roleId).lean().exec();

      if (!role || !role.isActive) {
        throw new AppError('Access denied: assigned role is inactive or not found.', 403, 'E007');
      }

      if (!allowedRoles.includes(role.roleCode)) {
        throw new AppError('Access denied: insufficient role privileges.', 403, 'E007');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(...requiredPermissions: string[]) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.roleId || !mongoose.isValidObjectId(req.roleId)) {
        throw new AppError('Access denied: role not associated with session.', 403, 'E007');
      }

      // Ensure Permission model is registered before populate
      void PermissionModel;

      const role = await (RoleModel as mongoose.Model<Role>)
        .findById(req.roleId)
        .populate<{ permissions: Array<{ permissionCode: string }> }>('permissions')
        .lean()
        .exec();

      if (!role || !role.isActive) {
        throw new AppError('Access denied: assigned role is inactive or not found.', 403, 'E007');
      }

      const assignedCodes = new Set((role.permissions || []).map((p) => p.permissionCode));
      const hasAll = requiredPermissions.every((code) => assignedCodes.has(code));

      if (!hasAll) {
        throw new AppError('Access denied: missing required permissions.', 403, 'E007');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
