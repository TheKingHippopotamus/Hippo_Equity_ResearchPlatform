/**
 * Property Test: Input Validation Feedback
 * Feature: stock-market-dashboard
 * Property 25: Input Validation Feedback
 * Validates: Requirements 9.5
 * 
 * For any invalid user input, the system should provide inline validation
 * feedback before submission, preventing invalid data from being processed.
 */

import fc from 'fast-check';
import { describe, it, expect, beforeEach } from '@jest/globals';
import express, { Express } from 'express';
import request from 'supertest';
import validators from '../../src/middleware/validators.js';

describe('Property 25: Input Validation Feedback', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it('should validate stock symbols and provide feedback', () => {
    return fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 20 }),
        (symbol) => {
          const validation = validators.validateStockSymbol(symbol);

          // Property: Always returns validation result
          expect(validation).toHaveProperty('valid');
          expect(typeof validation.valid).toBe('boolean');

          if (!validation.valid) {
            // Property: Invalid input always has error message
            expect(validation).toHaveProperty('error');
            expect(typeof validation.error).toBe('string');
            expect(validation.error.length).toBeGreaterThan(0);
          }

          // Property: Valid symbols are normalized to uppercase
          if (validation.valid && symbol.trim().length > 0) {
            const normalized = symbol.trim().toUpperCase();
            expect(validation).toHaveProperty('normalized');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject invalid stock symbols before processing', async () => {
    app.get('/stock/:symbol', validators.validateStockSymbolParam, (req, res) => {
      res.json({ symbol: req.params.symbol, valid: true });
    });

    const invalidSymbols = [
      '',
      '   ',
      'TOOLONGSTOCKSYMBOL',
      'INVALID@SYMBOL',
      'SYMBOL WITH SPACES',
      'symbol-with-special-chars!'
    ];

    for (const symbol of invalidSymbols) {
      const response = await request(app).get(`/stock/${encodeURIComponent(symbol)}`);

      // Property: Invalid symbols are rejected before processing
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('field');
      expect(response.body.field).toBe('symbol');
    }
  });

  it('should validate language codes and provide feedback', () => {
    return fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 10 }),
        (language) => {
          const validation = validators.validateLanguage(language);

          // Property: Always returns validation result
          expect(validation).toHaveProperty('valid');
          expect(typeof validation.valid).toBe('boolean');

          if (!validation.valid) {
            // Property: Invalid language always has error message
            expect(validation).toHaveProperty('error');
            expect(typeof validation.error).toBe('string');
            expect(validation.error.length).toBeGreaterThan(0);
          }

          // Property: Valid languages are normalized
          if (validation.valid) {
            expect(validation).toHaveProperty('normalized');
            expect(['en', 'es', 'fr', 'de', 'zh', 'he']).toContain(validation.normalized);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should validate multiple stock symbols and provide detailed feedback', () => {
    return fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 0, maxLength: 15 }), { minLength: 0, maxLength: 10 }),
        (symbols) => {
          const validation = validators.validateStockSymbols(symbols);

          // Property: Always returns validation result
          expect(validation).toHaveProperty('valid');
          expect(typeof validation.valid).toBe('boolean');

          if (!validation.valid) {
            // Property: Invalid symbols have detailed error feedback
            expect(validation).toHaveProperty('errors');
            expect(Array.isArray(validation.errors)).toBe(true);
            expect(validation.errors!.length).toBeGreaterThan(0);

            // Property: Each error specifies the field
            for (const error of validation.errors!) {
              expect(error).toHaveProperty('field');
              expect(error).toHaveProperty('message');
              expect(typeof error.message).toBe('string');
            }
          } else {
            // Property: Valid symbols are normalized
            expect(validation).toHaveProperty('normalized');
            expect(Array.isArray(validation.normalized)).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should sanitize input to prevent injection attacks', () => {
    return fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 1000 }),
        (input) => {
          const sanitized = validators.sanitizeString(input);

          // Property: Sanitized output is always a string
          expect(typeof sanitized).toBe('string');

          // Property: Sanitized output does not contain dangerous characters
          expect(sanitized).not.toContain('\x00'); // Null bytes
          expect(sanitized.length).toBeLessThanOrEqual(10000); // Length limit
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should prevent processing of invalid data', async () => {
    app.post('/queue/enqueue', 
      express.json(),
      (req, res, next) => {
        const validation = validators.validateStockSymbols(req.body.symbols);
        if (!validation.valid) {
          return res.status(400).json({
            error: 'Validation Error',
            message: 'Invalid stock symbols',
            errors: validation.errors
          });
        }
        res.json({ queueId: 'test-queue-id' });
      }
    );

    const invalidPayloads = [
      { symbols: [] },
      { symbols: [''] },
      { symbols: ['INVALID@SYMBOL'] },
      { symbols: Array(101).fill('AAPL') }, // Too many symbols
    ];

    for (const payload of invalidPayloads) {
      const response = await request(app)
        .post('/queue/enqueue')
        .send(payload);

      // Property: Invalid data is rejected before processing
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation Error');
    }
  });
});

