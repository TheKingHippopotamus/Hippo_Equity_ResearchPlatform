import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger.js';

class TranslationClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.TRANSLATION_SERVICE_URL || 'http://translation-service:3004';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Translation API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error(`Translation API Request Error: ${error.message}`);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        logger.error(`Translation API Response Error: ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Translate a UI string key
   * @param key Translation key (e.g., 'ui.dashboard')
   * @param language Target language code
   * @returns Translated string
   */
  async translate(key: string, language: string = 'en'): Promise<string> {
    try {
      const response = await this.client.post('/translate', {
        key,
        language,
      });
      return response.data.translation || key;
    } catch (error) {
      logger.warn(`Translation failed for key '${key}' in language '${language}', returning key`);
      return key;
    }
  }

  /**
   * Translate content (news articles, financial analysis, etc.)
   * @param content Content to translate
   * @param language Target language code
   * @returns Translated content
   */
  async translateContent(content: unknown, language: string = 'en'): Promise<unknown> {
    try {
      const response = await this.client.post('/translate-content', {
        content,
        language,
      });
      return response.data.translatedContent || content;
    } catch (error) {
      logger.warn(`Content translation failed for language '${language}', returning original content`);
      return content;
    }
  }

  /**
   * Get sentiment label in specified language
   * @param sentiment Sentiment score (-2 to 4)
   * @param language Target language code
   * @returns Sentiment label
   */
  async getSentimentLabel(sentiment: number, language: string = 'en'): Promise<string> {
    try {
      const response = await this.client.post('/sentiment', {
        sentiment,
        language,
      });
      return response.data.label || 'neutral';
    } catch (error) {
      logger.warn(`Sentiment label translation failed, returning default`);
      return 'neutral';
    }
  }
}

// Singleton instance
const translationClient = new TranslationClient();

export default translationClient;
