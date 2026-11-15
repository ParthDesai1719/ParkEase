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

  // Handle Mongoose CastError (e.g. invalid ObjectId format)
  if (error && typeof error === 'object' && 'name' in error && error.name === 'CastError') {
    res.status(400).json({
      success: false,
      errorCode: 'E001',
      message: 'Invalid resource identifier format.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle body-parser syntax errors as 400 Bad Request
  if (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as { status?: number }).status === 400 &&
    'body' in error
  ) {
    res.status(400).json({
      success: false,
      errorCode: 'E001',
      message: 'Malformed JSON payload in request body.',
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
