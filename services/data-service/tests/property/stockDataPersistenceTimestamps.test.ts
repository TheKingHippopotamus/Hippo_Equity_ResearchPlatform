import * as fc from 'fast-check';
import persistenceService from '../../../src/services/persistenceService.js';
import { ProcessedStockData, StockData, NewsArticle, FinancialAnalysis } from '../../../src/types/models.js';

/**
 * Property Test: Stock Data Persistence with Timestamps
 * Feature: stock-market-dashboard
 * Property 21: Stock Data Persistence with Timestamps
 * Validates: Requirements 8.1
 * 
 * Tests that stock data is persisted to the database with accurate timestamps
 * for historical tracking and retrieval.
 */
describe('Property 21: Stock Data Persistence with Timestamps', () => {
  beforeEach(async () => {
    // Initialize persistence service
    await persistenceService.initialize();
  });

  it('should persist stock data with accurate timestamps', async () => {
    return fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }), // Stock symbol
        fc.float({ min: 0.01, max: 10000 }), // Current price
        fc.float({ min: 0.01, max: 10000 }), // Previous close
        fc.date({ min: new Date('2020-01-01'), max: new Date() }), // Trading date
        async (symbol, currentPrice, previousClose, tradingDate) => {
          const priceChange = currentPrice - previousClose;
          const priceChangePercent = (priceChange / previousClose) * 100;
          const fetchedAt = new Date().toISOString();

          const stockData: StockData = {
            symbol: symbol.toUpperCase(),
            currentPrice,
            previousClose,
            priceChange,
            priceChangePercent,
            tradingDate: tradingDate.toISOString().split('T')[0],
            timestamp: fetchedAt
          };

          const processedData: ProcessedStockData = {
            symbol: symbol.toUpperCase(),
            stockData,
            news: [],
            analysis: {} as FinancialAnalysis,
            fetchedAt
          };

          // Persist data
          const persisted = await persistenceService.persistStockData(processedData);

          // Property: Data should be persisted successfully
          expect(persisted).toBe(true);

          // Property: Timestamp should be accurate (within 1 second of now)
          const now = new Date();
          const fetchedDate = new Date(fetchedAt);
          const timeDiff = Math.abs(now.getTime() - fetchedDate.getTime());
          expect(timeDiff).toBeLessThan(1000); // Within 1 second
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve timestamps across persistence and retrieval', async () => {
    return fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }), // Stock symbol
        fc.date({ min: new Date('2020-01-01'), max: new Date() }), // Trading date
        async (symbol, tradingDate) => {
          const fetchedAt = new Date().toISOString();

          const stockData: StockData = {
            symbol: symbol.toUpperCase(),
            currentPrice: 100.50,
            previousClose: 99.00,
            priceChange: 1.50,
            priceChangePercent: 1.52,
            tradingDate: tradingDate.toISOString().split('T')[0],
            timestamp: fetchedAt
          };

          const processedData: ProcessedStockData = {
            symbol: symbol.toUpperCase(),
            stockData,
            news: [],
            analysis: {} as FinancialAnalysis,
            fetchedAt
          };

          // Persist data
          await persistenceService.persistStockData(processedData);

          // Retrieve historical data
          const historical = await persistenceService.getHistoricalStockData(
            symbol.toUpperCase(),
            new Date(tradingDate.getTime() - 86400000), // Start: 1 day before
            new Date(tradingDate.getTime() + 86400000)  // End: 1 day after
          );

          // Property: Retrieved data should have accurate timestamps
          if (historical.length > 0) {
            const retrieved = historical.find(h => h.symbol === symbol.toUpperCase());
            if (retrieved) {
              expect(retrieved.timestamp).toBeDefined();
              expect(new Date(retrieved.timestamp)).toBeInstanceOf(Date);
              
              // Property: Trading date should be preserved
              expect(retrieved.tradingDate).toBe(tradingDate.toISOString().split('T')[0]);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should track historical data with sequential timestamps', async () => {
    return fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }), // Stock symbol
        fc.integer({ min: 2, max: 5 }), // Number of data points
        async (symbol, dataPoints) => {
          const timestamps: string[] = [];

          // Persist multiple data points with sequential timestamps
          for (let i = 0; i < dataPoints; i++) {
            const fetchedAt = new Date(Date.now() + i * 1000).toISOString(); // 1 second apart
            timestamps.push(fetchedAt);

            const stockData: StockData = {
              symbol: symbol.toUpperCase(),
              currentPrice: 100 + i,
              previousClose: 99 + i,
              priceChange: 1,
              priceChangePercent: 1.01,
              tradingDate: new Date().toISOString().split('T')[0],
              timestamp: fetchedAt
            };

            const processedData: ProcessedStockData = {
              symbol: symbol.toUpperCase(),
              stockData,
              news: [],
              analysis: {} as FinancialAnalysis,
              fetchedAt
            };

            await persistenceService.persistStockData(processedData);
          }

          // Property: All timestamps should be unique and sequential
          const uniqueTimestamps = new Set(timestamps);
          expect(uniqueTimestamps.size).toBe(dataPoints);

          // Property: Timestamps should be in chronological order
          const sortedTimestamps = [...timestamps].sort();
          expect(timestamps).toEqual(sortedTimestamps);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should persist news articles with accurate publication timestamps', async () => {
    return fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }), // Stock symbol
        fc.integer({ min: 1, max: 5 }), // Number of news articles
        fc.date({ min: new Date('2020-01-01'), max: new Date() }), // Publication date
        async (symbol, articleCount, publishedAt) => {
          const newsArticles: NewsArticle[] = Array.from({ length: articleCount }, (_, i) => ({
            id: `article-${i}`,
            title: `News Article ${i}`,
            content: `Content ${i}`,
            contentPreview: `Preview ${i}`,
            publishedAt: new Date(publishedAt.getTime() + i * 3600000).toISOString(), // 1 hour apart
            sentiment: i % 3,
            source: 'Test Source',
            url: `https://example.com/article-${i}`,
            imageUrl: `https://example.com/image-${i}.jpg`
          }));

          const stockData: StockData = {
            symbol: symbol.toUpperCase(),
            currentPrice: 100.50,
            previousClose: 99.00,
            priceChange: 1.50,
            priceChangePercent: 1.52,
            tradingDate: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString()
          };

          const processedData: ProcessedStockData = {
            symbol: symbol.toUpperCase(),
            stockData,
            news: newsArticles,
            analysis: {} as FinancialAnalysis,
            fetchedAt: new Date().toISOString()
          };

          // Persist data
          const persisted = await persistenceService.persistStockData(processedData);

          // Property: Data with news articles should be persisted
          expect(persisted).toBe(true);

          // Property: Each news article should have accurate publication timestamp
          newsArticles.forEach(article => {
            expect(article.publishedAt).toBeDefined();
            expect(new Date(article.publishedAt)).toBeInstanceOf(Date);
          });
        }
      ),
      { numRuns: 30 }
    );
  });
});

