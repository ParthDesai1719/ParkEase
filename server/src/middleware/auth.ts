import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  roleId?: string;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      throw new AppError('Authentication required.', 401);
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppError('Invalid authorization header.', 401);
    }

    const payload = verifyAccessToken(token);

    req.userId = payload.userId;
    req.roleId = payload.roleId;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(new AppError('Invalid or expired access token.', 401));
  }
}
