import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/AppError.js';

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(', ');

      next(new AppError(message, 400));
      return;
    }

    req.body = result.data;
    next();
  };
}
