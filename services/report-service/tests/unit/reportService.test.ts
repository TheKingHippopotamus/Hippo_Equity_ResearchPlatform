import reportService from '../../src/services/reportService.js';
import storageService from '../../src/services/storageService.js';
import translationClient from '../../src/config/translationClient.js';
import { ProcessedStockData, StockData, NewsArticle, FinancialAnalysis } from '../../src/types/models.js';
import axios from 'axios';

// Mock dependencies
jest.mock('../../src/config/translationClient.js');
jest.mock('axios');
jest.mock('pdfkit');
jest.mock('canvas');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedTranslationClient = translationClient as jest.Mocked<typeof translationClient>;

describe('ReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePDF', () => {
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

    it('should generate PDF successfully', async () => {
      mockedAxios.get.mockResolvedValue({
        data: mockStockData,
      });

      mockedTranslationClient.translate.mockResolvedValue('Translated Text');

      const pdfBuffer = await reportService.generatePDF('AAPL', 'en', 'user123');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/stock/AAPL'),
        expect.any(Object)
      );
    });

    it('should handle missing stock data gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Stock not found'));

      await expect(
        reportService.generatePDF('INVALID', 'en', 'user123')
      ).rejects.toThrow();
    });

    it('should generate PDF in different languages', async () => {
      mockedAxios.get.mockResolvedValue({
        data: mockStockData,
      });

      mockedTranslationClient.translate.mockResolvedValue('Texto Traducido');

      const pdfBuffer = await reportService.generatePDF('AAPL', 'es', 'user123');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(mockedTranslationClient.translate).toHaveBeenCalled();
    });
  });

  describe('includeLogo', () => {
    it('should include logo when URL is provided', async () => {
      const mockImageBuffer = Buffer.from('fake-image-data');
      mockedAxios.get.mockResolvedValue({
        data: mockImageBuffer,
        headers: { 'content-type': 'image/png' },
      });

      // Mock PDFDocument
      const mockDoc = {
        image: jest.fn(),
      };

      await reportService.includeLogo(mockDoc as any, 'https://example.com/logo.png');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com/logo.png',
        expect.any(Object)
      );
    });

    it('should handle logo fetch failure gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Failed to fetch logo'));

      const mockDoc = {
        image: jest.fn(),
      };

      await expect(
        reportService.includeLogo(mockDoc as any, 'https://invalid.com/logo.png')
      ).rejects.toThrow();
    });
  });

  describe('renderCharts', () => {
    it('should render line chart', async () => {
      const mockDoc = {
        y: 100,
        image: jest.fn(),
        moveDown: jest.fn(),
      };

      const chartData = {
        labels: ['Day 1', 'Day 2', 'Day 3'],
        values: [100, 105, 110],
        title: 'Price History',
        type: 'line' as const,
      };

      await reportService.renderCharts(mockDoc as any, [chartData], 'en');

      expect(mockDoc.image).toHaveBeenCalled();
    });

    it('should render bar chart', async () => {
      const mockDoc = {
        y: 100,
        image: jest.fn(),
        moveDown: jest.fn(),
      };

      const chartData = {
        labels: ['Q1', 'Q2', 'Q3'],
        values: [100, 200, 150],
        title: 'Quarterly Revenue',
        type: 'bar' as const,
      };

      await reportService.renderCharts(mockDoc as any, [chartData], 'en');

      expect(mockDoc.image).toHaveBeenCalled();
    });

    it('should render area chart', async () => {
      const mockDoc = {
        y: 100,
        image: jest.fn(),
        moveDown: jest.fn(),
      };

      const chartData = {
        labels: ['Jan', 'Feb', 'Mar'],
        values: [50, 60, 55],
        title: 'Monthly Trend',
        type: 'area' as const,
      };

      await reportService.renderCharts(mockDoc as any, [chartData], 'en');

      expect(mockDoc.image).toHaveBeenCalled();
    });
  });
});

