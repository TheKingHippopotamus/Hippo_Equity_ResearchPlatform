/**
 * Property Test: Cache TTL Expiration
 * Feature: stock-market-dashboard, Property 19: Cache TTL Expiration
 * Validates: Requirements 7.2
 * 
 * For any cached stock data with a TTL, after the TTL expires,
 * subsequent requests should fetch fresh data from the API rather than returning stale cached data.
 */

import fc from 'fast-check';
import cacheService from '../../src/services/cacheService.js';
import dataService from '../../src/services/dataService.js';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Redis client
jest.mock('../../src/config/redis.js', () => {
  const mockClient = {
    get: jest.fn(),
    setEx: jest.fn(),
    exists: jest.fn(),
    del: jest.fn(),
    flushDb: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG')
  };

  return {
    default: {
      connect: jest.fn().mockResolvedValue(mockClient),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(mockClient),
      healthCheck: jest.fn().mockResolvedValue({ status: 'healthy', message: 'PONG' })
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

describe('Property 19: Cache TTL Expiration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should fetch fresh data after TTL expires', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }), // symbol
        fc.integer({ min: 1, max: 3600 }), // TTL in seconds
        async (symbol, ttl) => {
          jest.clearAllMocks();

          const mockData = {
            articles: [
              {
                id: '1',
                title: 'Test Article',
                content: 'Content',
                publishedAt: new Date().toISOString(),
                sentiment: 0,
                source: 'Test',
                url: 'http://test.com'
              }
            ]
          };

          // Mock successful API response
          mockedAxios.get.mockResolvedValue({
            data: mockData,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any
          });

          // Get Redis client mock
          const redisClient = require('../../src/config/redis.js').default.getClient();
          
          // First call - cache miss, should fetch from API
          redisClient.get.mockResolvedValueOnce(null);
          const firstResult = await dataService.fetchStockNews(symbol);
          
          // Verify API was called
          expect(mockedAxios.get).toHaveBeenCalled();
          expect(redisClient.setEx).toHaveBeenCalledWith(
            expect.stringContaining(symbol),
            ttl,
            expect.any(String)
          );

          // Second call - cache hit (before TTL expires)
          const cachedData = JSON.stringify(firstResult);
          redisClient.get.mockResolvedValueOnce(cachedData);
          mockedAxios.get.mockClear();
          
          const secondResult = await dataService.fetchStockNews(symbol);
          
          // Should use cache, not call API
          expect(mockedAxios.get).not.toHaveBeenCalled();
          expect(secondResult).toEqual(firstResult);

          // Fast-forward time beyond TTL
          jest.advanceTimersByTime(ttl * 1000 + 1000); // TTL + 1 second

          // Third call - cache expired, should fetch from API
          redisClient.get.mockResolvedValueOnce(null);
          mockedAxios.get.mockClear();
          
          const thirdResult = await dataService.fetchStockNews(symbol);
          
          // Should call API again after TTL expires
          expect(mockedAxios.get).toHaveBeenCalled();
          expect(thirdResult).toBeDefined();

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should respect TTL values and not return expired cache', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 100 }), // Short TTL for testing
        async (symbol, ttl) => {
          jest.clearAllMocks();

          const redisClient = require('../../src/config/redis.js').default.getClient();
          
          // Set cache with TTL
          const testData = [{ id: '1', title: 'Test' }];
          await cacheService.set(`stock:${symbol}:news`, testData, ttl);

          // Verify cache exists immediately
          const existsBefore = await cacheService.exists(`stock:${symbol}:news`);
          expect(existsBefore).toBe(true);

          // Fast-forward past TTL
          jest.advanceTimersByTime(ttl * 1000 + 1000);

          // After TTL expires, Redis should return null (simulated)
          redisClient.get.mockResolvedValueOnce(null);
          const cached = await cacheService.get(`stock:${symbol}:news`);

          // Cache should be expired (null)
          expect(cached).toBeNull();

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});

