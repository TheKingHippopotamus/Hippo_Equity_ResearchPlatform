import React, { useState } from 'react';
import type { FinancialAnalysis } from '../../types/models';
import { translationService } from '../../services/translation';
import type { SupportedLanguage } from '../../types/models';
import './FinancialMetricsPanel.css';

interface FinancialMetricsPanelProps {
  analysis: FinancialAnalysis;
  language?: SupportedLanguage;
}

interface SectionData {
  key: string;
  title: string;
  keyPoints: string[];
  rating?: number;
  summary: string;
}

export const FinancialMetricsPanel: React.FC<FinancialMetricsPanelProps> = ({
  analysis,
  language = 'en',
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [translations, setTranslations] = useState<Record<string, string>>({});

  React.useEffect(() => {
    const loadTranslations = async () => {
      const keys = [
        'ui.competitors',
        'ui.financialHealth',
        'ui.growth',
        'ui.profitability',
        'ui.shareholderReturns',
        'ui.valuation',
        'ui.keyPoints',
        'ui.summary',
        'ui.rating',
        'ui.industry',
        'ui.companyDescription',
      ];

      const translated = await Promise.all(
        keys.map((key) => translationService.translate(key, language))
      );

      const translationMap: Record<string, string> = {};
      keys.forEach((key, index) => {
        translationMap[key] = translated[index];
      });

      setTranslations(translationMap);
    };
    loadTranslations();
  }, [language]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getRatingColor = (rating: number): string => {
    if (rating <= 1) return 'rating-1';
    if (rating === 2) return 'rating-2';
    if (rating === 3) return 'rating-3';
    if (rating === 4) return 'rating-4';
    return 'rating-5';
  };

  const sections: SectionData[] = [
    {
      key: 'competitors',
      title: translations['ui.competitors'] || 'Competitors',
      keyPoints: analysis.competitors.keyPoints,
      rating: analysis.competitors.rating,
      summary: analysis.competitors.summary,
    },
    {
      key: 'financialHealth',
      title: translations['ui.financialHealth'] || 'Financial Health',
      keyPoints: analysis.financialHealth.keyPoints,
      rating: analysis.financialHealth.rating,
      summary: analysis.financialHealth.summary,
    },
    {
      key: 'growth',
      title: translations['ui.growth'] || 'Growth',
      keyPoints: analysis.growth.keyPoints,
      rating: analysis.growth.rating,
      summary: analysis.growth.summary,
    },
    {
      key: 'profitability',
      title: translations['ui.profitability'] || 'Profitability',
      keyPoints: analysis.profitability.keyPoints,
      rating: analysis.profitability.rating,
      summary: analysis.profitability.summary,
    },
    {
      key: 'shareholderReturns',
      title: translations['ui.shareholderReturns'] || 'Shareholder Returns',
      keyPoints: analysis.shareholder_returns.keyPoints,
      summary: analysis.shareholder_returns.summary,
    },
    {
      key: 'valuation',
      title: translations['ui.valuation'] || 'Valuation',
      keyPoints: analysis.valuation.keyPoints,
      rating: analysis.valuation.rating,
      summary: analysis.valuation.summary,
    },
  ];

  return (
    <div className="financial-metrics-panel">
      <div className="metrics-panel-header">
        <h2 className="metrics-panel-title">
          {translations['ui.financialAnalysis'] || 'Financial Analysis'}
        </h2>
      </div>

      {analysis.companyDescription && (
        <div className="metrics-panel-description">
          <h3>{translations['ui.companyDescription'] || 'Company Description'}</h3>
          <p>{analysis.companyDescription}</p>
        </div>
      )}

      {analysis.competitors.industry && (
        <div className="metrics-panel-industry">
          <strong>{translations['ui.industry'] || 'Industry'}:</strong>{' '}
          {analysis.competitors.industry}
        </div>
      )}

      <div className="metrics-sections">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.key);

          return (
            <div key={section.key} className="metric-section card">
              <div
                className="metric-section-header"
                onClick={() => toggleSection(section.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSection(section.key);
                  }
                }}
              >
                <h3 className="metric-section-title">{section.title}</h3>
                {section.rating !== undefined && (
                  <div className={`metric-rating ${getRatingColor(section.rating)}`}>
                    {section.rating}/5
                  </div>
                )}
                <span className="metric-section-toggle">
                  {isExpanded ? '−' : '+'}
                </span>
              </div>

              {isExpanded && (
                <div className="metric-section-content">
                  {section.summary && (
                    <div className="metric-summary">
                      <h4>{translations['ui.summary'] || 'Summary'}</h4>
                      <p>{section.summary}</p>
                    </div>
                  )}

                  {section.keyPoints.length > 0 && (
                    <div className="metric-key-points">
                      <h4>{translations['ui.keyPoints'] || 'Key Points'}</h4>
                      <ul>
                        {section.keyPoints.map((point, index) => (
                          <li key={index}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FinancialMetricsPanel;

