import logger from '../utils/logger.js';
import redisClient from '../config/redis.js';
import postgresClient from '../config/postgres.js';
import { UserPreferences, UserPreferencesRow } from '../types/models.js';

// Supported languages (must match TranslationService)
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'zh', 'he'] as const;
const DEFAULT_LANGUAGE = 'en';
const CACHE_TTL = 3600; // 1 hour

class UserService {
  /**
   * Set language preference for a user
   * Stores in both PostgreSQL (persistent) and Redis (cache)
   * 
   * @param userId - User identifier
   * @param language - Language code (en, es, fr, de, zh)
   * @returns Updated user preferences
   */
  async setLanguagePreference(userId: string, language: string): Promise<UserPreferences> {
    // Validate language
    const normalizedLang = this.validateLanguage(language);
    
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required and must be a string');
    }

    try {
      const pool = postgresClient.getPool();
      
      // Upsert user preferences in PostgreSQL
      const query = `
        INSERT INTO user_preferences.preferences (user_id, language, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          language = $2,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const result = await pool.query<UserPreferencesRow>(query, [userId, normalizedLang]);
      const row = result.rows[0];
      
      // Convert database row to UserPreferences
      const preferences: UserPreferences = {
        userId: row.user_id,
        language: row.language,
        theme: row.theme as 'light' | 'dark' | undefined,
        notificationsEnabled: row.notifications_enabled,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      };
      
      // Cache in Redis
      try {
        const cacheKey = this.getCacheKey(userId);
        const client = redisClient.getClient();
        await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(preferences));
        logger.debug(`Cached user preferences for ${userId}`);
      } catch (cacheError) {
        // Log but don't fail if cache fails
        const errorMessage = cacheError instanceof Error ? cacheError.message : 'Unknown error';
        logger.warn(`Failed to cache user preferences: ${errorMessage}`);
      }
      
      logger.info(`Set language preference for user ${userId}: ${normalizedLang}`);
      return preferences;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to set language preference for user ${userId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get language preference for a user
   * Checks Redis cache first, then PostgreSQL
   * 
   * @param userId - User identifier
   * @returns User preferences or null if not found
   */
  async getLanguagePreference(userId: string): Promise<string> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required and must be a string');
    }

    try {
      // Check Redis cache first
      try {
        const cacheKey = this.getCacheKey(userId);
        const client = redisClient.getClient();
        const cached = await client.get(cacheKey);
        
        if (cached) {
          const preferences: UserPreferences = JSON.parse(cached);
          logger.debug(`Cache hit for user preferences: ${userId}`);
          return preferences.language;
        }
      } catch (cacheError) {
        // Log but continue to database lookup
        const errorMessage = cacheError instanceof Error ? cacheError.message : 'Unknown error';
        logger.debug(`Cache miss for user preferences: ${errorMessage}`);
      }

      // Query PostgreSQL
      const pool = postgresClient.getPool();
      const query = `
        SELECT language 
        FROM user_preferences.preferences 
        WHERE user_id = $1
      `;
      
      const result = await pool.query<{ language: string }>(query, [userId]);
      
      if (result.rows.length === 0) {
        logger.debug(`No language preference found for user ${userId}, returning default`);
        return DEFAULT_LANGUAGE;
      }

      const language = result.rows[0].language;
      
      // Cache the result
      try {
        const cacheKey = this.getCacheKey(userId);
        const client = redisClient.getClient();
        // Get full preferences to cache
        const fullQuery = `SELECT * FROM user_preferences.preferences WHERE user_id = $1`;
        const fullResult = await pool.query<UserPreferencesRow>(fullQuery, [userId]);
        if (fullResult.rows.length > 0) {
          const row = fullResult.rows[0];
          const preferences: UserPreferences = {
            userId: row.user_id,
            language: row.language,
            theme: row.theme as 'light' | 'dark' | undefined,
            notificationsEnabled: row.notifications_enabled,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString()
          };
          await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(preferences));
        }
      } catch (cacheError) {
        // Log but don't fail
        const errorMessage = cacheError instanceof Error ? cacheError.message : 'Unknown error';
        logger.warn(`Failed to cache user preferences: ${errorMessage}`);
      }
      
      return language;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get language preference for user ${userId}: ${errorMessage}`);
      // Return default language on error
      return DEFAULT_LANGUAGE;
    }
  }

  /**
   * Get full user preferences
   * 
   * @param userId - User identifier
   * @returns User preferences or null if not found
   */
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required and must be a string');
    }

    try {
      // Check Redis cache first
      try {
        const cacheKey = this.getCacheKey(userId);
        const client = redisClient.getClient();
        const cached = await client.get(cacheKey);
        
        if (cached) {
          const preferences: UserPreferences = JSON.parse(cached);
          logger.debug(`Cache hit for user preferences: ${userId}`);
          return preferences;
        }
      } catch (cacheError) {
        // Log but continue to database lookup
        const errorMessage = cacheError instanceof Error ? cacheError.message : 'Unknown error';
        logger.debug(`Cache miss for user preferences: ${errorMessage}`);
      }

      // Query PostgreSQL
      const pool = postgresClient.getPool();
      const query = `
        SELECT * 
        FROM user_preferences.preferences 
        WHERE user_id = $1
      `;
      
      const result = await pool.query<UserPreferencesRow>(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const preferences: UserPreferences = {
        userId: row.user_id,
        language: row.language,
        theme: row.theme as 'light' | 'dark' | undefined,
        notificationsEnabled: row.notifications_enabled,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      };
      
      // Cache the result
      try {
        const cacheKey = this.getCacheKey(userId);
        const client = redisClient.getClient();
        await client.setEx(cacheKey, CACHE_TTL, JSON.stringify(preferences));
      } catch (cacheError) {
        // Log but don't fail
        const errorMessage = cacheError instanceof Error ? cacheError.message : 'Unknown error';
        logger.warn(`Failed to cache user preferences: ${errorMessage}`);
      }
      
      return preferences;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get user preferences for user ${userId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Validate and normalize language code
   */
  private validateLanguage(language: string): string {
    const normalized = language.toLowerCase().trim();
    
    if (SUPPORTED_LANGUAGES.includes(normalized as typeof SUPPORTED_LANGUAGES[number])) {
      return normalized;
    }

    logger.warn(`Invalid language code: ${language}, falling back to ${DEFAULT_LANGUAGE}`);
    return DEFAULT_LANGUAGE;
  }

  /**
   * Generate cache key for user preferences
   */
  private getCacheKey(userId: string): string {
    return `user:${userId}:preferences`;
  }
}

// Singleton instance
const userService = new UserService();
export default userService;

