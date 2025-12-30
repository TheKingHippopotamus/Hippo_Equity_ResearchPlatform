/**
 * Property Test: Queue Status Accuracy
 * Feature: stock-market-dashboard, Property 6: Queue Status Accuracy
 * Validates: Requirements 2.4
 * 
 * For any autopilot queue in progress, the reported queue position, completion percentage,
 * and current task should accurately reflect the actual processing state.
 */

import fc from 'fast-check';
import { QueueStatus } from '../../src/types/models.js';
import queueService from '../../src/services/queueService.js';
import redisClient from '../../src/config/redis.js';

// Mock Redis client
const mockRedisClient = {
  get: jest.fn(),
  setEx: jest.fn(),
  publish: jest.fn(),
  connect: jest.fn(),
  quit: jest.fn(),
  ping: jest.fn().mockResolvedValue('PONG')
};

jest.mock('../../src/config/redis.js', () => {
  return {
    default: {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn(() => mockRedisClient),
      healthCheck: jest.fn().mockResolvedValue({ status: 'healthy', message: 'OK' })
    }
  };
});

// Mock Kafka client
jest.mock('../../src/config/kafka.js', () => {
  const mockProducer = {
    send: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn()
  };

  const mockConsumer = {
    connect: jest.fn(),
    subscribe: jest.fn(),
    run: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn()
  };

  return {
    default: {
      initialize: jest.fn(),
      createProducer: jest.fn().mockResolvedValue(mockProducer),
      createConsumer: jest.fn().mockResolvedValue(mockConsumer),
      createTopics: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined)
    }
  };
});

// Mock logger
jest.mock('../../src/utils/logger.js', () => {
  return {
    default: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }
  };
});

// Import after mocks are set up
import queueService from '../../src/services/queueService.js';
import redisClient from '../../src/config/redis.js';

describe('Property 6: Queue Status Accuracy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.setEx.mockResolvedValue('OK');
  });

  afterEach(async () => {
    await queueService.disconnect();
  });

  test('should accurately calculate progress percentage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // totalTasks
        fc.integer({ min: 0, max: 100 }), // completedTasks
        async (totalTasks: number, completedTasks: number) => {
          // Ensure completedTasks doesn't exceed totalTasks
          const actualCompleted = Math.min(completedTasks, totalTasks);
          
          const queueStatus: QueueStatus = {
            queueId: 'test-queue-id',
            totalTasks,
            completedTasks: actualCompleted,
            failedTasks: 0,
            currentPosition: actualCompleted + 1,
            progress: Math.round((actualCompleted / totalTasks) * 100),
            status: actualCompleted === totalTasks ? 'completed' : 'processing',
            createdAt: new Date().toISOString()
          };

          // Store status in mock Redis
          mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(queueStatus));

          const retrievedStatus = await queueService.getQueueStatus('test-queue-id');

          expect(retrievedStatus).not.toBeNull();
          expect(retrievedStatus?.totalTasks).toBe(totalTasks);
          expect(retrievedStatus?.completedTasks).toBe(actualCompleted);
          
          // Verify progress calculation
          const expectedProgress = Math.round((actualCompleted / totalTasks) * 100);
          expect(retrievedStatus?.progress).toBe(expectedProgress);
          expect(retrievedStatus?.progress).toBeGreaterThanOrEqual(0);
          expect(retrievedStatus?.progress).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should accurately track current position', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }), // totalTasks
        fc.integer({ min: 0, max: 50 }), // completedTasks
        async (totalTasks: number, completedTasks: number) => {
          const actualCompleted = Math.min(completedTasks, totalTasks);
          
          const queueStatus: QueueStatus = {
            queueId: 'test-queue-id',
            totalTasks,
            completedTasks: actualCompleted,
            failedTasks: 0,
            currentPosition: actualCompleted + 1,
            progress: Math.round((actualCompleted / totalTasks) * 100),
            status: actualCompleted === totalTasks ? 'completed' : 'processing',
            createdAt: new Date().toISOString()
          };

          mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(queueStatus));

          const retrievedStatus = await queueService.getQueueStatus('test-queue-id');

          expect(retrievedStatus).not.toBeNull();
          
          // Current position should be completedTasks + 1 (next task to process)
          // Or totalTasks if all are completed
          const expectedPosition = actualCompleted < totalTasks 
            ? actualCompleted + 1 
            : totalTasks;
          
          expect(retrievedStatus?.currentPosition).toBe(expectedPosition);
          expect(retrievedStatus?.currentPosition).toBeGreaterThanOrEqual(1);
          expect(retrievedStatus?.currentPosition).toBeLessThanOrEqual(totalTasks);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should maintain status consistency (completedTasks + failedTasks <= totalTasks)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }), // totalTasks
        fc.integer({ min: 0, max: 50 }), // completedTasks
        fc.integer({ min: 0, max: 50 }), // failedTasks
        async (totalTasks: number, completedTasks: number, failedTasks: number) => {
          // Ensure sum doesn't exceed totalTasks
          const actualCompleted = Math.min(completedTasks, totalTasks);
          const actualFailed = Math.min(failedTasks, totalTasks - actualCompleted);
          
          const queueStatus: QueueStatus = {
            queueId: 'test-queue-id',
            totalTasks,
            completedTasks: actualCompleted,
            failedTasks: actualFailed,
            currentPosition: actualCompleted + actualFailed + 1,
            progress: Math.round(((actualCompleted + actualFailed) / totalTasks) * 100),
            status: (actualCompleted + actualFailed) === totalTasks ? 'completed' : 'processing',
            createdAt: new Date().toISOString()
          };

          mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(queueStatus));

          const retrievedStatus = await queueService.getQueueStatus('test-queue-id');

          expect(retrievedStatus).not.toBeNull();
          
          // Verify consistency
          const totalProcessed = (retrievedStatus?.completedTasks || 0) + (retrievedStatus?.failedTasks || 0);
          expect(totalProcessed).toBeLessThanOrEqual(retrievedStatus?.totalTasks || 0);
          expect(retrievedStatus?.completedTasks).toBeGreaterThanOrEqual(0);
          expect(retrievedStatus?.failedTasks).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

