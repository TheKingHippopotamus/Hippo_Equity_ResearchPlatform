import { Pool } from 'pg';
import logger from '../utils/logger.js';
import postgresClient from '../config/postgres.js';
import queryCacheService from './queryCacheService.js';
import {
  StockData,
  NewsArticle,
  FinancialAnalysis,
  ProcessedStockData
} from '../types/models.js';

/**
 * PersistenceService - Handles data persistence to PostgreSQL
 * Stores stock data with accurate timestamps for historical tracking
 * 
 * Property 21: Stock Data Persistence with Timestamps
 * Requirements: 8.1
 */
class PersistenceService {
  private pool: Pool | null = null;

  /**
   * Initialize the persistence service
   */
  async initialize(): Promise<void> {
    try {
      this.pool = await postgresClient.connect();
      logger.info('PersistenceService initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initialize PersistenceService: ${errorMessage}`);
      // Don't throw - allow service to continue without persistence
    }
  }

  /**
   * Persist stock data to PostgreSQL with timestamps
   * Property 21: Stock Data Persistence with Timestamps
   * Requirements: 8.1
   * 
   * @param data Processed stock data to persist
   * @returns True if successful, false otherwise
   */
  async persistStockData(data: ProcessedStockData): Promise<boolean> {
    if (!this.pool) {
      logger.warn('PostgreSQL pool not available, skipping persistence');
      return false;
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Parse trading date from timestamp
      const tradingDate = data.stockData.tradingDate || 
        new Date(data.fetchedAt).toISOString().split('T')[0];

      // Insert or update stock data
      const stockResult = await client.query(
        `INSERT INTO stock_data.stocks (
          symbol, current_price, previous_close, price_change, 
          price_change_percent, trading_date, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        ON CONFLICT (symbol, trading_date) 
        DO UPDATE SET
          current_price = EXCLUDED.current_price,
          previous_close = EXCLUDED.previous_close,
          price_change = EXCLUDED.price_change,
          price_change_percent = EXCLUDED.price_change_percent,
          updated_at = EXCLUDED.updated_at
        RETURNING id`,
        [
          data.symbol,
          data.stockData.currentPrice,
          data.stockData.previousClose,
          data.stockData.priceChange,
          data.stockData.priceChangePercent,
          tradingDate,
          new Date(data.fetchedAt || Date.now())
        ]
      );

      const stockId = stockResult.rows[0].id;

      // Persist news articles
      if (data.news && data.news.length > 0) {
        for (const article of data.news) {
          await client.query(
            `INSERT INTO stock_data.news_articles (
              stock_id, symbol, article_id, title, content, content_preview,
              published_at, sentiment, source, url, image_url, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
            ON CONFLICT (article_id) 
            DO UPDATE SET
              title = EXCLUDED.title,
              content = EXCLUDED.content,
              content_preview = EXCLUDED.content_preview,
              sentiment = EXCLUDED.sentiment,
              source = EXCLUDED.source,
              url = EXCLUDED.url,
              image_url = EXCLUDED.image_url,
              updated_at = EXCLUDED.updated_at`,
            [
              stockId,
              data.symbol,
              article.id,
              article.title,
              article.content || null,
              article.contentPreview || null,
              new Date(article.publishedAt),
              article.sentiment || null,
              article.source || null,
              article.url || null,
              article.imageUrl || null,
              new Date(data.fetchedAt || Date.now())
            ]
          );
        }
      }

      // Persist financial analysis
      if (data.analysis) {
        await client.query(
          `INSERT INTO stock_data.financial_analysis (
            stock_id, symbol, company_description,
            competitors_industry, competitors_key_points, competitors_rating, competitors_summary,
            financial_health_key_points, financial_health_rating, financial_health_summary,
            growth_key_points, growth_rating, growth_summary,
            profitability_key_points, profitability_rating, profitability_summary,
            shareholder_returns_key_points, shareholder_returns_summary,
            valuation_key_points, valuation_rating, valuation_summary,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $22)
          ON CONFLICT (symbol, created_at) 
          DO UPDATE SET
            company_description = EXCLUDED.company_description,
            competitors_industry = EXCLUDED.competitors_industry,
            competitors_key_points = EXCLUDED.competitors_key_points,
            competitors_rating = EXCLUDED.competitors_rating,
            competitors_summary = EXCLUDED.competitors_summary,
            financial_health_key_points = EXCLUDED.financial_health_key_points,
            financial_health_rating = EXCLUDED.financial_health_rating,
            financial_health_summary = EXCLUDED.financial_health_summary,
            growth_key_points = EXCLUDED.growth_key_points,
            growth_rating = EXCLUDED.growth_rating,
            growth_summary = EXCLUDED.growth_summary,
            profitability_key_points = EXCLUDED.profitability_key_points,
            profitability_rating = EXCLUDED.profitability_rating,
            profitability_summary = EXCLUDED.profitability_summary,
            shareholder_returns_key_points = EXCLUDED.shareholder_returns_key_points,
            shareholder_returns_summary = EXCLUDED.shareholder_returns_summary,
            valuation_key_points = EXCLUDED.valuation_key_points,
            valuation_rating = EXCLUDED.valuation_rating,
            valuation_summary = EXCLUDED.valuation_summary,
            updated_at = EXCLUDED.updated_at`,
          [
            stockId,
            data.symbol,
            data.analysis.companyDescription || null,
            data.analysis.competitors?.industry || null,
            data.analysis.competitors?.keyPoints || [],
            data.analysis.competitors?.rating || null,
            data.analysis.competitors?.summary || null,
            data.analysis.financialHealth?.keyPoints || [],
            data.analysis.financialHealth?.rating || null,
            data.analysis.financialHealth?.summary || null,
            data.analysis.growth?.keyPoints || [],
            data.analysis.growth?.rating || null,
            data.analysis.growth?.summary || null,
            data.analysis.profitability?.keyPoints || [],
            data.analysis.profitability?.rating || null,
            data.analysis.profitability?.summary || null,
            data.analysis.shareholder_returns?.keyPoints || [],
            data.analysis.shareholder_returns?.summary || null,
            data.analysis.valuation?.keyPoints || [],
            data.analysis.valuation?.rating || null,
            data.analysis.valuation?.summary || null,
            new Date(data.fetchedAt || Date.now())
          ]
        );
      }

      await client.query('COMMIT');
      logger.info(`Successfully persisted stock data for ${data.symbol} with timestamp ${data.fetchedAt}`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to persist stock data for ${data.symbol}: ${errorMessage}`);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Get historical stock data from database with query caching
   * Optimized with composite indexes and query result caching
   * Requirements: 8.1, 7.1, 8.4
   * 
   * @param symbol Stock symbol
   * @param startDate Optional start date
   * @param endDate Optional end date
   * @returns Historical stock data
   */
  async getHistoricalStockData(
    symbol: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<StockData[]> {
    if (!this.pool) {
      logger.warn('PostgreSQL pool not available');
      return [];
    }

    try {
      let query = `
        SELECT symbol, current_price, previous_close, price_change, 
               price_change_percent, trading_date, created_at, updated_at
        FROM stock_data.stocks
        WHERE symbol = $1
      `;
      const params: (string | Date)[] = [symbol.toUpperCase()];

      if (startDate) {
        query += ' AND trading_date >= $2';
        params.push(startDate);
        if (endDate) {
          query += ' AND trading_date <= $3';
          params.push(endDate);
        }
      } else if (endDate) {
        query += ' AND trading_date <= $2';
        params.push(endDate);
      }

      // Use composite index: idx_stocks_symbol_trading_date
      query += ' ORDER BY trading_date DESC, created_at DESC';

      // Use query cache (5 minute TTL for historical data)
      const cacheKey = `historical:${symbol}:${startDate?.toISOString() || 'all'}:${endDate?.toISOString() || 'all'}`;
      const cached = await queryCacheService.executeQuery<{
        symbol: string;
        current_price: string;
        previous_close: string;
        price_change: string;
        price_change_percent: string;
        trading_date: Date;
        created_at: Date;
        updated_at: Date;
      }>(query, params, cacheKey, 300);

      return cached.map(row => ({
        symbol: row.symbol,
        currentPrice: parseFloat(row.current_price),
        previousClose: parseFloat(row.previous_close),
        priceChange: parseFloat(row.price_change),
        priceChangePercent: parseFloat(row.price_change_percent),
        tradingDate: row.trading_date.toISOString().split('T')[0],
        timestamp: row.created_at.toISOString()
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get historical stock data for ${symbol}: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Batch insert stock data to avoid N+1 query problems
   * Requirements: 7.1
   * 
   * @param dataArray Array of processed stock data to persist
   * @returns Number of successfully persisted records
   */
  async batchPersistStockData(dataArray: ProcessedStockData[]): Promise<number> {
    if (!this.pool || dataArray.length === 0) {
      return 0;
    }

    const client = await this.pool.connect();
    let successCount = 0;

    try {
      await client.query('BEGIN');

      for (const data of dataArray) {
        const persisted = await this.persistStockDataInternal(client, data);
        if (persisted) {
          successCount++;
        }
      }

      await client.query('COMMIT');
      logger.info(`Batch persisted ${successCount}/${dataArray.length} stock records`);
      return successCount;
    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Batch persist failed: ${errorMessage}`);
      return successCount;
    } finally {
      client.release();
    }
  }

  /**
   * Internal method to persist stock data using an existing client
   * Avoids creating new connections for each record (N+1 optimization)
   */
  private async persistStockDataInternal(
    client: any,
    data: ProcessedStockData
  ): Promise<boolean> {
    try {
      const tradingDate = data.stockData.tradingDate || 
        new Date(data.fetchedAt).toISOString().split('T')[0];

      const stockResult = await client.query(
        `INSERT INTO stock_data.stocks (
          symbol, current_price, previous_close, price_change, 
          price_change_percent, trading_date, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        ON CONFLICT (symbol, trading_date) 
        DO UPDATE SET
          current_price = EXCLUDED.current_price,
          previous_close = EXCLUDED.previous_close,
          price_change = EXCLUDED.price_change,
          price_change_percent = EXCLUDED.price_change_percent,
          updated_at = EXCLUDED.updated_at
        RETURNING id`,
        [
          data.symbol,
          data.stockData.currentPrice,
          data.stockData.previousClose,
          data.stockData.priceChange,
          data.stockData.priceChangePercent,
          tradingDate,
          new Date(data.fetchedAt || Date.now())
        ]
      );

      const stockId = stockResult.rows[0].id;

      // Batch insert news articles (avoid N+1)
      if (data.news && data.news.length > 0) {
        const newsValues = data.news.map((article, index) => {
          const baseIndex = index * 12;
          return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 12})`;
        }).join(', ');

        const newsParams: unknown[] = [];
        data.news.forEach(article => {
          newsParams.push(
            stockId,
            data.symbol,
            article.id,
            article.title,
            article.content || null,
            article.contentPreview || null,
            new Date(article.publishedAt),
            article.sentiment || null,
            article.source || null,
            article.url || null,
            article.imageUrl || null,
            new Date(data.fetchedAt || Date.now())
          );
        });

        await client.query(
          `INSERT INTO stock_data.news_articles (
            stock_id, symbol, article_id, title, content, content_preview,
            published_at, sentiment, source, url, image_url, created_at, updated_at
          ) VALUES ${newsValues}
          ON CONFLICT (article_id) 
          DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            content_preview = EXCLUDED.content_preview,
            sentiment = EXCLUDED.sentiment,
            source = EXCLUDED.source,
            url = EXCLUDED.url,
            image_url = EXCLUDED.image_url,
            updated_at = EXCLUDED.updated_at`,
          newsParams
        );
      }

      // Insert financial analysis
      if (data.analysis) {
        await client.query(
          `INSERT INTO stock_data.financial_analysis (
            stock_id, symbol, company_description,
            competitors_industry, competitors_key_points, competitors_rating, competitors_summary,
            financial_health_key_points, financial_health_rating, financial_health_summary,
            growth_key_points, growth_rating, growth_summary,
            profitability_key_points, profitability_rating, profitability_summary,
            shareholder_returns_key_points, shareholder_returns_summary,
            valuation_key_points, valuation_rating, valuation_summary,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $22)
          ON CONFLICT (symbol, created_at) 
          DO UPDATE SET
            company_description = EXCLUDED.company_description,
            competitors_industry = EXCLUDED.competitors_industry,
            competitors_key_points = EXCLUDED.competitors_key_points,
            competitors_rating = EXCLUDED.competitors_rating,
            competitors_summary = EXCLUDED.competitors_summary,
            financial_health_key_points = EXCLUDED.financial_health_key_points,
            financial_health_rating = EXCLUDED.financial_health_rating,
            financial_health_summary = EXCLUDED.financial_health_summary,
            growth_key_points = EXCLUDED.growth_key_points,
            growth_rating = EXCLUDED.growth_rating,
            growth_summary = EXCLUDED.growth_summary,
            profitability_key_points = EXCLUDED.profitability_key_points,
            profitability_rating = EXCLUDED.profitability_rating,
            profitability_summary = EXCLUDED.profitability_summary,
            shareholder_returns_key_points = EXCLUDED.shareholder_returns_key_points,
            shareholder_returns_summary = EXCLUDED.shareholder_returns_summary,
            valuation_key_points = EXCLUDED.valuation_key_points,
            valuation_rating = EXCLUDED.valuation_rating,
            valuation_summary = EXCLUDED.valuation_summary,
            updated_at = EXCLUDED.updated_at`,
          [
            stockId,
            data.symbol,
            data.analysis.companyDescription || null,
            data.analysis.competitors?.industry || null,
            data.analysis.competitors?.keyPoints || [],
            data.analysis.competitors?.rating || null,
            data.analysis.competitors?.summary || null,
            data.analysis.financialHealth?.keyPoints || [],
            data.analysis.financialHealth?.rating || null,
            data.analysis.financialHealth?.summary || null,
            data.analysis.growth?.keyPoints || [],
            data.analysis.growth?.rating || null,
            data.analysis.growth?.summary || null,
            data.analysis.profitability?.keyPoints || [],
            data.analysis.profitability?.rating || null,
            data.analysis.profitability?.summary || null,
            data.analysis.shareholder_returns?.keyPoints || [],
            data.analysis.shareholder_returns?.summary || null,
            data.analysis.valuation?.keyPoints || [],
            data.analysis.valuation?.rating || null,
            data.analysis.valuation?.summary || null,
            new Date(data.fetchedAt || Date.now())
          ]
        );
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to persist stock data for ${data.symbol}: ${errorMessage}`);
      return false;
    }
  }
}

// Singleton instance
const persistenceService = new PersistenceService();

export default persistenceService;

