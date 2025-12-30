/**
 * Property Test: Queue FIFO Ordering
 * Feature: stock-market-dashboard, Property 5: Queue FIFO Ordering
 * Validates: Requirements 2.1, 2.2, 2.3
 * 
 * For any list of stock symbols submitted to the autopilot queue, the processing order
 * should match the submission order exactly, with each symbol processed in sequence.
 */

import fc from 'fast-check';
import { Producer } from 'kafkajs';
import queueService from '../../src/services/queueService.js';
import kafkaClient from '../../src/config/kafka.js';
import redisClient from '../../src/config/redis.js';

// Mock logger first (before other mocks that use it)
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

// Mock Kafka client
jest.mock('../../src/config/kafka.js', () => {
  const mockProducer = {
    send: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn()
  };

  const mockConsumer = {
    connect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    run: jest.fn(),
    disconnect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn()
  };

  // Create a mock Kafka instance
  const mockKafka = {
    producer: jest.fn().mockReturnValue(mockProducer),
    consumer: jest.fn().mockReturnValue(mockConsumer),
    admin: jest.fn()
  };

  return {
    default: {
      initialize: jest.fn().mockReturnValue(mockKafka),
      createProducer: jest.fn().mockResolvedValue(mockProducer),
      createConsumer: jest.fn().mockResolvedValue(mockConsumer),
      createTopics: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined)
    }
  };
});

// Mock Redis client
jest.mock('../../src/config/redis.js', () => {
  const mockClient = {
    get: jest.fn(),
    setEx: jest.fn(),
    publish: jest.fn(),
    connect: jest.fn(),
    quit: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG')
  };

  return {
    default: {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(mockClient),
      healthCheck: jest.fn().mockResolvedValue({ status: 'healthy', message: 'OK' })
    }
  };
});

describe('Property 5: Queue FIFO Ordering', () => {
  let mockProducer: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Initialize queue service (this will create the producer)
    await queueService.initialize();
    
    // Get mock producer from kafkaClient
    mockProducer = await kafkaClient.createProducer();
  });

  afterEach(async () => {
    await queueService.disconnect();
  });

  test('should enqueue symbols in the exact order they are submitted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 20 }),
        async (symbols: string[]) => {
          // Clear previous calls
          (mockProducer.send as jest.Mock).mockClear();

          // Enqueue symbols
          const queueId = await queueService.enqueueSymbols(symbols);

          // Verify producer.send was called for each symbol
          expect(mockProducer.send).toHaveBeenCalledTimes(symbols.length);

          // Verify messages were sent in order
          const calls = (mockProducer.send as jest.Mock).mock.calls;
          const sentSymbols: string[] = [];

          for (let i = 0; i < calls.length; i++) {
            const call = calls[i];
            const message = call[0].messages[0];
            const parsed = JSON.parse(message.value);
            sentSymbols.push(parsed.task.symbol);
          }

          // Verify order matches exactly
          expect(sentSymbols).toEqual(symbols.map(s => s.toUpperCase()));
          expect(queueId).toBeDefined();
          expect(typeof queueId).toBe('string');
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should use the same queueId for all tasks in a batch', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 2, maxLength: 10 }),
        async (symbols: string[]) => {
          (mockProducer.send as jest.Mock).mockClear();

          const queueId = await queueService.enqueueSymbols(symbols);

          // Verify all messages use the same queueId
          const calls = (mockProducer.send as jest.Mock).mock.calls;
          const queueIds: string[] = [];

          for (const call of calls) {
            const message = call[0].messages[0];
            const parsed = JSON.parse(message.value);
            queueIds.push(parsed.queueId);
          }

          // All tasks should have the same queueId
          expect(new Set(queueIds).size).toBe(1);
          expect(queueIds[0]).toBe(queueId);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should generate unique queue IDs for different batches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
        async (symbols1: string[], symbols2: string[]) => {
          const queueId1 = await queueService.enqueueSymbols(symbols1);
          const queueId2 = await queueService.enqueueSymbols(symbols2);

          // Queue IDs should be different
          expect(queueId1).not.toBe(queueId2);
          expect(queueId1).toBeDefined();
          expect(queueId2).toBeDefined();
        }
      ),
      { numRuns: 30 }
    );
  });
});

