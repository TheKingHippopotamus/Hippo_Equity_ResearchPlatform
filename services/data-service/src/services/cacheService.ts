import redisClient from '../config/redis.js';
import logger from '../utils/logger.js';

/**
 * CacheService - Redis-based caching service
 * Implements ICacheService interface from design.md
 * 
 * Requirements: 7.2, 8.2
 */
class CacheService {
  private readonly DEFAULT_TTL = 3600; // 1 hour in seconds

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or null if not found
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const client = redisClient.getClient();
      const value = await client.get(key);
      
      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Cache get error for key ${key}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds (default: 1 hour)
   */
  async set(key: string, value: unknown, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const client = redisClient.getClient();
      const serialized = JSON.stringify(value);
      await client.setEx(key, ttl, serialized);
      logger.debug(`Cached key ${key} with TTL ${ttl}s`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Cache set error for key ${key}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Delete key from cache
   * @param key Cache key to delete
   */
  async delete(key: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      await client.del(key);
      logger.debug(`Deleted cache key ${key}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Cache delete error for key ${key}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Check if key exists in cache
   * @param key Cache key to check
   * @returns true if key exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Cache exists check error for key ${key}: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Clear all cache entries (use with caution)
   */
  async clear(): Promise<void> {
    try {
      const client = redisClient.getClient();
      await client.flushDb();
      logger.warn('Cache cleared - all keys deleted');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Cache clear error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Generate cache key for stock data
   * @param symbol Stock symbol
   * @param dataType Type of data (news, analysis, or combined)
   * @param language Optional language code (default: 'en')
   * @returns Cache key string
   */
  generateKey(
    symbol: string, 
    dataType: 'news' | 'analysis' | 'combined' | 'price' = 'combined',
    language: string = 'en'
  ): string {
    return `stock:${symbol}:${dataType}:${language}`;
  }
}

// Singleton instance
const cacheService = new CacheService();

export default cacheService;
