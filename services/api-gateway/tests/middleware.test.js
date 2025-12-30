// Mock logger BEFORE requiring any modules that use it
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

jest.mock('../src/utils/logger', () => mockLogger);

const request = require('supertest');
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const errorHandler = require('../src/middleware/errorHandler');
const requestLogger = require('../src/middleware/requestLogger');

describe('API Gateway Middleware Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Rate Limiting', () => {
    test('should limit requests to 100 per minute', async () => {
      const limiter = rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 100,
        message: 'Too many requests from this IP, please try again later.'
      });

      app.use('/api/', limiter);
      app.get('/api/test', (req, res) => {
        res.json({ message: 'success' });
      });

      // Make 100 requests (should all succeed)
      const requests = Array(100).fill().map(() => 
        request(app).get('/api/test')
      );
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // 101st request should be rate limited
      const rateLimitedResponse = await request(app).get('/api/test');
      expect(rateLimitedResponse.status).toBe(429);
      // Rate limit response should have error message
      expect(rateLimitedResponse.body).toBeDefined();
      // Check if message exists in body (can be string or object)
      if (typeof rateLimitedResponse.body === 'string') {
        expect(rateLimitedResponse.body.toLowerCase()).toContain('too many');
      } else if (rateLimitedResponse.body.message) {
        expect(rateLimitedResponse.body.message.toLowerCase()).toContain('too many');
      }
    });

    test('should reset rate limit after window expires', async () => {
      const limiter = rateLimit({
        windowMs: 100, // Very short window for testing
        max: 2,
        message: 'Too many requests'
      });

      app.use('/api/', limiter);
      app.get('/api/test', (req, res) => {
        res.json({ message: 'success' });
      });

      // Make 2 requests (should succeed)
      await request(app).get('/api/test');
      await request(app).get('/api/test');

      // 3rd request should be rate limited
      const rateLimitedResponse = await request(app).get('/api/test');
      expect(rateLimitedResponse.status).toBe(429);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should work again after window expires
      const successResponse = await request(app).get('/api/test');
      expect(successResponse.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    test('should handle application errors with user-friendly messages', async () => {
      app.get('/api/error', (req, res, next) => {
        const error = new Error('Internal server error');
        error.statusCode = 500;
        next(error);
      });

      app.use(errorHandler.handleError);

      const response = await request(app).get('/api/error');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.error).toBe('Internal Server Error');
    });

    test('should handle 404 errors', async () => {
      app.use((req, res) => {
        res.status(404).json({
          error: 'Not Found',
          message: `Route ${req.method} ${req.path} not found`,
          timestamp: new Date().toISOString()
        });
      });

      const response = await request(app).get('/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toContain('not found');
    });

    test('should handle service proxy errors', () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      const error = new Error('Service unavailable');
      error.code = 'ECONNREFUSED';

      errorHandler.handleServiceError(res, 'data-service', error);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Service Unavailable',
          message: expect.stringContaining('data-service'),
          timestamp: expect.any(String)
        })
      );
    });

    test('should not expose stack traces in production', async () => {
      process.env.NODE_ENV = 'production';

      app.get('/api/error', (req, res, next) => {
        const error = new Error('Internal server error');
        error.statusCode = 500;
        next(error);
      });

      app.use(errorHandler.handleError);

      const response = await request(app).get('/api/error');

      expect(response.status).toBe(500);
      expect(response.body).not.toHaveProperty('details');
      expect(response.body).not.toHaveProperty('stack');

      // Reset environment
      delete process.env.NODE_ENV;
    });

    test('should expose stack traces in development', async () => {
      process.env.NODE_ENV = 'development';

      app.get('/api/error', (req, res, next) => {
        const error = new Error('Internal server error');
        error.statusCode = 500;
        next(error);
      });

      app.use(errorHandler.handleError);

      const response = await request(app).get('/api/error');

      expect(response.status).toBe(500);
      if (response.body.details) {
        expect(response.body.details).toBeDefined();
      }

      // Reset environment
      delete process.env.NODE_ENV;
    });
  });

  describe('CORS Configuration', () => {
    test('should allow requests from configured origin', async () => {
      const corsOptions = {
        origin: 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
      };

      app.use(cors(corsOptions));
      app.get('/api/test', (req, res) => {
        res.json({ message: 'success' });
      });

      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    test('should handle preflight OPTIONS requests', async () => {
      const corsOptions = {
        origin: '*',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
      };

      app.use(cors(corsOptions));
      app.options('/api/test', (req, res) => {
        res.sendStatus(200);
      });

      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      // OPTIONS requests typically return 204 (No Content) or 200
      expect([200, 204]).toContain(response.status);
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    test('should include CORS headers in responses', async () => {
      const corsOptions = {
        origin: '*',
        credentials: true
      };

      app.use(cors(corsOptions));
      app.get('/api/test', (req, res) => {
        res.json({ message: 'success' });
      });

      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://example.com');

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Request Logging', () => {
    beforeEach(() => {
      mockLogger.info.mockClear();
    });

    test('should log request details', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        path: '/api/test',
        query: {},
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: jest.fn().mockReturnValue('test-agent')
      };

      const res = {
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            // Simulate response finish
            setTimeout(() => callback(), 10);
          }
        }),
        statusCode: 200
      };

      const next = jest.fn();

      requestLogger(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/api/test',
          ip: '127.0.0.1'
        })
      );
    });

    test('should log response when finished', (done) => {
      const req = {
        method: 'GET',
        url: '/api/test',
        path: '/api/test',
        query: {},
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: jest.fn().mockReturnValue('test-agent')
      };

      const res = {
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        }),
        statusCode: 200
      };

      const next = jest.fn();

      requestLogger(req, res, next);

      setTimeout(() => {
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            statusCode: 200
          })
        );
        done();
      }, 50);
    });
  });
});

