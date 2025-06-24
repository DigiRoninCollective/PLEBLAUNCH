import { Request, Response, NextFunction } from 'express';
import config from '../config/config';

export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;

  if (!(error instanceof AppError)) {
    error = new AppError(
      'Internal Server Error',
      500
    );
  }

  const appError = error as AppError;

  if (process.env.NODE_ENV === 'development') {
    config.logger.error('Error:', {
      message: error.message,
      stack: error.stack,
      statusCode: appError.statusCode
    });

    res.status(appError.statusCode).json({
      status: appError.status,
      error: error,
      message: error.message,
      stack: error.stack
    });
  } else {
    // Production error response
    if (appError.isOperational) {
      res.status(appError.statusCode).json({
        status: appError.status,
        message: error.message
      });
    } else {
      // Programming or unknown errors
      config.logger.error('Error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
  }
};
