import type { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      ...(error.errorCode ? { errorCode: error.errorCode } : {}),
      message: error.message,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  console.error('Unhandled server error:', error);

  res.status(500).json({
    success: false,
    errorCode: 'E031',
    message: 'Internal server error.',
    timestamp: new Date().toISOString(),
  });
};
