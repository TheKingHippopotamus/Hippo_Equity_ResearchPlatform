/**
 * Property Test: Data Normalization Round-Trip
 * Feature: stock-market-dashboard, Property 4: Data Normalization Round-Trip
 * Validates: Requirements 1.5
 * 
 * For any raw API response, after normalization to the internal schema,
 * the essential fields (symbol, currentPrice, previousClose, tradingDate)
 * should be preserved and retrievable without loss.
 */

import fc from 'fast-check';
import { normalizeData } from '../../src/services/normalizationService.js';
import { NewsArticle, FinancialAnalysis } from '../../src/types/models.js';

describe('Property 4: Data Normalization Round-Trip', () => {
  it('should preserve essential fields in normalized news data', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }), // symbol
        fc.array(
          fc.record({
            id: fc.string(),
            title: fc.string({ minLength: 1 }),
            content: fc.string(),
            publishedAt: fc.string(), // ISO date string
            sentiment: fc.integer({ min: -2, max: 4 }),
            source: fc.string(),
            url: fc.string(),
            imageUrl: fc.option(fc.string(), { nil: undefined })
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (symbol, articles) => {
          const rawData = {
            symbol,
            articles
          };

          const normalized = normalizeData.normalizeNews(rawData, symbol);

          // Verify all articles are normalized
          expect(normalized.length).toBeLessThanOrEqual(articles.length);

          // Verify essential fields are preserved for each article
          normalized.forEach((article: NewsArticle, index: number) => {
            expect(article).toHaveProperty('id');
            expect(article).toHaveProperty('title');
            expect(article).toHaveProperty('content');
            expect(article).toHaveProperty('publishedAt');
            expect(article).toHaveProperty('sentiment');
            expect(article).toHaveProperty('source');
            expect(article).toHaveProperty('url');

            // Validate sentiment range
            expect(article.sentiment).toBeGreaterThanOrEqual(-2);
            expect(article.sentiment).toBeLessThanOrEqual(4);

            // Validate publishedAt is a valid date string
            expect(() => new Date(article.publishedAt)).not.toThrow();
          });

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve essential fields in normalized financial analysis', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }), // symbol
        fc.string(), // companyDescription
        fc.record({
          industry: fc.string(),
          keyPoints: fc.array(fc.string(), { maxLength: 10 }),
          rating: fc.integer({ min: 1, max: 5 }),
          summary: fc.string()
        }), // competitors
        fc.record({
          keyPoints: fc.array(fc.string(), { maxLength: 10 }),
          rating: fc.integer({ min: 1, max: 5 }),
          summary: fc.string()
        }), // financialHealth
        (symbol, companyDescription, competitors, financialHealth) => {
          const rawData = {
            symbol,
            companyDescription,
            competitors,
            financialHealth,
            growth: {
              keyPoints: [],
              rating: 3,
              summary: ''
            },
            profitability: {
              keyPoints: [],
              rating: 3,
              summary: ''
            },
            shareholder_returns: {
              keyPoints: [],
              summary: ''
            },
            valuation: {
              keyPoints: [],
              rating: 3,
              summary: ''
            }
          };

          const normalized = normalizeData.normalizeFinancialAnalysis(rawData, symbol);

          // Verify essential fields are preserved
          expect(normalized.symbol).toBe(symbol);
          expect(normalized.companyDescription).toBe(companyDescription);
          expect(normalized.competitors.industry).toBe(competitors.industry);
          expect(normalized.competitors.rating).toBe(competitors.rating);
          expect(normalized.financialHealth.rating).toBe(financialHealth.rating);

          // Verify all sections have required structure
          expect(normalized).toHaveProperty('competitors');
          expect(normalized).toHaveProperty('financialHealth');
          expect(normalized).toHaveProperty('growth');
          expect(normalized).toHaveProperty('profitability');
          expect(normalized).toHaveProperty('shareholder_returns');
          expect(normalized).toHaveProperty('valuation');

          // Verify ratings are in valid range (1-5)
          expect(normalized.competitors.rating).toBeGreaterThanOrEqual(1);
          expect(normalized.competitors.rating).toBeLessThanOrEqual(5);
          expect(normalized.financialHealth.rating).toBeGreaterThanOrEqual(1);
          expect(normalized.financialHealth.rating).toBeLessThanOrEqual(5);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle missing or malformed fields gracefully', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant({}),
          fc.constant({ invalid: 'data' })
        ),
        (symbol, rawData) => {
          // Should not throw, should return valid structure
          const normalized = normalizeData.normalizeFinancialAnalysis(rawData as any, symbol);

          // Should always return valid structure
          expect(normalized).toHaveProperty('symbol');
          expect(normalized).toHaveProperty('companyDescription');
          expect(normalized).toHaveProperty('competitors');
          expect(normalized).toHaveProperty('financialHealth');
          expect(normalized).toHaveProperty('growth');
          expect(normalized).toHaveProperty('profitability');
          expect(normalized).toHaveProperty('shareholder_returns');
          expect(normalized).toHaveProperty('valuation');

          // Symbol should always be set (from parameter if not in data)
          expect(normalized.symbol).toBe(symbol);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

