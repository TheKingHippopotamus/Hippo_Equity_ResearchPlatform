// Translation service for UI strings
import { apiService } from './api';
import type { SupportedLanguage } from '../types/models';

class TranslationService {
  private currentLanguage: SupportedLanguage = 'en';
  private translations: Map<string, string> = new Map();
  private loadingPromises: Map<string, Promise<string>> = new Map();
  private readonly defaultTranslations: Record<string, string> = {
    'ui.competitors': 'Competitors',
    'ui.financialHealth': 'Financial Health',
    'ui.growth': 'Growth',
    'ui.profitability': 'Profitability',
    'ui.shareholderReturns': 'Shareholder Returns',
    'ui.valuation': 'Valuation',
    'ui.keyPoints': 'Key Points',
    'ui.summary': 'Summary',
    'ui.rating': 'Rating',
    'ui.industry': 'Industry',
    'ui.companyDescription': 'Company Description',
    'ui.financialAnalysis': 'Financial Analysis',
    'metrics.currentPrice': 'Current Price',
    'metrics.priceChange': 'Change',
    'metrics.priceChangePercent': 'Change %',
    'metrics.previousClose': 'Previous Close',
    'sentiment.veryNegative': 'Very Negative',
    'sentiment.negative': 'Negative',
    'sentiment.neutral': 'Neutral',
    'sentiment.positive': 'Positive',
    'sentiment.veryPositive': 'Very Positive'
  };

  async setLanguage(language: SupportedLanguage): Promise<void> {
    this.currentLanguage = language;
    this.translations.clear();
    this.loadingPromises.clear();
    
    // Store in localStorage
    localStorage.setItem('language', language);
  }

  getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  async translate(key: string, language?: SupportedLanguage): Promise<string> {
    const lang = language || this.currentLanguage;
    
    // Return default label for English
    if (lang === 'en') {
      return this.defaultTranslations[key] || this.humanizeKey(key);
    }

    // Check cache first
    const cacheKey = `${lang}:${key}`;
    if (this.translations.has(cacheKey)) {
      return this.translations.get(cacheKey)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // Load translation
    const promise = apiService.translate(key, lang)
      .then((translation) => {
        const resolved = translation && translation !== key
          ? translation
          : this.defaultTranslations[key] || this.humanizeKey(key);
        this.translations.set(cacheKey, resolved);
        return resolved;
      })
      .catch((error) => {
        console.warn(`Translation failed for key '${key}':`, error);
        return this.defaultTranslations[key] || this.humanizeKey(key); // Fallback
      })
      .finally(() => {
        this.loadingPromises.delete(cacheKey);
      });

    this.loadingPromises.set(cacheKey, promise);
    return promise;
  }

  // Synchronous translate (uses cached translations only)
  translateSync(key: string, language?: SupportedLanguage): string {
    const lang = language || this.currentLanguage;
    
    if (lang === 'en') {
      return this.defaultTranslations[key] || this.humanizeKey(key);
    }

    const cacheKey = `${lang}:${key}`;
    return this.translations.get(cacheKey) || this.defaultTranslations[key] || this.humanizeKey(key);
  }

  async loadInitialLanguage(): Promise<void> {
    // Load from localStorage or default to 'en'
    const savedLanguage = localStorage.getItem('language') as SupportedLanguage;
    if (savedLanguage && ['en', 'es', 'fr', 'de', 'zh', 'he'].includes(savedLanguage)) {
      await this.setLanguage(savedLanguage);
    }
  }

  private humanizeKey(key: string): string {
    const last = key.split('.').pop() || key;
    const spaced = last.replace(/([a-z])([A-Z])/g, '$1 $2');
    return spaced
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }
}

export const translationService = new TranslationService();
export default translationService;
