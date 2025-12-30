import { Pool } from 'pg';
import postgresClient from '../config/postgres.js';
import logger from '../utils/logger.js';

export interface ErrorLogEntry {
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  statusCode?: number;
  method?: string;
  url?: string;
  ipAddress?: string;
  userAgent?: string;
  serviceName?: string;
  requestBody?: unknown;
  responseBody?: unknown;
  userId?: string;
  severity?: 'error' | 'warning' | 'critical';
}

/**
 * Service for logging errors to PostgreSQL
 * Implements Requirement 10.2: Sensitive Data Logging Protection
 */
class ErrorLoggingService {
  private pool: Pool | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize the error logging service
   */
  async initialize(): Promise<void> {
    try {
      this.pool = await postgresClient.connect();
      this.isInitialized = true;
      logger.info('Error logging service initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initialize error logging service: ${errorMessage}`);
      // Don't throw - allow service to continue without error logging
      this.isInitialized = false;
    }
  }

  /**
   * Log an error to PostgreSQL
   * Sanitizes sensitive data before logging (Requirement 10.2)
   */
  async logError(entry: ErrorLogEntry): Promise<void> {
    if (!this.isInitialized || !this.pool) {
      // Fallback to console logging if PostgreSQL is unavailable
      logger.error('Error logging service not initialized, logging to console:', entry);
      return;
    }

    try {
      // Sanitize sensitive data from request/response bodies
      const sanitizedRequestBody = this.sanitizeData(entry.requestBody);
      const sanitizedResponseBody = this.sanitizeData(entry.responseBody);

      await this.pool.query(
        `INSERT INTO error_logging.error_logs (
          error_type, error_message, error_stack, status_code,
          method, url, ip_address, user_agent, service_name,
          request_body, response_body, user_id, severity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          entry.errorType,
          entry.errorMessage,
          entry.errorStack || null,
          entry.statusCode || null,
          entry.method || null,
          entry.url || null,
          entry.ipAddress || null,
          entry.userAgent || null,
          entry.serviceName || null,
          sanitizedRequestBody ? JSON.stringify(sanitizedRequestBody) : null,
          sanitizedResponseBody ? JSON.stringify(sanitizedResponseBody) : null,
          entry.userId || null,
          entry.severity || 'error'
        ]
      );
    } catch (error) {
      // Don't throw - log to console as fallback
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to log error to PostgreSQL: ${errorMessage}`);
      logger.error('Original error entry:', entry);
    }
  }

  /**
   * Sanitize sensitive data from objects
   * Removes passwords, API keys, tokens, and other sensitive information
   * Implements Requirement 10.2: Sensitive Data Logging Protection
   */
  sanitizeData(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    const sensitiveKeys = [
      'password',
      'apiKey',
      'api_key',
      'apikey',
      'token',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'secret',
      'secretKey',
      'secret_key',
      'authorization',
      'auth',
      'creditCard',
      'credit_card',
      'ssn',
      'socialSecurityNumber',
      'cvv',
      'cvc'
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitiveKey => 
        lowerKey.includes(sensitiveKey)
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Get error logs with optional filters
   */
  async getErrorLogs(filters: {
    serviceName?: string;
    statusCode?: number;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<unknown[]> {
    if (!this.isInitialized || !this.pool) {
      logger.warn('Error logging service not initialized');
      return [];
    }

    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (filters.serviceName) {
        conditions.push(`service_name = $${paramIndex++}`);
        values.push(filters.serviceName);
      }

      if (filters.statusCode) {
        conditions.push(`status_code = $${paramIndex++}`);
        values.push(filters.statusCode);
      }

      if (filters.severity) {
        conditions.push(`severity = $${paramIndex++}`);
        values.push(filters.severity);
      }

      if (filters.startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        values.push(filters.startDate);
      }

      if (filters.endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        values.push(filters.endDate);
      }

      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const limit = filters.limit || 100;
      values.push(limit);

      const query = `
        SELECT * FROM error_logging.error_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex}
      `;

      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to retrieve error logs: ${errorMessage}`);
      return [];
    }
  }
}

// Singleton instance
const errorLoggingService = new ErrorLoggingService();

export default errorLoggingService;

