import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

// Custom error types
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, isOperational = true, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, true, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, true, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class TradingError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 400, true, code || 'TRADING_ERROR');
    this.name = 'TradingError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, true, 'RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}

export class ErrorHandler {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   * Main error handling middleware
   */
  handleError = (error: Error, req: Request, res: Response, next: NextFunction): void => {
    let appError: AppError;

    // Convert known error types to AppError
    if (error instanceof AppError) {
      appError = error;
    } else if (error.name === 'ValidationError') {
      appError = new ValidationError(error.message);
    } else if (error.name === 'JsonWebTokenError') {
      appError = new AuthenticationError('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      appError = new AuthenticationError('Token expired');
    } else if (error.name === 'MongoError' || error.name === 'PostgresError') {
      appError = new AppError('Database error', 500, false, 'DB_ERROR');
    } else if (error.message.includes('ECONNREFUSED')) {
      appError = new AppError('Service unavailable', 503, false, 'SERVICE_UNAVAILABLE');
    } else {
      // Unknown error
      appError = new AppError('Internal server error', 500, false, 'INTERNAL_ERROR');
    }

    // Log error
    this.logError(appError, req);

    // Send error response
    this.sendErrorResponse(appError, res);
  };

  /**
   * Handle async errors
   */
  asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  /**
   * 404 handler for undefined routes
   */
  notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
    const error = new NotFoundError(`Route ${req.originalUrl} not found`);
    next(error);
  };

  /**
   * Log error details
   */
  private logError(error: AppError, req: Request): void {
    const errorDetails = {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString()
    };

    if (error.statusCode >= 500) {
      this.logger.error('Server Error:', errorDetails);
    } else if (error.statusCode >= 400) {
      this.logger.warn('Client Error:', errorDetails);
    } else {
      this.logger.info('Error:', errorDetails);
    }
  }

  /**
   * Send error response to client
   */
  private sendErrorResponse(error: AppError, res: Response): void {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const errorResponse: any = {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode
      }
    };

    // Include stack trace in development
    if (isDevelopment && error.isOperational) {
      errorResponse.error.stack = error.stack;
    }

    // Add additional context for specific errors
    if (error instanceof ValidationError) {
      errorResponse.error.type = 'validation';
    } else if (error instanceof TradingError) {
      errorResponse.error.type = 'trading';
    } else if (error instanceof RateLimitError) {
      errorResponse.error.type = 'rate_limit';
      errorResponse.error.retryAfter = 60; // seconds
    }

    res.status(error.statusCode).json(errorResponse);
  }

  /**
   * Handle unhandled promise rejections
   */
  handleUnhandledRejection = (reason: any, promise: Promise<any>): void => {
    this.logger.error('Unhandled Promise Rejection:', {
      reason: reason.toString(),
      stack: reason.stack,
      timestamp: new Date().toISOString()
    });

    // Gracefully close server
    process.exit(1);
  };

  /**
   * Handle uncaught exceptions
   */
  handleUncaughtException = (error: Error): void => {
    this.logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Gracefully close server
    process.exit(1);
  };
}

// Global error handler setup
export const setupGlobalErrorHandlers = (logger: winston.Logger): void => {
  const errorHandler = new ErrorHandler(logger);

  process.on('unhandledRejection', errorHandler.handleUnhandledRejection);
  process.on('uncaughtException', errorHandler.handleUncaughtException);
};

// Factory function to create error handler
export const createErrorHandler = (logger: winston.Logger) => {
  return new ErrorHandler(logger);
};

// Utility functions for throwing specific errors
export const throwValidationError = (message: string): never => {
  throw new ValidationError(message);
};

export const throwAuthError = (message?: string): never => {
  throw new AuthenticationError(message);
};

export const throwAuthorizationError = (message?: string): never => {
  throw new Auth