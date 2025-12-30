import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import errorLoggingService from '../services/errorLoggingService.js';

interface ErrorWithStatus extends Error {
  statusCode?: number;
  status?: number;
}

interface HealthCheckResponse {
  status: string;
  message: string;
  brokerId?: string;
  clusterId?: string;
}

/**
 * Error handler middleware
 * Provides user-friendly error messages and proper error logging
 * Implements Requirements 9.1, 10.2
 */
class ErrorHandler {
  /**
   * Handle general application errors
   * Logs errors to PostgreSQL and provides user-friendly messages
   */
  handleError(err: ErrorWithStatus, req: Request, res: Response, next: NextFunction): void {
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal Server Error';
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    // Log to console (Winston)
    logger.error({
      error: message,
      stack: err.stack,
      method: req.method,
      url: req.url,
      ip: ipAddress,
      timestamp: new Date().toISOString()
    });

    // Log to PostgreSQL (async, don't wait)
    errorLoggingService.logError({
      errorType: err.constructor.name || 'Error',
      errorMessage: message,
      errorStack: err.stack,
      statusCode,
      method: req.method,
      url: req.url,
      ipAddress,
      userAgent,
      serviceName: 'api-gateway',
      requestBody: this.sanitizeRequestBody(req.body),
      userId: (req as Request & { userId?: string }).userId,
      severity: statusCode >= 500 ? 'critical' : statusCode >= 400 ? 'error' : 'warning'
    }).catch((logError: Error) => {
      // Fallback logging if PostgreSQL logging fails
      logger.error('Failed to log error to PostgreSQL:', logError);
    });

    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Get user-friendly error response
    const userFriendlyError = ErrorHandler.prototype.getUserFriendlyError(statusCode);
    const userFriendlyMessage = isDevelopment 
      ? message 
      : ErrorHandler.prototype.getUserFriendlyMessage(statusCode);

    res.status(statusCode).json({
      error: userFriendlyError,
      message: userFriendlyMessage,
      timestamp: new Date().toISOString(),
      ...(isDevelopment && { details: err.stack })
    });
  }

  /**
   * Sanitize request body for logging (remove sensitive data)
   */
  private sanitizeRequestBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body as Record<string, unknown> };
    const sensitiveKeys = ['password', 'apiKey', 'token', 'secret', 'authorization'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Handle service proxy errors
   * Logs service errors to PostgreSQL
   */
  handleServiceError(res: Response, serviceName: string, err: Error, req?: Request): void {
    const ipAddress = req?.ip || req?.connection.remoteAddress || 'unknown';
    const userAgent = req?.get('user-agent') || 'unknown';

    // Log to console
    logger.error({
      service: serviceName,
      error: err.message,
      code: (err as Error & { code?: string }).code,
      timestamp: new Date().toISOString()
    });

    // Log to PostgreSQL (async, don't wait)
    errorLoggingService.logError({
      errorType: 'ServiceError',
      errorMessage: `Service ${serviceName} unavailable: ${err.message}`,
      errorStack: err.stack,
      statusCode: 503,
      method: req?.method,
      url: req?.url,
      ipAddress,
      userAgent,
      serviceName,
      userId: (req as Request & { userId?: string })?.userId,
      severity: 'error'
    }).catch((logError: Error) => {
      logger.error('Failed to log service error to PostgreSQL:', logError);
    });

    res.status(503).json({
      error: 'Service Unavailable',
      message: `The ${serviceName} is currently unavailable. Please try again later.`,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get user-friendly error name based on status code
   */
  getUserFriendlyError(statusCode: number): string {
    const errorMap: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Validation Error',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };

    return errorMap[statusCode] || 'Error';
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(statusCode: number): string {
    const messageMap: Record<number, string> = {
      400: 'The request is invalid. Please check your input and try again.',
      401: 'Authentication required. Please log in and try again.',
      403: 'You do not have permission to access this resource.',
      404: 'The requested resource was not found.',
      409: 'A conflict occurred. The resource may already exist.',
      422: 'The request data is invalid. Please check your input.',
      429: 'Too many requests. Please wait a moment and try again.',
      500: 'An internal server error occurred. Please try again later.',
      502: 'The service is temporarily unavailable. Please try again later.',
      503: 'The service is currently unavailable. Please try again later.',
      504: 'The request timed out. Please try again later.'
    };

    return messageMap[statusCode] || 'An error occurred. Please try again later.';
  }
}

export default new ErrorHandler();

