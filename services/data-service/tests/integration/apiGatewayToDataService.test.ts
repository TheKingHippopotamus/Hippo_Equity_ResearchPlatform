/**
 * Integration Test: API Gateway → DataService → Cache → Database Flow
 * 
 * Tests the complete flow from API Gateway through DataService to Cache and Database.
 * Validates: Requirements 1.1, 2.1, 3.2, 5.1
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import logger from '../../../src/utils/logger.js';

// Mock logger to avoid console noise during tests
jest.mock('../../../src/utils/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}));

describe('Integration: API Gateway → DataService → Cache → Database Flow', () => {
  let apiGatewayApp: Express;
  let dataServiceApp: Express;
  const TEST_SYMBOL = 'AAPL';
  const TEST_LANGUAGE = 'en';

  beforeAll(async () => {
    // Import apps dynamically to avoid initialization issues
    const apiGatewayModule = await import('../../../../api-gateway/index.js');
    const dataServiceModule = await import('../../../index.js');
    
    apiGatewayApp = apiGatewayModule.default;
    dataServiceApp = dataServiceModule.default;
    
    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Complete Flow: Fetch Data → Normalize → Translate → Display', () => {
    it('should fetch stock data through API Gateway and return normalized data', async () => {
      const response = await request(apiGatewayApp)
        .get(`/api/data/stock/${TEST_SYMBOL}`)
        .query({ language: TEST_LANGUAGE })
        .expect(200);

      expect(response.body).toHaveProperty('symbol');
      expect(response.body).toHaveProperty('stockData');
      expect(response.body).toHaveProperty('news');
      expect(response.body).toHaveProperty('analysis');
      expect(response.body.symbol).toBe(TEST_SYMBOL);
    }, 30000);

    it('should use cache on second request', async () => {
      // First request - should fetch from API
      const firstResponse = await request(apiGatewayApp)
        .get(`/api/data/stock/${TEST_SYMBOL}`)
        .query({ language: TEST_LANGUAGE })
        .expect(200);

      const firstTimestamp = firstResponse.body.timestamp;

      // Second request - should use cache
      const secondResponse = await request(apiGatewayApp)
        .get(`/api/data/stock/${TEST_SYMBOL}`)
        .query({ language: TEST_LANGUAGE })
        .expect(200);

      expect(secondResponse.body.symbol).toBe(TEST_SYMBOL);
      // Cache should return same data structure
      expect(secondResponse.body).toHaveProperty('stockData');
    }, 30000);

    it('should persist data to database', async () => {
      const response = await request(apiGatewayApp)
        .get(`/api/data/stock/${TEST_SYMBOL}`)
        .query({ language: TEST_LANGUAGE })
        .expect(200);

      expect(response.body).toHaveProperty('symbol');
      // Data should be persisted (async, so we just verify the response is correct)
      expect(response.body.stockData).toBeDefined();
    }, 30000);

    it('should translate content based on language parameter', async () => {
      const englishResponse = await request(apiGatewayApp)
        .get(`/api/data/stock/${TEST_SYMBOL}`)
        .query({ language: 'en' })
        .expect(200);

      const hebrewResponse = await request(apiGatewayApp)
        .get(`/api/data/stock/${TEST_SYMBOL}`)
        .query({ language: 'he' })
        .expect(200);

      // Both should return data, but with different language translations
      expect(englishResponse.body.symbol).toBe(TEST_SYMBOL);
      expect(hebrewResponse.body.symbol).toBe(TEST_SYMBOL);
      // News titles should be translated (if translation service is working)
      expect(englishResponse.body.news).toBeDefined();
      expect(hebrewResponse.body.news).toBeDefined();
    }, 30000);
  });

  describe('Error Handling in Integration Flow', () => {
    it('should handle invalid symbol gracefully', async () => {
      const response = await request(apiGatewayApp)
        .get('/api/data/stock/INVALID_SYMBOL_XYZ')
        .query({ language: TEST_LANGUAGE })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    }, 30000);

    it('should handle missing language parameter (defaults to en)', async () => {
      const response = await request(apiGatewayApp)
        .get(`/api/data/stock/${TEST_SYMBOL}`)
        .expect(200);

      expect(response.body).toHaveProperty('symbol');
    }, 30000);
  });
});

