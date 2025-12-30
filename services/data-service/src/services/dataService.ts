import axios, { AxiosError, AxiosResponse } from 'axios';
import logger from '../utils/logger.js';
import cacheService from './cacheService.js';
import translationClient from '../config/translationClient.js';
import persistenceService from './persistenceService.js';
import {
  NewsArticle,
  FinancialAnalysis,
  ProcessedStockData,
  RawStockNewsResponse,
  RawFinancialAnalysisResponse,
  RawPriceHistoryResponse,
  StockData
} from '../types/models.js';
import { normalizeData } from './normalizationService.js';

/**
 * DataService - Handles API integration and data fetching
 * Implements IDataService interface from design.md
 * 
 * Requirements: 1.1, 1.3, 1.4, 7.2
 */
class DataService {
  private readonly API_BASE_URL: string;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s
  private readonly API_KEY: string | undefined;

  constructor() {
    // Public API - no API key required
    this.API_BASE_URL = process.env.DATA_PROVIDER_API_URL || 'https://provider.example';
    this.API_KEY = process.env.DATA_PROVIDER_API_KEY;
  }

  /**
   * Fetch stock news from API with retry logic and caching
   * @param symbol Stock symbol (e.g., 'AAPL')
   * @param language Optional language code for translation (default: 'en')
   * @returns Array of news articles (translated if language specified)
   * Requirements: 1.1, 1.3, 1.4, 7.2, 3.3
   */
  async fetchStockNews(symbol: string, language: string = 'en'): Promise<NewsArticle[]> {
    const cacheKey = cacheService.generateKey(symbol, 'news', language);
    
    // Check cache first
    const cached = await cacheService.get<NewsArticle[]>(cacheKey);
    if (cached) {
      logger.info(`Cache hit for stock news: ${symbol} (language: ${language})`);
      return cached;
    }

    logger.info(`Fetching stock news for symbol: ${symbol} (language: ${language})`);

    try {
      // Public API endpoint: https://provider.example/api/stock-news/<ticker>
      const response = await this.fetchWithRetry<RawStockNewsResponse>(
        `${this.API_BASE_URL}/api/stock-news/${symbol}`
      );

      // Normalize and validate data
      let normalized = normalizeData.normalizeNews(response, symbol);
      
      // Translate if language is not English
      if (language !== 'en') {
        normalized = await this.translateNewsArticles(normalized, language);
      }
      
      // Cache the result (1 hour TTL)
      await cacheService.set(cacheKey, normalized, 3600);
      
      return normalized;
    } catch (error) {
      logger.error(`Failed to fetch stock news for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to cache if available (even if expired)
      const staleCache = await cacheService.get<NewsArticle[]>(cacheKey);
      if (staleCache) {
        logger.warn(`Returning stale cache for ${symbol} due to API failure`);
        return staleCache;
      }
      
      throw error;
    }
  }

  /**
   * Fetch financial analysis from API with retry logic and caching
   * @param symbol Stock symbol (e.g., 'AAPL')
   * @param language Optional language code for translation (default: 'en')
   * @returns Financial analysis data (translated if language specified)
   * Requirements: 1.1, 1.3, 1.4, 7.2, 3.4
   */
  async fetchFinancialAnalysis(symbol: string, language: string = 'en'): Promise<FinancialAnalysis> {
    const cacheKey = cacheService.generateKey(symbol, 'analysis', language);
    
    // Check cache first
    const cached = await cacheService.get<FinancialAnalysis>(cacheKey);
    if (cached) {
      logger.info(`Cache hit for financial analysis: ${symbol} (language: ${language})`);
      return cached;
    }

    logger.info(`Fetching financial analysis for symbol: ${symbol} (language: ${language})`);

    try {
      // Public API endpoint: https://provider.example/api/quote/<ticker>/financial-analysis
      const response = await this.fetchWithRetry<RawFinancialAnalysisResponse>(
        `${this.API_BASE_URL}/api/quote/${symbol}/financial-analysis`
      );

      // Normalize and validate data
      let normalized = normalizeData.normalizeFinancialAnalysis(response, symbol);
      
      // Translate if language is not English
      if (language !== 'en') {
        normalized = await this.translateFinancialAnalysis(normalized, language);
      }
      
      // Cache the result (1 hour TTL)
      await cacheService.set(cacheKey, normalized, 3600);
      
      return normalized;
    } catch (error) {
      logger.error(`Failed to fetch financial analysis for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to cache if available (even if expired)
      const staleCache = await cacheService.get<FinancialAnalysis>(cacheKey);
      if (staleCache) {
        logger.warn(`Returning stale cache for ${symbol} due to API failure`);
        return staleCache;
      }
      
      throw error;
    }
  }

  /**
   * Fetch price history and derive current/previous prices
   */
  private async fetchPriceHistory(symbol: string): Promise<StockData | null> {
    const cacheKey = cacheService.generateKey(symbol, 'price', 'en');
    const cached = await cacheService.get<StockData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.fetchWithRetry<RawPriceHistoryResponse>(
        `${this.API_BASE_URL}/api/quote/${symbol}/price-history`
      );

      const history = response.price_history || {};
      const series =
        history['1M'] ||
        history['1Y'] ||
        history['10Y'] ||
        history['1D'];

      const prices = series?.prices;
      const labels = series?.labels;

      if (!Array.isArray(prices) || prices.length === 0) {
        return null;
      }

      const currentPrice = prices[prices.length - 1] || 0;
      const previousClose = prices.length > 1 ? prices[prices.length - 2] : currentPrice;
      const priceChange = currentPrice - previousClose;
      const priceChangePercent = previousClose ? (priceChange / previousClose) * 100 : 0;
      const tradingDate = this.parseTradingDate(labels?.[labels.length - 1]);

      const stockData: StockData = {
        symbol,
        currentPrice,
        previousClose,
        priceChange,
        priceChangePercent,
        tradingDate,
        timestamp: new Date().toISOString()
      };

      await cacheService.set(cacheKey, stockData, 3600);
      return stockData;
    } catch (error) {
      logger.warn(`Failed to fetch price history for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Fetch both news and analysis, return combined data
   * @param symbol Stock symbol
   * @param language Optional language code for translation (default: 'en')
   * @returns Combined processed stock data (translated if language specified)
   * Requirements: 3.3, 3.4
   */
  async fetchStockData(symbol: string, language: string = 'en'): Promise<ProcessedStockData> {
    const cacheKey = cacheService.generateKey(symbol, 'combined', language);
    
    // Check cache first
    const cached = await cacheService.get<ProcessedStockData>(cacheKey);
    if (cached) {
      logger.info(`Cache hit for combined stock data: ${symbol} (language: ${language})`);
      return cached;
    }

    logger.info(`Fetching combined stock data for symbol: ${symbol} (language: ${language})`);

    try {
      // Fetch in parallel with language
      const [news, analysis, priceData] = await Promise.all([
        this.fetchStockNews(symbol, language),
        this.fetchFinancialAnalysis(symbol, language),
        this.fetchPriceHistory(symbol)
      ]);

      const stockData: StockData = priceData || {
        symbol,
        currentPrice: 0,
        previousClose: 0,
        priceChange: 0,
        priceChangePercent: 0,
        tradingDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString()
      };

      const processedData: ProcessedStockData = {
        symbol,
        stockData,
        news,
        analysis,
        fetchedAt: new Date().toISOString()
      };

      // Cache the combined result (1 hour TTL)
      await cacheService.set(cacheKey, processedData, 3600);
      
      // Persist to PostgreSQL with timestamps (async, don't wait)
      // Property 21: Stock Data Persistence with Timestamps
      // Requirements: 8.1
      persistenceService.persistStockData(processedData).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(`Failed to persist stock data for ${symbol}: ${errorMessage}`);
        // Don't throw - persistence failure shouldn't block response
      });
      
      return processedData;
    } catch (error) {
      logger.error(`Failed to fetch combined stock data for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to cache if available
      const staleCache = await cacheService.get<ProcessedStockData>(cacheKey);
      if (staleCache) {
        logger.warn(`Returning stale cache for ${symbol} due to API failure`);
        return staleCache;
      }
      
      throw error;
    }
  }

  /**
   * Fetch from API with exponential backoff retry logic
   * Property 2: Exponential Backoff Retry Timing
   * Requirements: 1.3
   * 
   * @param url API endpoint URL
   * @param params Request parameters
   * @returns API response data
   */
  private async fetchWithRetry<T>(
    url: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    let lastError: Error | AxiosError | null = null;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        if (this.API_KEY && this.API_KEY !== 'your_api_key_here') {
          headers.Authorization = `Bearer ${this.API_KEY}`;
        }

        const response: AxiosResponse<T> = await axios.get(url, {
          params,
          headers,
          timeout: 10000 // 10 second timeout
        });

        logger.info(`API request successful: ${url} (attempt ${attempt + 1})`);
        return response.data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        const isAxiosError = error instanceof AxiosError;
        const statusCode = isAxiosError ? error.response?.status : undefined;
        
        // Don't retry on 4xx errors (client errors)
        if (statusCode && statusCode >= 400 && statusCode < 500) {
          logger.error(`Client error (${statusCode}) for ${url}, not retrying`);
          throw error;
        }

        // Log retry attempt
        if (attempt < this.MAX_RETRIES - 1) {
          const delay = this.RETRY_DELAYS[attempt];
          logger.warn(
            `API request failed for ${url} (attempt ${attempt + 1}/${this.MAX_RETRIES}), ` +
            `retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        } else {
          logger.error(
            `API request failed for ${url} after ${this.MAX_RETRIES} attempts: ` +
            `${lastError.message}`
          );
        }
      }
    }

    // All retries exhausted
    throw lastError || new Error('API request failed after all retries');
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private parseTradingDate(label: string | undefined): string {
    if (!label) {
      return new Date().toISOString().split('T')[0];
    }

    if (label.includes(':')) {
      return new Date().toISOString().split('T')[0];
    }

    const parts = label.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      const fullYear = year.length === 2 ? `20${year}` : year;
      const iso = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const parsed = new Date(iso);
      if (!Number.isNaN(parsed.getTime())) {
        return iso;
      }
    }

    return label;
  }

  /**
   * Translate news articles
   * @param articles News articles to translate
   * @param language Target language code
   * @returns Translated news articles
   * Requirements: 3.3
   */
  private async translateNewsArticles(
    articles: NewsArticle[],
    language: string
  ): Promise<NewsArticle[]> {
    try {
      // Translate each article's text fields
      const translatedArticles = await Promise.all(
        articles.map(async (article) => {
          const translated: NewsArticle = { ...article };
          
          // Translate title
          if (article.title) {
            const translatedTitle = await translationClient.translateContent(
              article.title,
              language
            );
            translated.title = typeof translatedTitle === 'string' ? translatedTitle : article.title;
          }
          
          // Translate content preview
          if (article.contentPreview) {
            const translatedPreview = await translationClient.translateContent(
              article.contentPreview,
              language
            );
            translated.contentPreview = typeof translatedPreview === 'string' 
              ? translatedPreview 
              : article.contentPreview;
          }
          
          // Translate source
          if (article.source) {
            const translatedSource = await translationClient.translateContent(
              article.source,
              language
            );
            translated.source = typeof translatedSource === 'string' 
              ? translatedSource 
              : article.source;
          }
          
          // Keep content as-is (full content translation would require external API)
          // Keep other fields unchanged (id, publishedAt, sentiment, url, imageUrl)
          
          return translated;
        })
      );
      
      return translatedArticles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Failed to translate news articles: ${errorMessage}, returning original`);
      return articles; // Return original on translation failure
    }
  }

  /**
   * Translate financial analysis
   * @param analysis Financial analysis to translate
   * @param language Target language code
   * @returns Translated financial analysis
   * Requirements: 3.4
   */
  private async translateFinancialAnalysis(
    analysis: FinancialAnalysis,
    language: string
  ): Promise<FinancialAnalysis> {
    try {
      const translated: FinancialAnalysis = { ...analysis };
      
      // Translate company description
      if (analysis.companyDescription) {
        const translatedDesc = await translationClient.translateContent(
          analysis.companyDescription,
          language
        );
        translated.companyDescription = typeof translatedDesc === 'string' 
          ? translatedDesc 
          : analysis.companyDescription;
      }
      
      // Helper function to translate a section
      const translateSection = async <T extends {
        keyPoints: string[];
        rating?: number;
        summary: string;
      }>(section: T): Promise<T> => {
        const translatedSection = { ...section } as T;
        
        // Translate summary
        if (section.summary) {
          const translatedSummary = await translationClient.translateContent(
            section.summary,
            language
          );
          translatedSection.summary = typeof translatedSummary === 'string' 
            ? translatedSummary 
            : section.summary;
        }
        
        // Translate key points
        if (Array.isArray(section.keyPoints)) {
          translatedSection.keyPoints = await Promise.all(
            section.keyPoints.map(async (point) => {
              const translated = await translationClient.translateContent(point, language);
              return typeof translated === 'string' ? translated : point;
            })
          ) as string[];
        }
        
        // Keep rating unchanged (numerical data) - preserve original type
        return translatedSection;
      };
      
      // Translate competitors section
      if (analysis.competitors) {
        translated.competitors = {
          ...analysis.competitors,
          ...(await translateSection(analysis.competitors))
        };
        
        // Translate industry
        if (analysis.competitors.industry) {
          const translatedIndustry = await translationClient.translateContent(
            analysis.competitors.industry,
            language
          );
          translated.competitors.industry = typeof translatedIndustry === 'string' 
            ? translatedIndustry 
            : analysis.competitors.industry;
        }
      }
      
      // Translate financial health
      if (analysis.financialHealth) {
        translated.financialHealth = await translateSection(analysis.financialHealth);
      }
      
      // Translate growth
      if (analysis.growth) {
        translated.growth = await translateSection(analysis.growth);
      }
      
      // Translate profitability
      if (analysis.profitability) {
        translated.profitability = await translateSection(analysis.profitability);
      }
      
      // Translate shareholder returns (no rating)
      if (analysis.shareholder_returns) {
        translated.shareholder_returns = await translateSection(analysis.shareholder_returns);
      }
      
      // Translate valuation
      if (analysis.valuation) {
        translated.valuation = await translateSection(analysis.valuation);
      }
      
      return translated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Failed to translate financial analysis: ${errorMessage}, returning original`);
      return analysis; // Return original on translation failure
    }
  }

  /**
   * Get cached data (used by external services)
   * @param symbol Stock symbol
   * @param language Optional language code (default: 'en')
   * @returns Cached data or null
   */
  async getCachedData(symbol: string, language: string = 'en'): Promise<ProcessedStockData | null> {
    const cacheKey = cacheService.generateKey(symbol, 'combined', language);
    return await cacheService.get<ProcessedStockData>(cacheKey);
  }

  /**
   * Set cached data (used by external services)
   * @param symbol Stock symbol
   * @param data Data to cache
   * @param ttl Time to live in seconds
   * @param language Optional language code (default: 'en')
   */
  async setCachedData(
    symbol: string, 
    data: ProcessedStockData, 
    ttl: number = 3600,
    language: string = 'en'
  ): Promise<void> {
    const cacheKey = cacheService.generateKey(symbol, 'combined', language);
    await cacheService.set(cacheKey, data, ttl);
  }
}

// Singleton instance
const dataService = new DataService();

export default dataService;
