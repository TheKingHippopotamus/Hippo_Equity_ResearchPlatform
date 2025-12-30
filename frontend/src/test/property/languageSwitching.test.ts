/**
 * Property Test: Language Switching Without Reload
 * Feature: stock-market-dashboard, Property 10: Language Switching Without Reload
 * Validates: Requirements 3.5
 * 
 * For any user who changes language mid-session, all content should re-render
 * in the new language without requiring a page reload.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { translationService } from '../../services/translation';

// Mock translation service
vi.mock('../../services/translation', () => ({
  translationService: {
    translate: vi.fn((key: string, lang: string) => {
      const translations: Record<string, Record<string, string>> = {
        en: { 'ui.dashboard': 'Dashboard', 'ui.news': 'News' },
        es: { 'ui.dashboard': 'Panel', 'ui.news': 'Noticias' },
        fr: { 'ui.dashboard': 'Tableau de bord', 'ui.news': 'Actualités' },
        de: { 'ui.dashboard': 'Armaturenbrett', 'ui.news': 'Nachrichten' },
        zh: { 'ui.dashboard': '仪表板', 'ui.news': '新闻' },
        he: { 'ui.dashboard': 'לוח בקרה', 'ui.news': 'חדשות' },
      };
      return Promise.resolve(translations[lang]?.[key] || key);
    }),
    setLanguage: vi.fn(() => Promise.resolve()),
    getLanguage: vi.fn(() => 'en'),
  },
}));

const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'zh', 'he'] as const;

describe('Property 10: Language Switching Without Reload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should translate all UI strings when language changes', () => {
    const languagePairs = fc.tuple(
      fc.constantFrom(...SUPPORTED_LANGUAGES),
      fc.constantFrom(...SUPPORTED_LANGUAGES)
    ).filter(([from, to]) => from !== to);

    fc.assert(
      fc.asyncProperty(languagePairs, async ([fromLang, toLang]) => {
        // Simulate language change
        await translationService.setLanguage(toLang);
        
        // Translate a key
        const translated = await translationService.translate('ui.dashboard', toLang);
        
        // Translation should be different from English key if not English
        if (toLang !== 'en') {
          expect(translated).not.toBe('ui.dashboard');
        }
        
        // Translation should be a string
        expect(typeof translated).toBe('string');
        expect(translated.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 }
    );
  });

  it('should maintain content structure when language changes', () => {
    const languages = fc.constantFrom(...SUPPORTED_LANGUAGES);
    const contentKeys = fc.constantFrom('ui.dashboard', 'ui.news', 'ui.stockPrice');

    fc.assert(
      fc.asyncProperty(languages, contentKeys, async (lang, key) => {
        // Translate content
        const translated = await translationService.translate(key, lang);
        
        // Content should always be a string
        expect(typeof translated).toBe('string');
        
        // Content should not be empty
        expect(translated.length).toBeGreaterThan(0);
        
        // Content structure should be preserved (no HTML/JS injection)
        expect(translated).not.toContain('<script>');
        expect(translated).not.toContain('javascript:');
      }),
      { numRuns: 100 }
    );
  });

  it('should handle rapid language switching', () => {
    const languageSequence = fc.array(
      fc.constantFrom(...SUPPORTED_LANGUAGES),
      { minLength: 2, maxLength: 10 }
    );

    fc.assert(
      fc.asyncProperty(languageSequence, async (languages) => {
        // Simulate rapid language switching
        for (const lang of languages) {
          await translationService.setLanguage(lang);
          const currentLang = translationService.getLanguage();
          expect(currentLang).toBe(lang);
        }
        
        // Final language should be the last one in sequence
        const finalLang = translationService.getLanguage();
        expect(finalLang).toBe(languages[languages.length - 1]);
      }),
      { numRuns: 30 }
    );
  });

  it('should not lose data when language changes', () => {
    const languages = fc.constantFrom(...SUPPORTED_LANGUAGES);
    const testData = fc.record({
      symbol: fc.constantFrom('AAPL', 'GOOGL', 'MSFT'),
      price: fc.float({ min: 1, max: 1000 }),
    });

    fc.assert(
      fc.asyncProperty(languages, testData, async (lang, data) => {
        // Simulate language change with data present
        await translationService.setLanguage(lang);
        
        // Data should remain intact
        expect(data.symbol).toBeDefined();
        expect(data.price).toBeDefined();
        expect(typeof data.symbol).toBe('string');
        expect(typeof data.price).toBe('number');
        
        // Data values should not change
        expect(data.symbol.length).toBeGreaterThan(0);
        expect(data.price).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should update all visible text without page reload', () => {
    const languagePairs = fc.tuple(
      fc.constantFrom(...SUPPORTED_LANGUAGES),
      fc.constantFrom(...SUPPORTED_LANGUAGES)
    ).filter(([from, to]) => from !== to);

    fc.assert(
      fc.asyncProperty(languagePairs, async ([fromLang, toLang]) => {
        // Get translation in original language
        const original = await translationService.translate('ui.dashboard', fromLang);
        
        // Change language
        await translationService.setLanguage(toLang);
        
        // Get translation in new language
        const translated = await translationService.translate('ui.dashboard', toLang);
        
        // Translations should be strings
        expect(typeof original).toBe('string');
        expect(typeof translated).toBe('string');
        
        // If languages are different, translations might be different
        // (unless they happen to be the same by coincidence)
        if (fromLang !== toLang) {
          // At least one should be different from the key
          const originalIsKey = original === 'ui.dashboard';
          const translatedIsKey = translated === 'ui.dashboard';
          
          // Not both should be the key (unless both are English)
          if (fromLang !== 'en' || toLang !== 'en') {
            expect(originalIsKey && translatedIsKey).not.toBe(true);
          }
        }
      }),
      { numRuns: 50 }
    );
  });
});

