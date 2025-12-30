import React, { useState, useEffect } from 'react';
import { translationService } from '../../services/translation';
import { apiService } from '../../services/api';
import type { SupportedLanguage } from '../../types/models';
import './LanguageSelector.css';

interface LanguageSelectorProps {
  currentLanguage: SupportedLanguage;
  onLanguageChange: (language: SupportedLanguage) => void;
  userId?: string;
}

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  zh: '中文',
  he: 'עברית',
};

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onLanguageChange,
  userId,
}) => {
  const [availableLanguages, setAvailableLanguages] = useState<SupportedLanguage[]>(['en']);
  const [isOpen, setIsOpen] = useState(false);
  const [selectLabel, setSelectLabel] = useState('Select Language');

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const languages = await apiService.getAvailableLanguages();
        setAvailableLanguages(languages as SupportedLanguage[]);
      } catch (error) {
        console.error('Failed to load languages:', error);
      }
    };
    loadLanguages();
  }, []);

  useEffect(() => {
    const loadTranslation = async () => {
      const label = await translationService.translate('ui.selectLanguage', currentLanguage);
      setSelectLabel(label);
    };
    loadTranslation();
  }, [currentLanguage]);

  const handleLanguageChange = async (language: SupportedLanguage) => {
    if (language === currentLanguage) {
      setIsOpen(false);
      return;
    }

    // Update local state immediately for instant UI update
    onLanguageChange(language);
    setIsOpen(false);

    // Persist to backend if userId provided
    if (userId) {
      try {
        await apiService.setLanguagePreference(userId, language);
      } catch (error) {
        console.error('Failed to save language preference:', error);
        // Optionally revert on error
      }
    }

    // Update translation service
    await translationService.setLanguage(language);
  };

  return (
    <div className="language-selector">
      <button
        className="language-selector-button button button-secondary"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="language-selector-current">
          {LANGUAGE_NAMES[currentLanguage]} ({currentLanguage.toUpperCase()})
        </span>
        <span className="language-selector-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="language-selector-backdrop"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="language-selector-dropdown" role="listbox">
            <div className="language-selector-label">{selectLabel}</div>
            {availableLanguages.map((lang) => (
              <button
                key={lang}
                className={`language-selector-option ${
                  lang === currentLanguage ? 'active' : ''
                }`}
                onClick={() => handleLanguageChange(lang)}
                role="option"
                aria-selected={lang === currentLanguage}
              >
                <span className="language-selector-option-name">
                  {LANGUAGE_NAMES[lang]}
                </span>
                <span className="language-selector-option-code">{lang.toUpperCase()}</span>
                {lang === currentLanguage && (
                  <span className="language-selector-check">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSelector;

