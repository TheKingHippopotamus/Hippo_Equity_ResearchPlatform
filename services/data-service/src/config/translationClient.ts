import axios, { AxiosError, AxiosResponse } from 'axios';
import logger from '../utils/logger.js';

interface TranslationResponse {
  key?: string;
  language?: string;
  translation?: string;
  original?: unknown;
  translated?: unknown;
}

class TranslationClient {
  private readonly TRANSLATION_SERVICE_URL: string;
  private readonly MAX_RETRIES = 2; // Fewer retries for translation (non-critical)
  private readonly RETRY_DELAYS = [500, 1000]; // Faster retries

  constructor() {
    this.TRANSLATION_SERVICE_URL = 
      process.env.TRANSLATION_SERVICE_URL || 'http://translation-service:3004';
  }

  /**
   * Translate a UI string key
   * @param key Translation key (e.g., 'ui.dashboard')
   * @param language Target language code
   * @returns Translated string or key if translation fails
   */
  async translate(key: string, language: string = 'en'): Promise<string> {
    // Return key immediately if English (no translation needed)
    if (language === 'en') {
      return key;
    }

    try {
      const response = await this.translateWithRetry<TranslationResponse>(
        `${this.TRANSLATION_SERVICE_URL}/translate`,
        { key, language }
      );

      return response.translation || key;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Translation failed for key '${key}' in language '${language}': ${errorMessage}`);
      // Return key on failure (graceful degradation)
      return key;
    }
  }

  /**
   * Translate content (news articles, financial analysis, etc.)
   * @param content Content to translate
   * @param language Target language code
   * @returns Translated content or original if translation fails
   */
  async translateContent(content: unknown, language: string = 'en'): Promise<unknown> {
    // Return content immediately if English (no translation needed)
    if (language === 'en') {
      return content;
    }

    try {
      const response = await this.translateWithRetry<TranslationResponse>(
        `${this.TRANSLATION_SERVICE_URL}/translate-content`,
        { content, language }
      );

      return response.translated || content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Content translation failed for language '${language}': ${errorMessage}`);
      // Return original content on failure (graceful degradation)
      return content;
    }
  }

  /**
   * Translate with retry logic
   */
  private async translateWithRetry<T>(
    url: string,
    data: Record<string, unknown>
  ): Promise<T> {
    let lastError: Error | AxiosError | null = null;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const response: AxiosResponse<T> = await axios.post(url, data, {
          timeout: 5000, // 5 second timeout for translation
          headers: {
            'Content-Type': 'application/json'
          }
        });

        return response.data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        const isAxiosError = error instanceof AxiosError;
        const statusCode = isAxiosError ? error.response?.status : undefined;
        
        // Don't retry on 4xx errors (client errors)
        if (statusCode && statusCode >= 400 && statusCode < 500) {
          throw error;
        }

        // Retry with backoff
        if (attempt < this.MAX_RETRIES - 1) {
          const delay = this.RETRY_DELAYS[attempt];
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Translation request failed after all retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const translationClient = new TranslationClient();
export default translationClient;

