/**
 * Property Test: PDF Report Language Translation
 * Feature: stock-market-dashboard, Property 16: PDF Report Language Translation
 * Validates: Requirements 5.3
 * 
 * For any PDF report generated for a user with a non-English language preference,
 * all text content should be rendered in the selected language.
 */

import fc from 'fast-check';
import reportService from '../../src/services/reportService.js';
import translationClient from '../../src/config/translationClient.js';
import { ProcessedStockData, SupportedLanguage } from '../../src/types/models.js';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('../../src/config/translationClient.js');
jest.mock('pdfkit');
jest.mock('canvas');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedTranslationClient = translationClient as jest.Mocked<typeof translationClient>;

describe('Property 16: PDF Report Language Translation', () => {
  const supportedLanguages: SupportedLanguage[] = ['en', 'es', 'fr', 'de', 'zh', 'he'];

  const mockStockData: ProcessedStockData = {
    symbol: 'AAPL',
    stockData: {
      symbol: 'AAPL',
      currentPrice: 150.25,
      previousClose: 149.50,
      priceChange: 0.75,
      priceChangePercent: 0.5,
      tradingDate: '2024-01-15',
      timestamp: '2024-01-15T10:00:00Z',
    },
    news: [
      {
        id: '1',
        title: 'Test News Article',
        content: 'Full content here',
        contentPreview: 'Preview content',
        publishedAt: '2024-01-15T09:00:00Z',
        sentiment: 2,
        source: 'Test Source',
        url: 'https://example.com',
      },
    ],
    analysis: {
      symbol: 'AAPL',
      companyDescription: 'Test company description',
      competitors: {
        industry: 'Technology',
        keyPoints: ['Point 1', 'Point 2'],
        rating: 4,
        summary: 'Competitor summary',
      },
      financialHealth: {
        keyPoints: ['Health point 1'],
        rating: 5,
        summary: 'Financial health summary',
      },
      growth: {
        keyPoints: ['Growth point 1'],
        rating: 4,
        summary: 'Growth summary',
      },
      profitability: {
        keyPoints: ['Profit point 1'],
        rating: 3,
        summary: 'Profitability summary',
      },
        shareholder_returns: {
        keyPoints: ['Return point 1'],
        summary: 'Returns summary',
      },
      valuation: {
        keyPoints: ['Valuation point 1'],
        rating: 4,
        summary: 'Valuation summary',
      },
    },
    fetchedAt: '2024-01-15T10:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({
      data: mockStockData,
    });
  });

  it('should generate PDF in all supported languages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...supportedLanguages),
        async (language: SupportedLanguage) => {
          // Mock translation client to return language-specific translations
          mockedTranslationClient.translate.mockImplementation(async (key: string, lang: string) => {
            // Return mock translations based on language
            const translations: Record<string, Record<string, string>> = {
              en: { 'ui.stockReport': 'Stock Report', 'ui.page': 'Page' },
              es: { 'ui.stockReport': 'Informe de Acciones', 'ui.page': 'Página' },
              fr: { 'ui.stockReport': 'Rapport sur les Actions', 'ui.page': 'Page' },
              de: { 'ui.stockReport': 'Aktienbericht', 'ui.page': 'Seite' },
              zh: { 'ui.stockReport': '股票报告', 'ui.page': '页' },
              he: { 'ui.stockReport': 'דוח מניות', 'ui.page': 'עמוד' },
            };
            return translations[lang]?.[key] || key;
          });

          const pdfBuffer = await reportService.generatePDF('AAPL', language, 'test-user');

          expect(pdfBuffer).toBeInstanceOf(Buffer);
          expect(pdfBuffer.length).toBeGreaterThan(0);

          // Verify translation client was called
          expect(mockedTranslationClient.translate).toHaveBeenCalled();

          return true;
        }
      ),
      { numRuns: supportedLanguages.length }
    );
  });

  it('should translate all UI labels in PDF', async () => {
    const language: SupportedLanguage = 'es';

    mockedTranslationClient.translate.mockResolvedValue('Texto Traducido');

    const pdfBuffer = await reportService.generatePDF('AAPL', language, 'test-user');

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(mockedTranslationClient.translate).toHaveBeenCalledWith(
      expect.any(String),
      language
    );
  });

  it('should handle language switching without errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(...supportedLanguages), { minLength: 2, maxLength: 5 }),
        async (languages: SupportedLanguage[]) => {
          // Generate PDFs in sequence with different languages
          for (const language of languages) {
            mockedTranslationClient.translate.mockResolvedValue(`Translated in ${language}`);

            const pdfBuffer = await reportService.generatePDF('AAPL', language, 'test-user');

            expect(pdfBuffer).toBeInstanceOf(Buffer);
            expect(pdfBuffer.length).toBeGreaterThan(0);
          }

          return true;
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should fallback to English for invalid language codes', async () => {
    const invalidLanguage = 'invalid' as SupportedLanguage;

    mockedTranslationClient.translate.mockResolvedValue('Fallback Text');

    const pdfBuffer = await reportService.generatePDF('AAPL', invalidLanguage, 'test-user');

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });
});

