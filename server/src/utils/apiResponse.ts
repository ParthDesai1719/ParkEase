import type { Response } from 'express';

export function sendSuccess<T>(res: Response, message: string, data?: T, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
  });
}
