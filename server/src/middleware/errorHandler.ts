import type { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  console.error('Unhandled server error:', error);

  res.status(500).json({
    success: false,
    message: 'Internal server error.',
  });
};
