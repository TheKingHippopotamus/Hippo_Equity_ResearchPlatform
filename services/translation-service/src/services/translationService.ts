import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supported languages
export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'zh', 'he'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Language pack type
interface LanguagePack {
  ui: Record<string, string>;
  metrics: Record<string, string>;
  sentiment: Record<string, string>;
  [key: string]: Record<string, string>;
}

class TranslationService {
  private languagePacks: Map<string, LanguagePack> = new Map();
  private defaultLanguage: SupportedLanguage = 'en';

  constructor() {
    this.loadLanguagePacks();
  }

  /**
   * Load all language packs from locale files
   */
  private loadLanguagePacks(): void {
    for (const lang of SUPPORTED_LANGUAGES) {
      try {
        const filePath = join(__dirname, '../locales', `${lang}.json`);
        const fileContent = readFileSync(filePath, 'utf-8');
        const languagePack: LanguagePack = JSON.parse(fileContent);
        this.languagePacks.set(lang, languagePack);
        logger.info(`Loaded language pack: ${lang}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to load language pack for ${lang}: ${errorMessage}`);
        // If default language fails to load, throw error
        if (lang === this.defaultLanguage) {
          throw new Error(`Failed to load default language pack (${lang})`);
        }
      }
    }
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): string[] {
    return Array.from(this.languagePacks.keys());
  }

  /**
   * Translate a UI string key to the specified language
   * Falls back to English if translation not found
   * 
   * @param key - Translation key (e.g., 'ui.dashboard' or 'metrics.currentPrice')
   * @param language - Target language code (default: 'en')
   * @returns Translated string or the key if translation not found
   */
  translate(key: string, language: string = this.defaultLanguage): string {
    // Validate language
    const lang = this.validateLanguage(language);
    
    // Get language pack
    const pack = this.languagePacks.get(lang);
    if (!pack) {
      logger.warn(`Language pack not found for ${lang}, falling back to English`);
      return this.translate(key, this.defaultLanguage);
    }

    // Navigate through nested keys (e.g., 'ui.dashboard')
    const keys = key.split('.');
    let value: unknown = pack;

    for (const k of keys) {
      if (typeof value === 'object' && value !== null && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        // Fallback to English if key not found
        if (lang !== this.defaultLanguage) {
          logger.debug(`Translation key '${key}' not found in ${lang}, falling back to English`);
          return this.translate(key, this.defaultLanguage);
        }
        // If even English doesn't have it, return the key
        logger.warn(`Translation key '${key}' not found in any language pack`);
        return key;
      }
    }

    if (typeof value === 'string') {
      return value;
    }

    // Fallback to English if value is not a string
    if (lang !== this.defaultLanguage) {
      return this.translate(key, this.defaultLanguage);
    }

    return key;
  }

  /**
   * Translate dynamic content (news articles, financial analysis, etc.)
   * This is a placeholder for actual translation - in production, this would
   * use a translation API or service
   * 
   * @param content - Content object to translate
   * @param language - Target language code
   * @returns Translated content object
   */
  async translateContent(content: unknown, language: string = this.defaultLanguage): Promise<unknown> {
    const lang = this.validateLanguage(language);

    // If content is a string, return as-is (would use translation API in production)
    if (typeof content === 'string') {
      // In a real implementation, this would call a translation API
      // For now, we return the content as-is with a note that translation is needed
      logger.debug(`Content translation requested for language ${lang} (not implemented yet)`);
      return content;
    }

    // If content is an object, recursively translate string values
    if (typeof content === 'object' && content !== null) {
      const translated: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(content)) {
        if (typeof value === 'string') {
          // For now, return as-is (would translate in production)
          translated[key] = value;
        } else if (Array.isArray(value)) {
          translated[key] = await Promise.all(
            value.map(item => this.translateContent(item, lang))
          );
        } else if (typeof value === 'object' && value !== null) {
          translated[key] = await this.translateContent(value, lang);
        } else {
          translated[key] = value;
        }
      }
      
      return translated;
    }

    // For arrays, translate each element
    if (Array.isArray(content)) {
      return Promise.all(
        content.map(item => this.translateContent(item, lang))
      );
    }

    return content;
  }

  /**
   * Validate and normalize language code
   * Falls back to default language if invalid
   */
  private validateLanguage(language: string): SupportedLanguage {
    const normalized = language.toLowerCase().trim();
    
    if (SUPPORTED_LANGUAGES.includes(normalized as SupportedLanguage)) {
      return normalized as SupportedLanguage;
    }

    logger.warn(`Invalid language code: ${language}, falling back to ${this.defaultLanguage}`);
    return this.defaultLanguage;
  }

  /**
   * Load a specific language pack (for dynamic loading)
   */
  async loadLanguagePack(language: string): Promise<void> {
    const lang = this.validateLanguage(language);
    
    if (this.languagePacks.has(lang)) {
      logger.debug(`Language pack ${lang} already loaded`);
      return;
    }

    try {
      const filePath = join(__dirname, '../locales', `${lang}.json`);
      const fileContent = readFileSync(filePath, 'utf-8');
      const languagePack: LanguagePack = JSON.parse(fileContent);
      this.languagePacks.set(lang, languagePack);
      logger.info(`Loaded language pack: ${lang}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to load language pack for ${lang}: ${errorMessage}`);
      throw new Error(`Failed to load language pack for ${lang}: ${errorMessage}`);
    }
  }

  /**
   * Get sentiment label in specified language
   */
  getSentimentLabel(sentiment: number, language: string = this.defaultLanguage): string {
    const lang = this.validateLanguage(language);
    
    // Map sentiment score (-2 to 4) to labels
    let sentimentKey: string;
    if (sentiment <= -1) {
      sentimentKey = 'veryNegative';
    } else if (sentiment === 0) {
      sentimentKey = 'negative';
    } else if (sentiment === 1) {
      sentimentKey = 'neutral';
    } else if (sentiment === 2 || sentiment === 3) {
      sentimentKey = 'positive';
    } else {
      sentimentKey = 'veryPositive';
    }

    return this.translate(`sentiment.${sentimentKey}`, lang);
  }
}

// Singleton instance
const translationService = new TranslationService();
export default translationService;

