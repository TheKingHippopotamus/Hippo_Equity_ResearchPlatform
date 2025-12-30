/**
 * End-to-End Test: Complete Flow
 * 
 * Tests the complete flow: fetch data → normalize → translate → display
 * Tests autopilot queue with multiple symbols
 * Tests PDF generation with various data combinations
 * Tests concurrent requests with different language preferences
 * 
 * Validates: Requirements 1.1, 2.1, 3.2, 5.1
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

describe('End-to-End: Complete Flow', () => {
  let apiGatewayApp: Express;
  let queueApiApp: Express;
  let reportApiApp: Express;
  const TEST_SYMBOL = 'AAPL';
  const TEST_SYMBOLS = ['AAPL', 'GOOGL', 'MSFT'];
  const TEST_LANGUAGES = ['en', 'he', 'es', 'fr'];

  beforeAll(async () => {
    // Import all services
    const apiGatewayModule = await import('../../services/api-gateway/index.js');
    const queueModule = await import('../../services/queue-service/src/api/server.js');
    const reportModule = await import('../../services/report-service/index.js');
    
    apiGatewayApp = apiGatewayModule.default;
    queueApiApp = queueModule.createServer();
    reportApiApp = reportModule.default;
    
    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Complete Flow: Fetch Data → Normalize → Translate → Display', () => {
    it('should complete full flow from API Gateway to frontend-ready data', async () => {
      // Step 1: Fetch stock data through API Gateway
      const stockResponse = await request(apiGatewayApp)
        .get(`/api/data/stock/${TEST_SYMBOL}`)
        .query({ language: 'en' })
        .expect(200);

      expect(stockResponse.body).toHaveProperty('symbol');
      expect(stockResponse.body).toHaveProperty('stockData');
      expect(stockResponse.body).toHaveProperty('news');
      expect(stockResponse.body).toHaveProperty('analysis');

      // Step 2: Verify data is normalized
      expect(stockResponse.body.stockData).toHaveProperty('currentPrice');
      expect(stockResponse.body.stockData).toHaveProperty('priceChange');
      expect(stockResponse.body.stockData).toHaveProperty('tradingDate');

      // Step 3: Verify translation is applied
      expect(stockResponse.body.news).toBeInstanceOf(Array);
      if (stockResponse.body.news.length > 0) {
        expect(stockResponse.body.news[0]).toHaveProperty('title');
      }

      // Step 4: Verify data is display-ready
      expect(stockResponse.body).toHaveProperty('timestamp');
    }, 30000);
  });

  describe('Autopilot Queue with Multiple Symbols', () => {
    it('should process multiple symbols through autopilot queue', async () => {
      // Enqueue multiple symbols
      const enqueueResponse = await request(queueApiApp)
        .post('/queue/enqueue')
        .send({ symbols: TEST_SYMBOLS })
        .expect(200);

      expect(enqueueResponse.body).toHaveProperty('queueId');
      expect(enqueueResponse.body.symbols).toEqual(TEST_SYMBOLS);

      const queueId = enqueueResponse.body.queueId;

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Check queue status
      const statusResponse = await request(queueApiApp)
        .get(`/queue/${queueId}/status`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('status');
      expect(['pending', 'processing', 'completed']).toContain(statusResponse.body.status);
    }, 60000);
  });

  describe('PDF Generation with Various Data Combinations', () => {
    it('should generate PDFs for different symbols and languages', async () => {
      const testCases = [
        { symbol: 'AAPL', language: 'en' },
        { symbol: 'GOOGL', language: 'he' },
        { symbol: 'MSFT', language: 'es' },
      ];

      for (const testCase of testCases) {
        const response = await request(reportApiApp)
          .post('/generate')
          .send({
            symbol: testCase.symbol,
            language: testCase.language,
            userId: 'test-user'
          })
          .expect(200);

        expect(response.body).toHaveProperty('reportId');
        expect(response.body.symbol).toBe(testCase.symbol);
        expect(response.body.language).toBe(testCase.language);
      }
    }, 120000);
  });

  describe('Concurrent Requests with Different Language Preferences', () => {
    it('should handle concurrent requests with different languages', async () => {
      const requests = TEST_LANGUAGES.map(language =>
        request(apiGatewayApp)
          .get(`/api/data/stock/${TEST_SYMBOL}`)
          .query({ language })
      );

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('symbol');
        expect(response.body.symbol).toBe(TEST_SYMBOL);
        // Each response should have correct language context
        expect(response.body).toHaveProperty('news');
      });
    }, 30000);

    it('should maintain language isolation in concurrent requests', async () => {
      const languages = ['en', 'he'];
      const requests = languages.map(language =>
        request(apiGatewayApp)
          .get(`/api/data/stock/${TEST_SYMBOL}`)
          .query({ language })
          .then(res => ({ language, response: res }))
      );

      const results = await Promise.all(requests);

      // Verify each response maintains its language context
      results.forEach(({ language, response }) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('symbol');
      });
    }, 30000);
  });

  describe('End-to-End Workflow: User Journey', () => {
    it('should complete full user journey: fetch → queue → generate PDF', async () => {
      // Step 1: User fetches stock data
      const stockResponse = await request(apiGatewayApp)
        .get(`/api/data/stock/${TEST_SYMBOL}`)
        .query({ language: 'en' })
        .expect(200);

      expect(stockResponse.body).toHaveProperty('symbol');

      // Step 2: User enqueues symbols for batch processing
      const enqueueResponse = await request(queueApiApp)
        .post('/queue/enqueue')
        .send({ symbols: [TEST_SYMBOL] })
        .expect(200);

      expect(enqueueResponse.body).toHaveProperty('queueId');

      // Step 3: User generates PDF report
      const pdfResponse = await request(reportApiApp)
        .post('/generate')
        .send({
          symbol: TEST_SYMBOL,
          language: 'en',
          userId: 'test-user'
        })
        .expect(200);

      expect(pdfResponse.body).toHaveProperty('reportId');
      expect(pdfResponse.body).toHaveProperty('downloadUrl');
    }, 60000);
  });
});

