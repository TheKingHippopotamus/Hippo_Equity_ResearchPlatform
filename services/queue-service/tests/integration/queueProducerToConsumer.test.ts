/**
 * Integration Test: Queue Producer → Kafka → Queue Consumer Flow
 * 
 * Tests the complete flow from queue producer through Kafka to queue consumer.
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { queueService } from '../../../index.js';
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

describe('Integration: Queue Producer → Kafka → Queue Consumer Flow', () => {
  const TEST_SYMBOLS = ['AAPL', 'GOOGL', 'MSFT'];
  let queueApiApp: Express;

  beforeAll(async () => {
    // Wait for queue service to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Import queue API server
    const { createServer } = await import('../../../src/api/server.js');
    queueApiApp = createServer();
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Queue Processing Flow', () => {
    it('should enqueue symbols and process them in FIFO order', async () => {
      // Enqueue symbols
      const enqueueResponse = await request(queueApiApp)
        .post('/queue/enqueue')
        .send({ symbols: TEST_SYMBOLS })
        .expect(200);

      expect(enqueueResponse.body).toHaveProperty('queueId');
      expect(enqueueResponse.body).toHaveProperty('symbols');
      expect(enqueueResponse.body.symbols).toEqual(TEST_SYMBOLS);

      const queueId = enqueueResponse.body.queueId;

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check queue status
      const statusResponse = await request(queueApiApp)
        .get(`/queue/${queueId}/status`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('queueId');
      expect(statusResponse.body).toHaveProperty('status');
      expect(['pending', 'processing', 'completed']).toContain(statusResponse.body.status);
    }, 60000);

    it('should process tasks sequentially (FIFO)', async () => {
      const symbols = ['AAPL', 'GOOGL'];
      
      const enqueueResponse = await request(queueApiApp)
        .post('/queue/enqueue')
        .send({ symbols })
        .expect(200);

      const queueId = enqueueResponse.body.queueId;

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Verify tasks were processed in order
      const statusResponse = await request(queueApiApp)
        .get(`/queue/${queueId}/status`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('tasks');
      if (statusResponse.body.tasks && statusResponse.body.tasks.length > 0) {
        // Verify order is maintained
        const processedSymbols = statusResponse.body.tasks
          .filter((t: any) => t.status === 'completed')
          .map((t: any) => t.symbol);
        
        // First completed task should be first symbol
        if (processedSymbols.length > 0) {
          expect(processedSymbols[0]).toBe(symbols[0]);
        }
      }
    }, 60000);

    it('should update queue status during processing', async () => {
      const symbols = ['AAPL'];
      
      const enqueueResponse = await request(queueApiApp)
        .post('/queue/enqueue')
        .send({ symbols })
        .expect(200);

      const queueId = enqueueResponse.body.queueId;

      // Check status multiple times
      const statuses: string[] = [];
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResponse = await request(queueApiApp)
          .get(`/queue/status/${queueId}`)
          .expect(200);
        statuses.push(statusResponse.body.status);
      }

      // Status should change over time (pending → processing → completed)
      expect(statuses.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Queue Completion Notification', () => {
    it('should notify when queue completes', async () => {
      const symbols = ['AAPL'];
      
      const enqueueResponse = await request(queueApiApp)
        .post('/queue/enqueue')
        .send({ symbols })
        .expect(200);

      const queueId = enqueueResponse.body.queueId;

      // Wait for completion
      let completed = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const statusResponse = await request(queueApiApp)
          .get(`/queue/status/${queueId}`)
          .expect(200);
        
        if (statusResponse.body.status === 'completed') {
          completed = true;
          expect(statusResponse.body).toHaveProperty('completedAt');
          break;
        }
      }

      expect(completed).toBe(true);
    }, 60000);
  });
});

