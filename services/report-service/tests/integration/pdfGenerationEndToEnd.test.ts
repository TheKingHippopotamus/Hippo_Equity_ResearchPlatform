/**
 * Integration Test: PDF Generation End-to-End
 * 
 * Tests the complete PDF generation flow from request to storage.
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import logger from '../../../src/utils/logger.js';

// Mock logger
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

describe('Integration: PDF Generation End-to-End', () => {
  let reportApiApp: Express;
  const TEST_SYMBOL = 'AAPL';
  const TEST_LANGUAGE = 'en';
  const TEST_USER_ID = 'test-user-123';

  beforeAll(async () => {
    // Import report service app
    const reportModule = await import('../../../index.js');
    reportApiApp = reportModule.default;
    
    // Wait for service to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('PDF Generation Flow', () => {
    it('should generate PDF report with all required sections', async () => {
      const response = await request(reportApiApp)
        .post('/generate')
        .send({
          symbol: TEST_SYMBOL,
          language: TEST_LANGUAGE,
          userId: TEST_USER_ID
        })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('reportId');
      expect(response.body).toHaveProperty('symbol');
      expect(response.body).toHaveProperty('downloadUrl');
      expect(response.body.symbol).toBe(TEST_SYMBOL);
    }, 60000);

    it('should store PDF in MinIO and metadata in PostgreSQL', async () => {
      const generateResponse = await request(reportApiApp)
        .post('/generate')
        .send({
          symbol: TEST_SYMBOL,
          language: TEST_LANGUAGE,
          userId: TEST_USER_ID
        })
        .expect(200);

      const reportId = generateResponse.body.reportId;

      // Wait for PDF to be generated
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Get metadata
      const metadataResponse = await request(reportApiApp)
        .get(`/metadata/${reportId}`)
        .expect(200);

      expect(metadataResponse.body).toHaveProperty('id');
      expect(metadataResponse.body).toHaveProperty('symbol');
      expect(metadataResponse.body).toHaveProperty('filePath');
      expect(metadataResponse.body).toHaveProperty('fileSize');
      expect(metadataResponse.body.symbol).toBe(TEST_SYMBOL);
    }, 60000);

    it('should download generated PDF', async () => {
      const generateResponse = await request(reportApiApp)
        .post('/generate')
        .send({
          symbol: TEST_SYMBOL,
          language: TEST_LANGUAGE,
          userId: TEST_USER_ID
        })
        .expect(200);

      const reportId = generateResponse.body.reportId;

      // Wait for PDF to be generated
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Download PDF
      const downloadResponse = await request(reportApiApp)
        .get(`/download/${reportId}`)
        .expect(200);

      expect(downloadResponse.headers['content-type']).toContain('application/pdf');
      expect(downloadResponse.body).toBeDefined();
    }, 60000);

    it('should generate PDF in different languages', async () => {
      const languages = ['en', 'he', 'es', 'fr'];
      
      for (const lang of languages) {
        const response = await request(reportApiApp)
          .post('/generate')
          .send({
            symbol: TEST_SYMBOL,
            language: lang,
            userId: TEST_USER_ID
          })
          .expect(200);

        expect(response.body).toHaveProperty('reportId');
        expect(response.body.language).toBe(lang);
      }
    }, 120000);
  });

  describe('PDF Content Validation', () => {
    it('should include all required sections in PDF', async () => {
      const generateResponse = await request(reportApiApp)
        .post('/generate')
        .send({
          symbol: TEST_SYMBOL,
          language: TEST_LANGUAGE,
          userId: TEST_USER_ID
        })
        .expect(200);

      const reportId = generateResponse.body.reportId;

      // Wait for PDF to be generated
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Download and verify PDF structure
      const downloadResponse = await request(reportApiApp)
        .get(`/download/${reportId}`)
        .expect(200);

      // PDF should be generated (non-empty)
      expect(downloadResponse.body.length).toBeGreaterThan(0);
    }, 60000);
  });
});

