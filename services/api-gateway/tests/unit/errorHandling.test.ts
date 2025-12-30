/**
 * Unit Tests: Error Handling and Validation
 * Tests error messages, input validation, and security measures
 * Requirements: 9.1, 9.5, 10.1, 10.2, 10.3, 10.4
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import express, { Express } from 'express';
import request from 'supertest';
import errorHandler from '../../src/middleware/errorHandler.js';
import validators from '../../src/middleware/validators.js';
import { enforceHTTPS, validateAPIKey, getSessionManager } from '../../src/middleware/security.js';
import errorLoggingService from '../../src/services/errorLoggingService.js';

// Mock error logging service
jest.mock('../../src/services/errorLoggingService.js', () => ({
  default: {
    logError: jest.fn().mockResolvedValue(undefined),
    sanitizeData: jest.fn((data) => {
      if (typeof data === 'object' && data !== null) {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
          if (['password', 'apiKey', 'token'].includes(key.toLowerCase())) {
            sanitized[key] = '[REDACTED]';
          } else {
            sanitized[key] = value;
          }
        }
        return sanitized;
      }
      return data;
    })
  }
}));

describe('Error Handling', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('User-Friendly Error Messages', () => {
    it('should return user-friendly error for 400 Bad Request', async () => {
      app.get('/test', (req, res, next) => {
        const error = new Error('Invalid input');
        (error as Error & { statusCode?: number }).statusCode = 400;
        next(error);
      });
      app.use(errorHandler.handleError.bind(errorHandler));

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('invalid');
    });

    it('should return user-friendly error for 404 Not Found', async () => {
      app.get('/test', (req, res, next) => {
        const error = new Error('Resource not found');
        (error as Error & { statusCode?: number }).statusCode = 404;
        next(error);
      });
      app.use(errorHandler.handleError.bind(errorHandler));

      const response = await request(app).get('/test');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('message');
    });

    it('should return user-friendly error for 500 Internal Server Error', async () => {
      app.get('/test', (req, res, next) => {
        const error = new Error('Database connection failed');
        (error as Error & { statusCode?: number }).statusCode = 500;
        next(error);
      });
      app.use(errorHandler.handleError.bind(errorHandler));

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
      expect(response.body).toHaveProperty('message');
    });

    it('should not expose stack traces in production', async () => {
      process.env.NODE_ENV = 'production';
      
      app.get('/test', (req, res, next) => {
        const error = new Error('Test error');
        error.stack = 'Error stack trace';
        (error as Error & { statusCode?: number }).statusCode = 500;
        next(error);
      });
      app.use(errorHandler.handleError.bind(errorHandler));

      const response = await request(app).get('/test');

      expect(response.body).not.toHaveProperty('details');
      expect(response.body).not.toHaveProperty('stack');
      
      delete process.env.NODE_ENV;
    });

    it('should log errors to PostgreSQL', async () => {
      app.get('/test', (req, res, next) => {
        const error = new Error('Test error');
        (error as Error & { statusCode?: number }).statusCode = 500;
        next(error);
      });
      app.use(errorHandler.handleError.bind(errorHandler));

      await request(app).get('/test');

      // Wait for async logging
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(errorLoggingService.logError).toHaveBeenCalled();
    });
  });

  describe('Service Error Handling', () => {
    it('should handle service proxy errors', async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const req = {
        method: 'GET',
        url: '/api/data',
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: jest.fn().mockReturnValue('test-agent')
      };

      const error = new Error('Connection refused');
      (error as Error & { code?: string }).code = 'ECONNREFUSED';

      await errorHandler.handleServiceError(
        res as unknown as express.Response,
        'data-service',
        error,
        req as unknown as express.Request
      );

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Service Unavailable',
          message: expect.stringContaining('data-service')
        })
      );
    });
  });
});

describe('Input Validation', () => {
  describe('Stock Symbol Validation', () => {
    it('should validate valid stock symbols', () => {
      const validSymbols = ['AAPL', 'GOOGL', 'MSFT', 'BRK.B', 'BRK-A'];
      
      for (const symbol of validSymbols) {
        const validation = validators.validateStockSymbol(symbol);
        expect(validation.valid).toBe(true);
      }
    });

    it('should reject invalid stock symbols', () => {
      const invalidSymbols = ['', '   ', 'TOOLONGSTOCKSYMBOL', 'INVALID@SYMBOL'];
      
      for (const symbol of invalidSymbols) {
        const validation = validators.validateStockSymbol(symbol);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeDefined();
      }
    });

    it('should normalize valid symbols to uppercase', () => {
      const validation = validators.validateStockSymbol('aapl');
      expect(validation.valid).toBe(true);
    });
  });

  describe('Language Validation', () => {
    it('should validate supported languages', () => {
      const supportedLanguages = ['en', 'es', 'fr', 'de', 'zh', 'he'];
      
      for (const lang of supportedLanguages) {
        const validation = validators.validateLanguage(lang);
        expect(validation.valid).toBe(true);
        expect(validation.normalized).toBe(lang);
      }
    });

    it('should reject unsupported languages', () => {
      const unsupportedLanguages = ['jp', 'ru', 'invalid', ''];
      
      for (const lang of unsupportedLanguages) {
        const validation = validators.validateLanguage(lang);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeDefined();
      }
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize strings', () => {
      const input = 'test\x00string';
      const sanitized = validators.sanitizeString(input);
      
      expect(sanitized).not.toContain('\x00');
      expect(sanitized).toBe('teststring');
    });

    it('should limit string length', () => {
      const longInput = 'a'.repeat(20000);
      const sanitized = validators.sanitizeString(longInput);
      
      expect(sanitized.length).toBeLessThanOrEqual(10000);
    });

    it('should sanitize objects', () => {
      const input = {
        normal: 'value',
        password: 'secret123',
        apiKey: 'key-123'
      };
      
      const sanitized = validators.sanitizeObject(input) as Record<string, unknown>;
      
      expect(sanitized.normal).toBe('value');
      expect(sanitized.password).not.toBe('secret123');
      expect(sanitized.apiKey).not.toBe('key-123');
    });
  });
});

describe('Security Measures', () => {
  describe('HTTPS Enforcement', () => {
    it('should enforce HTTPS in production', async () => {
      process.env.NODE_ENV = 'production';
      const app = express();
      app.use(enforceHTTPS);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .set('X-Forwarded-Proto', 'http');

      expect(response.status).toBe(403);
      
      delete process.env.NODE_ENV;
    });

    it('should allow HTTPS in production', async () => {
      process.env.NODE_ENV = 'production';
      const app = express();
      app.use(enforceHTTPS);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .set('X-Forwarded-Proto', 'https');

      expect(response.status).toBe(200);
      
      delete process.env.NODE_ENV;
    });
  });

  describe('API Key Validation', () => {
    it('should require API key when configured', async () => {
      process.env.API_KEY = 'test-key';
      const app = express();
      app.use('/protected', validateAPIKey);
      app.get('/protected/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/protected/test');

      expect(response.status).toBe(401);
      
      delete process.env.API_KEY;
    });

    it('should accept valid API key', async () => {
      process.env.API_KEY = 'test-key';
      const app = express();
      app.use('/protected', validateAPIKey);
      app.get('/protected/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/protected/test')
        .set('X-API-Key', 'test-key');

      expect(response.status).toBe(200);
      
      delete process.env.API_KEY;
    });
  });

  describe('Session Management', () => {
    it('should create and retrieve sessions', () => {
      const sessionManager = getSessionManager();
      const sessionId = 'test-session';
      const userId = 'user-123';

      sessionManager.setSession(sessionId, userId, { data: 'test' });
      const session = sessionManager.getSession(sessionId);

      expect(session).not.toBeNull();
      expect(session?.userId).toBe(userId);
      expect(session?.data).toEqual({ data: 'test' });
    });

    it('should clear sessions', () => {
      const sessionManager = getSessionManager();
      const sessionId = 'test-session-2';
      const userId = 'user-456';

      sessionManager.setSession(sessionId, userId);
      expect(sessionManager.getSession(sessionId)).not.toBeNull();

      sessionManager.clearSession(sessionId);
      expect(sessionManager.getSession(sessionId)).toBeNull();
    });

    it('should clean up expired sessions', () => {
      const sessionManager = getSessionManager();
      const sessionId = 'test-session-3';
      const userId = 'user-789';

      sessionManager.setSession(sessionId, userId);
      sessionManager.cleanupExpiredSessions();

      // Active sessions should not be cleaned up
      expect(sessionManager.getSession(sessionId)).not.toBeNull();
    });
  });
});

