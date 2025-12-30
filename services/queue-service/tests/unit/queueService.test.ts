/**
 * Unit Tests: QueueService
 * Tests queue processing functionality including enqueue, status tracking, and completion
 * 
 * Requirements: 2.1, 2.4, 2.5
 */

import { Producer, Consumer } from 'kafkajs';
import { QueueTask, QueueStatus, ProcessedStockData } from '../../src/types/models.js';

// Mock all dependencies BEFORE importing
// Jest hoists mocks to the top, but we need to mock before imports for ES modules
jest.mock('axios');

// Mock Kafka client - define mocks inside factory
const mockProducer = {
  send: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn()
} as unknown as Producer;

const mockConsumer = {
  connect: jest.fn(),
  subscribe: jest.fn(),
  run: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn()
} as unknown as Consumer;

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

// Mock Redis client - define mock inside factory
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

// Import services AFTER mocks are defined
// Jest hoists mocks, so they will be applied even though imports are after
import axios from 'axios';
import queueService from '../../src/services/queueService.js';
import kafkaClient from '../../src/config/kafka.js';
import redisClient from '../../src/config/redis.js';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('QueueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockProducer.send as jest.Mock).mockResolvedValue([{ topicName: 'queue-tasks', partition: 0, errorCode: 0 }]);
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.setEx.mockResolvedValue('OK');
    mockRedisClient.publish.mockResolvedValue(1);
  });

  afterEach(async () => {
    await queueService.disconnect();
  });

  describe('enqueueSymbols', () => {
    test('should enqueue symbols and return queue ID', async () => {
      await queueService.initialize();

      const symbols = ['AAPL', 'GOOGL', 'MSFT'];
      const queueId = await queueService.enqueueSymbols(symbols);

      expect(queueId).toBeDefined();
      expect(typeof queueId).toBe('string');
      expect(mockProducer.send).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    test('should create tasks with correct structure', async () => {
      await queueService.initialize();

      const symbols = ['AAPL', 'GOOGL'];
      await queueService.enqueueSymbols(symbols);

      const calls = (mockProducer.send as jest.Mock).mock.calls;
      expect(calls.length).toBe(2);

      // Verify first task structure
      const firstCall = calls[0][0];
      const firstMessage = JSON.parse(firstCall.messages[0].value);
      expect(firstMessage.task).toHaveProperty('id');
      expect(firstMessage.task).toHaveProperty('symbol', 'AAPL');
      expect(firstMessage.task).toHaveProperty('status', 'pending');
      expect(firstMessage.task).toHaveProperty('createdAt');
      expect(firstMessage.queueId).toBeDefined();

      // Verify second task structure
      const secondCall = calls[1][0];
      const secondMessage = JSON.parse(secondCall.messages[0].value);
      expect(secondMessage.task.symbol).toBe('GOOGL');
    });

    test('should store initial queue status in Redis', async () => {
      await queueService.initialize();

      const symbols = ['AAPL', 'GOOGL', 'MSFT'];
      const queueId = await queueService.enqueueSymbols(symbols);

      expect(mockRedisClient.setEx).toHaveBeenCalled();
      const setExCall = (mockRedisClient.setEx as jest.Mock).mock.calls[0];
      const key = setExCall[0];
      const status = JSON.parse(setExCall[1]);

      expect(key).toBe(`queue:${queueId}:status`);
      expect(status.queueId).toBe(queueId);
      expect(status.totalTasks).toBe(3);
      expect(status.completedTasks).toBe(0);
      expect(status.failedTasks).toBe(0);
      expect(status.status).toBe('pending');
    });
  });

  describe('getQueueStatus', () => {
    test('should return queue status from Redis', async () => {
      await queueService.initialize();

      const queueStatus: QueueStatus = {
        queueId: 'test-queue-id',
        totalTasks: 5,
        completedTasks: 2,
        failedTasks: 0,
        currentPosition: 3,
        progress: 40,
        status: 'processing',
        createdAt: new Date().toISOString()
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(queueStatus));

      const retrievedStatus = await queueService.getQueueStatus('test-queue-id');

      expect(retrievedStatus).not.toBeNull();
      expect(retrievedStatus?.queueId).toBe('test-queue-id');
      expect(retrievedStatus?.totalTasks).toBe(5);
      expect(retrievedStatus?.completedTasks).toBe(2);
      expect(retrievedStatus?.progress).toBe(40);
    });

    test('should return null for non-existent queue', async () => {
      await queueService.initialize();

      mockRedisClient.get.mockResolvedValueOnce(null);

      const status = await queueService.getQueueStatus('non-existent-queue');

      expect(status).toBeNull();
    });
  });

  describe('processTask', () => {
    test('should successfully process a task and fetch stock data', async () => {
      await queueService.initialize();

      const task: QueueTask = {
        id: 'task-1',
        symbol: 'AAPL',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const mockStockData: ProcessedStockData = {
        symbol: 'AAPL',
        stockData: {
          symbol: 'AAPL',
          currentPrice: 150.0,
          previousClose: 149.0,
          priceChange: 1.0,
          priceChangePercent: 0.67,
          tradingDate: '2024-01-01',
          timestamp: new Date().toISOString()
        },
        news: [],
        analysis: {
          symbol: 'AAPL',
          companyDescription: 'Test company',
          competitors: { industry: 'Tech', keyPoints: [], rating: 3, summary: '' },
          financialHealth: { keyPoints: [], rating: 3, summary: '' },
          growth: { keyPoints: [], rating: 3, summary: '' },
          profitability: { keyPoints: [], rating: 3, summary: '' },
          shareholder_returns: { keyPoints: [], summary: '' },
          valuation: { keyPoints: [], rating: 3, summary: '' }
        },
        fetchedAt: new Date().toISOString()
      };

      (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: mockStockData
      });

      const result = await queueService.processTask(task, 'queue-1');

      expect(result).toEqual(mockStockData);
      expect(task.status).toBe('completed');
      expect(task.result).toEqual(mockStockData);
      expect(task.completedAt).toBeDefined();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/stock/AAPL'),
        expect.objectContaining({ timeout: 30000 })
      );
    });

    test('should handle task processing failure', async () => {
      await queueService.initialize();

      const task: QueueTask = {
        id: 'task-1',
        symbol: 'INVALID',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      (mockedAxios.get as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      await expect(queueService.processTask(task, 'queue-1')).rejects.toThrow();

      expect(task.status).toBe('failed');
      expect(task.error).toBeDefined();
      expect(task.completedAt).toBeDefined();
    });
  });

  describe('updateQueueStatus', () => {
    test('should update queue status in Redis', async () => {
      await queueService.initialize();

      const queueStatus: QueueStatus = {
        queueId: 'test-queue',
        totalTasks: 3,
        completedTasks: 1,
        failedTasks: 0,
        currentPosition: 2,
        progress: 33,
        status: 'processing',
        createdAt: new Date().toISOString()
      };

      await queueService.updateQueueStatus('test-queue', queueStatus);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'queue:test-queue:status',
        JSON.stringify(queueStatus),
        86400 // 24 hours TTL
      );
    });
  });
});

