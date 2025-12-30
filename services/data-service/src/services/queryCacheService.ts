import { Pool } from 'pg';
import logger from '../utils/logger.js';
import cacheService from './cacheService.js';
import postgresClient from '../config/postgres.js';

/**
 * QueryCacheService - Implements query result caching
 * Caches database query results in Redis to reduce database load
 * 
 * Requirements: 7.1, 8.4
 */
class QueryCacheService {
  private pool: Pool | null = null;
  private readonly DEFAULT_TTL = 300; // 5 minutes

  /**
   * Initialize the query cache service
   */
  async initialize(): Promise<void> {
    try {
      this.pool = await postgresClient.connect();
      logger.info('QueryCacheService initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Failed to initialize QueryCacheService: ${errorMessage}`);
    }
  }

  /**
   * Execute a query with caching
   * Checks cache first, then executes query and caches result
   * 
   * Requirements: 7.1, 8.4
   * 
   * @param query SQL query string
   * @param params Query parameters
   * @param cacheKey Cache key (if not provided, generated from query and params)
   * @param ttl Time to live in seconds (default: 5 minutes)
   * @returns Query result
   */
  async executeQuery<T = unknown>(
    query: string,
    params: unknown[] = [],
    cacheKey?: string,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T[]> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not available');
    }

    // Generate cache key if not provided
    const key = cacheKey || this.generateCacheKey(query, params);
    
    // Check cache first
    const cached = await cacheService.get<T[]>(key);
    if (cached) {
      logger.debug(`Query cache hit for key: ${key}`);
      return cached;
    }

    // Execute query
    logger.debug(`Executing query: ${query.substring(0, 100)}...`);
    const startTime = Date.now();
    const result = await this.pool.query(query, params);
    const duration = Date.now() - startTime;
    
    logger.debug(`Query executed in ${duration}ms, returned ${result.rows.length} rows`);

    // Cache the result
    await cacheService.set(key, result.rows as T[], ttl);
    
    return result.rows as T[];
  }

  /**
   * Invalidate cache for a specific key pattern
   * 
   * @param pattern Cache key pattern (supports wildcards)
   */
  async invalidateCache(pattern: string): Promise<void> {
    // Note: Redis doesn't support wildcard deletion directly
    // In production, you might want to use SCAN to find matching keys
    // For now, we'll just log the invalidation request
    logger.info(`Cache invalidation requested for pattern: ${pattern}`);
    
    // If pattern is exact key, delete it
    if (!pattern.includes('*')) {
      await cacheService.delete(pattern);
    }
  }

  /**
   * Generate cache key from query and parameters
   * 
   * @param query SQL query
   * @param params Query parameters
   * @returns Cache key
   */
  private generateCacheKey(query: string, params: unknown[]): string {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const paramsHash = JSON.stringify(params);
    return `query:${Buffer.from(normalizedQuery).toString('base64')}:${Buffer.from(paramsHash).toString('base64')}`;
  }

  /**
   * Get query execution statistics
   * 
   * @returns Statistics object
   */
  async getStats(): Promise<{
    cacheHits: number;
    cacheMisses: number;
    totalQueries: number;
    hitRate: number;
  }> {
    // In production, you would track these metrics
    // For now, return placeholder
    return {
      cacheHits: 0,
      cacheMisses: 0,
      totalQueries: 0,
      hitRate: 0
    };
  }
}

// Singleton instance
const queryCacheService = new QueryCacheService();

export default queryCacheService;

