/**
 * Property Test: User-Friendly Error Messages
 * Feature: stock-market-dashboard
 * Property 24: User-Friendly Error Messages
 * Validates: Requirements 9.1
 * 
 * For any API failure, the system should display a user-friendly error message
 * explaining the issue and suggesting next steps, never exposing raw API errors
 * or stack traces.
 */

import fc from 'fast-check';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express, { Express } from 'express';
import request from 'supertest';
import errorHandler from '../../src/middleware/errorHandler.js';

describe('Property 24: User-Friendly Error Messages', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    // Reset environment
    delete process.env.NODE_ENV;
  });

  it('should always return user-friendly error messages for any error', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }), // HTTP status codes
        fc.string(), // Error message
        async (statusCode, errorMessage) => {
          app.get('/test-error', (req, res, next) => {
            const error = new Error(errorMessage);
            (error as Error & { statusCode?: number }).statusCode = statusCode;
            next(error);
          });

          app.use(errorHandler.handleError.bind(errorHandler));

          const response = await request(app).get('/test-error');

          // Property: Always returns user-friendly error structure
          expect(response.body).toHaveProperty('error');
          expect(response.body).toHaveProperty('message');
          expect(response.body).toHaveProperty('timestamp');
          
          // Property: Error name is user-friendly
          expect(typeof response.body.error).toBe('string');
          expect(response.body.error.length).toBeGreaterThan(0);
          
          // Property: Message is user-friendly (not raw error)
          expect(typeof response.body.message).toBe('string');
          expect(response.body.message.length).toBeGreaterThan(0);
          
          // Property: Never exposes raw error message in production
          if (process.env.NODE_ENV === 'production') {
            expect(response.body.message).not.toBe(errorMessage);
            expect(response.body).not.toHaveProperty('details');
          }
          
          // Property: Status code matches
          expect(response.status).toBe(statusCode);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should never expose stack traces in production', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.string(), // Error message
        fc.string(), // Stack trace
        async (errorMessage, stackTrace) => {
          process.env.NODE_ENV = 'production';

          app.get('/test-error', (req, res, next) => {
            const error = new Error(errorMessage);
            error.stack = stackTrace;
            (error as Error & { statusCode?: number }).statusCode = 500;
            next(error);
          });

          app.use(errorHandler.handleError.bind(errorHandler));

          const response = await request(app).get('/test-error');

          // Property: Never exposes stack trace in production
          expect(response.body).not.toHaveProperty('details');
          expect(response.body).not.toHaveProperty('stack');
          expect(JSON.stringify(response.body)).not.toContain(stackTrace);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should provide helpful error messages for common status codes', async () => {
    const statusCodeMap: Record<number, string> = {
      400: 'invalid',
      401: 'Authentication',
      403: 'permission',
      404: 'not found',
      429: 'too many',
      500: 'internal',
      503: 'unavailable'
    };

    for (const [statusCode, expectedKeyword] of Object.entries(statusCodeMap)) {
      app.get(`/test-${statusCode}`, (req, res, next) => {
        const error = new Error('Test error');
        (error as Error & { statusCode?: number }).statusCode = parseInt(statusCode, 10);
        next(error);
      });

      app.use(errorHandler.handleError.bind(errorHandler));

      const response = await request(app).get(`/test-${statusCode}`);

      // Property: Error message contains helpful keywords
      expect(response.body.message.toLowerCase()).toContain(expectedKeyword.toLowerCase());
      expect(response.status).toBe(parseInt(statusCode, 10));
    }
  });

  it('should always include timestamp in error responses', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }),
        async (statusCode) => {
          app.get('/test-timestamp', (req, res, next) => {
            const error = new Error('Test error');
            (error as Error & { statusCode?: number }).statusCode = statusCode;
            next(error);
          });

          app.use(errorHandler.handleError.bind(errorHandler));

          const response = await request(app).get('/test-timestamp');
          const timestamp = new Date(response.body.timestamp);

          // Property: Timestamp is always present and valid
          expect(response.body).toHaveProperty('timestamp');
          expect(timestamp.getTime()).not.toBeNaN();
          expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
        }
      ),
      { numRuns: 30 }
    );
  });
});

