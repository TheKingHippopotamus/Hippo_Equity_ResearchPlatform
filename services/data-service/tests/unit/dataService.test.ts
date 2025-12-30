/**
 * Unit Tests for DataService
 * Requirements: 1.4, 7.2
 */

import axios from 'axios';
import dataService from '../../src/services/dataService.js';
import cacheService from '../../src/services/cacheService.js';

// Mock dependencies
jest.mock('axios');
jest.mock('../../src/services/cacheService.js');
jest.mock('../../src/utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedCacheService = cacheService as jest.Mocked<typeof cacheService>;

describe('DataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchStockNews', () => {
    it('should return cached data on cache hit', async () => {
      const symbol = 'AAPL';
      const cachedNews = [
        {
          id: '1',
          title: 'Cached Article',
          content: 'Content',
          contentPreview: 'Preview',
          publishedAt: new Date().toISOString(),
          sentiment: 0,
          source: 'Test',
          url: 'http://test.com'
        }
      ];

      mockedCacheService.get.mockResolvedValue(cachedNews);
      mockedCacheService.generateKey.mockReturnValue(`stock:${symbol}:news`);

      const result = await dataService.fetchStockNews(symbol);

      expect(result).toEqual(cachedNews);
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(mockedCacheService.get).toHaveBeenCalledWith(`stock:${symbol}:news`);
    });

    it('should fetch from API on cache miss and cache the result', async () => {
      const symbol = 'AAPL';
      const apiResponse = {
        articles: [
          {
            id: '1',
            title: 'API Article',
            content: 'Content',
            publishedAt: new Date().toISOString(),
            sentiment: 1,
            source: 'Test',
            url: 'http://test.com'
          }
        ]
      };

      mockedCacheService.get.mockResolvedValue(null);
      mockedCacheService.generateKey.mockReturnValue(`stock:${symbol}:news`);
      mockedAxios.get.mockResolvedValue({
        data: apiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const result = await dataService.fetchStockNews(symbol);

      expect(mockedAxios.get).toHaveBeenCalled();
      expect(mockedCacheService.set).toHaveBeenCalledWith(
        `stock:${symbol}:news`,
        expect.any(Array),
        3600
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should fallback to stale cache on API failure', async () => {
      const symbol = 'AAPL';
      const staleCache = [
        {
          id: '1',
          title: 'Stale Article',
          content: 'Content',
          contentPreview: 'Preview',
          publishedAt: new Date().toISOString(),
          sentiment: 0,
          source: 'Test',
          url: 'http://test.com'
        }
      ];

      mockedCacheService.get
        .mockResolvedValueOnce(null) // First call (cache miss)
        .mockResolvedValueOnce(staleCache); // Second call (stale cache fallback)
      mockedCacheService.generateKey.mockReturnValue(`stock:${symbol}:news`);
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const result = await dataService.fetchStockNews(symbol);

      expect(result).toEqual(staleCache);
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    it('should throw error if API fails and no cache available', async () => {
      const symbol = 'AAPL';

      mockedCacheService.get.mockResolvedValue(null);
      mockedCacheService.generateKey.mockReturnValue(`stock:${symbol}:news`);
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      await expect(dataService.fetchStockNews(symbol)).rejects.toThrow();
    });
  });

  describe('fetchFinancialAnalysis', () => {
    it('should return cached data on cache hit', async () => {
      const symbol = 'AAPL';
      const cachedAnalysis = {
        symbol: 'AAPL',
        companyDescription: 'Test Company',
        competitors: {
          industry: 'Technology',
          keyPoints: [],
          rating: 3,
          summary: 'Test'
        },
        financialHealth: {
          keyPoints: [],
          rating: 3,
          summary: 'Test'
        },
        growth: {
          keyPoints: [],
          rating: 3,
          summary: 'Test'
        },
        profitability: {
          keyPoints: [],
          rating: 3,
          summary: 'Test'
        },
        shareholder_returns: {
          keyPoints: [],
          summary: 'Test'
        },
        valuation: {
          keyPoints: [],
          rating: 3,
          summary: 'Test'
        }
      };

      mockedCacheService.get.mockResolvedValue(cachedAnalysis);
      mockedCacheService.generateKey.mockReturnValue(`stock:${symbol}:analysis`);

      const result = await dataService.fetchFinancialAnalysis(symbol);

      expect(result).toEqual(cachedAnalysis);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should fetch from API on cache miss', async () => {
      const symbol = 'AAPL';
      const apiResponse = {
        symbol: 'AAPL',
        companyDescription: 'Test Company',
        competitors: {
          industry: 'Technology',
          keyPoints: [],
          rating: 3,
          summary: 'Test'
        },
        financialHealth: {
          keyPoints: [],
          rating: 3,
          summary: 'Test'
        },
        growth: {
          keyPoints: [],
          rating: 3,
          summary: 'Test'
        },
        profitability: {
          keyPoints: [],
          rating: 3,
          summary: 'Test'
        },
        shareholder_returns: {
          keyPoints: [],
          summary: 'Test'
        },
        valuation: {
          keyPoints: [],
          rating: 3,
          summary: 'Test'
        }
      };

      mockedCacheService.get.mockResolvedValue(null);
      mockedCacheService.generateKey.mockReturnValue(`stock:${symbol}:analysis`);
      mockedAxios.get.mockResolvedValue({
        data: apiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any
      });

      const result = await dataService.fetchFinancialAnalysis(symbol);

      expect(mockedAxios.get).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.symbol).toBe(symbol);
    });
  });

  describe('fetchStockData', () => {
    it('should return cached combined data on cache hit', async () => {
      const symbol = 'AAPL';
      const cachedData = {
        symbol: 'AAPL',
        stockData: {
          symbol: 'AAPL',
          currentPrice: 150,
          previousClose: 149,
          priceChange: 1,
          priceChangePercent: 0.67,
          tradingDate: '2024-01-01',
          timestamp: new Date().toISOString()
        },
        news: [],
        analysis: {} as any,
        fetchedAt: new Date().toISOString()
      };

      mockedCacheService.get.mockResolvedValue(cachedData);
      mockedCacheService.generateKey.mockReturnValue(`stock:${symbol}:combined`);

      const result = await dataService.fetchStockData(symbol);

      expect(result).toEqual(cachedData);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should fetch both news and analysis in parallel on cache miss', async () => {
      const symbol = 'AAPL';

      mockedCacheService.get.mockResolvedValue(null);
      mockedCacheService.generateKey.mockImplementation((sym, type) => `stock:${sym}:${type}`);
      
      // Mock both API calls
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { articles: [] },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any
        })
        .mockResolvedValueOnce({
          data: {
            symbol: 'AAPL',
            companyDescription: 'Test',
            competitors: { industry: 'Tech', keyPoints: [], rating: 3, summary: '' },
            financialHealth: { keyPoints: [], rating: 3, summary: '' },
            growth: { keyPoints: [], rating: 3, summary: '' },
            profitability: { keyPoints: [], rating: 3, summary: '' },
            shareholder_returns: { keyPoints: [], summary: '' },
            valuation: { keyPoints: [], rating: 3, summary: '' }
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any
        });

      const result = await dataService.fetchStockData(symbol);

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
      expect(result.symbol).toBe(symbol);
    });
  });

  describe('getCachedData and setCachedData', () => {
    it('should get cached data', async () => {
      const symbol = 'AAPL';
      const cachedData = {
        symbol: 'AAPL',
        stockData: {} as any,
        news: [],
        analysis: {} as any,
        fetchedAt: new Date().toISOString()
      };

      mockedCacheService.get.mockResolvedValue(cachedData);
      mockedCacheService.generateKey.mockReturnValue(`stock:${symbol}:combined`);

      const result = await dataService.getCachedData(symbol);

      expect(result).toEqual(cachedData);
    });

    it('should set cached data', async () => {
      const symbol = 'AAPL';
      const data = {
        symbol: 'AAPL',
        stockData: {} as any,
        news: [],
        analysis: {} as any,
        fetchedAt: new Date().toISOString()
      };

      mockedCacheService.generateKey.mockReturnValue(`stock:${symbol}:combined`);
      mockedCacheService.set.mockResolvedValue(undefined);

      await dataService.setCachedData(symbol, data, 3600);

      expect(mockedCacheService.set).toHaveBeenCalledWith(
        `stock:${symbol}:combined`,
        data,
        3600
      );
    });
  });
});

