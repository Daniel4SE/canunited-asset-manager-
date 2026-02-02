import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, code: string, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
    return;
  }

  // Handle validation errors from Zod
  if (err.name === 'ZodError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err
      }
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      }
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired'
      }
    });
    return;
  }

  // Default error
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message
    }
  });
}

// Helper functions to throw common errors
export function notFound(resource: string): never {
  throw new AppError(`${resource} not found`, 404, 'NOT_FOUND');
}

export function badRequest(message: string, details?: Record<string, unknown>): never {
  throw new AppError(message, 400, 'BAD_REQUEST', details);
}

export function unauthorized(message = 'Unauthorized'): never {
  throw new AppError(message, 401, 'UNAUTHORIZED');
}

export function forbidden(message = 'Access denied'): never {
  throw new AppError(message, 403, 'FORBIDDEN');
}

export function conflict(message: string): never {
  throw new AppError(message, 409, 'CONFLICT');
}
