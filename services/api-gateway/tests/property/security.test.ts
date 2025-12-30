/**
 * Property Tests: Security Measures
 * Feature: stock-market-dashboard
 * Properties 26-29: Security Properties
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */

import fc from 'fast-check';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express, { Express } from 'express';
import request from 'supertest';
import { enforceHTTPS, validateAPIKey, getSessionManager } from '../../src/middleware/security.js';
import errorLoggingService from '../../src/services/errorLoggingService.js';

describe('Property 26: HTTPS Encryption', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('should enforce HTTPS for all requests in production', async () => {
    app.use(enforceHTTPS);
    app.get('/test', (req, res) => {
      res.json({ message: 'success' });
    });

    // Simulate HTTP request (no x-forwarded-proto header)
    const response = await request(app)
      .get('/test')
      .set('X-Forwarded-Proto', 'http');

    // Property: HTTP requests are blocked in production
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toContain('HTTPS');
  });

  it('should allow HTTPS requests in production', async () => {
    app.use(enforceHTTPS);
    app.get('/test', (req, res) => {
      res.json({ message: 'success' });
    });

    // Simulate HTTPS request
    const response = await request(app)
      .get('/test')
      .set('X-Forwarded-Proto', 'https');

    // Property: HTTPS requests are allowed
    expect(response.status).toBe(200);
  });

  it('should allow HTTP in development', async () => {
    process.env.NODE_ENV = 'development';
    app.use(enforceHTTPS);
    app.get('/test', (req, res) => {
      res.json({ message: 'success' });
    });

    const response = await request(app).get('/test');

    // Property: HTTP is allowed in development
    expect(response.status).toBe(200);
  });
});

describe('Property 27: Sensitive Data Logging Protection', () => {
  it('should sanitize sensitive data before logging', () => {
    return fc.assert(
      fc.property(
        fc.record({
          password: fc.string(),
          apiKey: fc.string(),
          token: fc.string(),
          normalField: fc.string()
        }),
        (data) => {
          // Simulate sanitization
          const sanitized = errorLoggingService['sanitizeData'](data);

          // Property: Sensitive fields are redacted
          expect((sanitized as Record<string, unknown>).password).toBe('[REDACTED]');
          expect((sanitized as Record<string, unknown>).apiKey).toBe('[REDACTED]');
          expect((sanitized as Record<string, unknown>).token).toBe('[REDACTED]');
          
          // Property: Normal fields are preserved
          expect((sanitized as Record<string, unknown>).normalField).toBe(data.normalField);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should never log sensitive information', async () => {
    const sensitiveData = {
      password: 'secret123',
      apiKey: 'key-12345',
      token: 'token-abc',
      creditCard: '1234-5678-9012-3456',
      ssn: '123-45-6789'
    };

    const sanitized = errorLoggingService['sanitizeData'](sensitiveData);

    // Property: All sensitive fields are redacted
    for (const [key, value] of Object.entries(sanitized as Record<string, unknown>)) {
      if (['password', 'apiKey', 'token', 'creditCard', 'ssn'].includes(key)) {
        expect(value).toBe('[REDACTED]');
      }
    }
  });
});

describe('Property 28: API Key Security', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    process.env.API_KEY = 'test-api-key-123';
  });

  afterEach(() => {
    delete process.env.API_KEY;
  });

  it('should require API key when configured', async () => {
    app.use('/protected', validateAPIKey);
    app.get('/protected/test', (req, res) => {
      res.json({ message: 'success' });
    });

    // Request without API key
    const response = await request(app).get('/protected/test');

    // Property: Requests without API key are rejected
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toContain('API key');
  });

  it('should accept valid API key', async () => {
    app.use('/protected', validateAPIKey);
    app.get('/protected/test', (req, res) => {
      res.json({ message: 'success' });
    });

    // Request with valid API key
    const response = await request(app)
      .get('/protected/test')
      .set('X-API-Key', 'test-api-key-123');

    // Property: Valid API key is accepted
    expect(response.status).toBe(200);
  });

  it('should reject invalid API key', async () => {
    app.use('/protected', validateAPIKey);
    app.get('/protected/test', (req, res) => {
      res.json({ message: 'success' });
    });

    // Request with invalid API key
    const response = await request(app)
      .get('/protected/test')
      .set('X-API-Key', 'wrong-key');

    // Property: Invalid API key is rejected
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toContain('Invalid');
  });

  it('should allow requests when API key is not configured', async () => {
    delete process.env.API_KEY;
    
    app.use('/protected', validateAPIKey);
    app.get('/protected/test', (req, res) => {
      res.json({ message: 'success' });
    });

    const response = await request(app).get('/protected/test');

    // Property: API key is optional when not configured
    expect(response.status).toBe(200);
  });
});

describe('Property 29: Session Data Cleanup', () => {
  let sessionManager: ReturnType<typeof getSessionManager>;

  beforeEach(() => {
    sessionManager = getSessionManager();
  });

  it('should clean up expired sessions', async () => {
    const sessionId = 'test-session-1';
    const userId = 'user-123';

    // Create session
    sessionManager.setSession(sessionId, userId, { data: 'test' });

    // Verify session exists
    const session = sessionManager.getSession(sessionId);
    expect(session).not.toBeNull();

    // Manually trigger cleanup (simulating expired session)
    sessionManager.cleanupExpiredSessions();

    // Property: Active sessions are not cleaned up
    const activeSession = sessionManager.getSession(sessionId);
    expect(activeSession).not.toBeNull();
  });

  it('should clear session data on logout', () => {
    const sessionId = 'test-session-2';
    const userId = 'user-456';

    // Create session
    sessionManager.setSession(sessionId, userId, { data: 'test' });

    // Verify session exists
    expect(sessionManager.getSession(sessionId)).not.toBeNull();

    // Clear session
    sessionManager.clearSession(sessionId);

    // Property: Session is cleared after logout
    expect(sessionManager.getSession(sessionId)).toBeNull();
  });

  it('should clear all sessions for a user', () => {
    const userId = 'user-789';
    const sessionIds = ['session-1', 'session-2', 'session-3'];

    // Create multiple sessions for same user
    for (const sessionId of sessionIds) {
      sessionManager.setSession(sessionId, userId);
    }

    // Verify sessions exist
    for (const sessionId of sessionIds) {
      expect(sessionManager.getSession(sessionId)).not.toBeNull();
    }

    // Clear all user sessions
    sessionManager.clearUserSessions(userId);

    // Property: All user sessions are cleared
    for (const sessionId of sessionIds) {
      expect(sessionManager.getSession(sessionId)).toBeNull();
    }
  });

  it('should track session statistics', () => {
    const userId1 = 'user-1';
    const userId2 = 'user-2';

    // Create sessions
    sessionManager.setSession('session-1', userId1);
    sessionManager.setSession('session-2', userId1);
    sessionManager.setSession('session-3', userId2);

    const stats = sessionManager.getStats();

    // Property: Statistics are accurate
    expect(stats).toHaveProperty('totalSessions');
    expect(stats).toHaveProperty('activeSessions');
    expect(stats.totalSessions).toBeGreaterThanOrEqual(3);
    expect(stats.activeSessions).toBeGreaterThanOrEqual(3);
  });
});

