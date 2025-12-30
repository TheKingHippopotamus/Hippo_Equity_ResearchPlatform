import React, { useMemo, useState } from 'react';
import { PDFReportButton } from '../PDFReportButton/PDFReportButton';
import type {
  ReportAnalysisSectionId,
  ReportChartType,
  ReportConfig,
  ReportDesignConfig,
  ReportNewsMode,
  ReportPreset,
  ReportSectionConfig,
  ReportSectionId,
  SupportedLanguage,
} from '../../types/models';
import './PDFReportBuilder.css';

interface PDFReportBuilderProps {
  stockSymbol: string;
  language?: SupportedLanguage;
  userId?: string;
}

const SECTION_METADATA: Record<ReportSectionId, { title: string; description: string }> = {
  cover: {
    title: 'Cover Page',
    description: 'Title, symbol, report date, and branding.',
  },
  stockSummary: {
    title: 'Stock Summary',
    description: 'Price, daily change, and key trading stats.',
  },
  companyOverview: {
    title: 'Company Overview',
    description: 'Short narrative from the analysis summary.',
  },
  financialAnalysis: {
    title: 'Financial Analysis',
    description: 'Deep dive by category with ratings and key points.',
  },
  news: {
    title: 'News Highlights',
    description: 'Recent articles with sentiment and summaries.',
  },
  priceChart: {
    title: 'Price Chart',
    description: 'Visual price history in a chart style you choose.',
  },
  appendix: {
    title: 'Appendix',
    description: 'Sources and disclaimer notes.',
  },
};

const ANALYSIS_SECTIONS: Array<{ id: ReportAnalysisSectionId; label: string }> = [
  { id: 'competitors', label: 'Competitors' },
  { id: 'financialHealth', label: 'Financial Health' },
  { id: 'growth', label: 'Growth' },
  { id: 'profitability', label: 'Profitability' },
  { id: 'shareholderReturns', label: 'Shareholder Returns' },
  { id: 'valuation', label: 'Valuation' },
];

const PRESET_CONFIGS: Record<ReportPreset, ReportDesignConfig> = {
  classic: {
    preset: 'classic',
    brandColor: '#1a73e8',
    accentColor: '#e8f0fe',
    fontFamily: 'sans',
    density: 'comfortable',
    header: { showCompanyName: true },
    footer: { showPageNumbers: true, disclaimer: '' },
    cover: { subtitle: 'Equity Research Report', showLogo: true, showBadge: true },
    chart: { showGrid: true, lineWidth: 2 },
  },
  investor: {
    preset: 'investor',
    brandColor: '#0f766e',
    accentColor: '#ecfeff',
    fontFamily: 'serif',
    density: 'compact',
    header: { showCompanyName: true },
    footer: { showPageNumbers: true, disclaimer: '' },
    cover: { subtitle: 'Investor Brief', showLogo: true, showBadge: true },
    chart: { showGrid: false, lineWidth: 2 },
  },
  minimal: {
    preset: 'minimal',
    brandColor: '#111827',
    accentColor: '#f3f4f6',
    fontFamily: 'sans',
    density: 'compact',
    header: { showCompanyName: false },
    footer: { showPageNumbers: true, disclaimer: '' },
    cover: { subtitle: 'Minimal Snapshot', showLogo: false, showBadge: true },
    chart: { showGrid: true, lineWidth: 1.5 },
  },
  executive: {
    preset: 'executive',
    brandColor: '#b45309',
    accentColor: '#fef3c7',
    fontFamily: 'serif',
    density: 'comfortable',
    header: { showCompanyName: true },
    footer: { showPageNumbers: true, disclaimer: '' },
    cover: { subtitle: 'Executive Summary', showLogo: true, showBadge: true },
    chart: { showGrid: true, lineWidth: 2.5 },
  },
};

const DEFAULT_SECTIONS: ReportSectionConfig[] = [
  { id: 'cover', enabled: true, order: 0 },
  { id: 'stockSummary', enabled: true, order: 1 },
  { id: 'companyOverview', enabled: true, order: 2 },
  {
    id: 'financialAnalysis',
    enabled: true,
    order: 3,
    options: { analysisSections: ANALYSIS_SECTIONS.map((section) => section.id) },
  },
  {
    id: 'news',
    enabled: true,
    order: 4,
    options: { newsCount: 5, newsMode: 'summary' },
  },
  {
    id: 'priceChart',
    enabled: true,
    order: 5,
    options: { chartType: 'line' },
  },
  {
    id: 'appendix',
    enabled: false,
    order: 6,
    options: { appendixNotes: 'Sources: Market data, filings, and public news feeds.' },
  },
];

export const PDFReportBuilder: React.FC<PDFReportBuilderProps> = ({
  stockSymbol,
  language = 'en',
  userId = 'anonymous',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'design' | 'review'>('content');
  const [sections, setSections] = useState<ReportSectionConfig[]>(DEFAULT_SECTIONS);
  const [design, setDesign] = useState<ReportDesignConfig>(PRESET_CONFIGS.classic);

  const orderedSections = useMemo(
    () => [...sections].sort((a, b) => a.order - b.order),
    [sections]
  );

  const enabledSections = useMemo(
    () => orderedSections.filter((section) => section.enabled),
    [orderedSections]
  );

  const reportConfig: ReportConfig = useMemo(
    () => ({
      sections: orderedSections,
      design,
    }),
    [orderedSections, design]
  );

  const handleSectionToggle = (id: ReportSectionId, enabled: boolean) => {
    setSections((prev) =>
      prev.map((section) => (section.id === id ? { ...section, enabled } : section))
    );
  };

  const handleMoveSection = (id: ReportSectionId, direction: number) => {
    setSections((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((section) => section.id === id);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= sorted.length) {
        return prev;
      }
      const next = [...sorted];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next.map((section, idx) => ({ ...section, order: idx }));
    });
  };

  const updateSectionOptions = (
    id: ReportSectionId,
    nextOptions: ReportSectionConfig['options']
  ) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id
          ? { ...section, options: { ...section.options, ...nextOptions } }
          : section
      )
    );
  };

  const handlePresetChange = (preset: ReportPreset) => {
    setDesign(PRESET_CONFIGS[preset]);
  };

  const updateDesign = (next: Partial<ReportDesignConfig>) => {
    setDesign((prev) => ({
      ...prev,
      ...next,
      header: { ...prev.header, ...next.header },
      footer: { ...prev.footer, ...next.footer },
      cover: { ...prev.cover, ...next.cover },
      chart: { ...prev.chart, ...next.chart },
    }));
  };

  const estimatePages = () => {
    let pages = 0;
    enabledSections.forEach((section) => {
      switch (section.id) {
        case 'cover':
          pages += 1;
          break;
        case 'stockSummary':
          pages += 1;
          break;
        case 'companyOverview':
          pages += 1;
          break;
        case 'financialAnalysis':
          pages += 2.5;
          break;
        case 'news': {
          const count = section.options?.newsCount || 5;
          pages += Math.ceil(count / 3);
          break;
        }
        case 'priceChart':
          pages += 1;
          break;
        case 'appendix':
          pages += 1;
          break;
        default:
          pages += 1;
      }
    });
    return Math.max(1, Math.round(pages));
  };

  const hasValidSelection = enabledSections.length > 0;
  const estimatedPages = estimatePages();

  return (
    <div className="pdf-builder">
      <div className="pdf-builder-actions">
        <PDFReportButton stockSymbol={stockSymbol} language={language} userId={userId} />
        <button
          type="button"
          className="button button-secondary pdf-builder-open"
          onClick={() => setIsOpen(true)}
        >
          Customize PDF
        </button>
      </div>

      {isOpen && (
        <div className="pdf-builder-modal-backdrop" role="presentation">
          <div className="pdf-builder-modal" role="dialog" aria-modal="true">
            <header className="pdf-builder-modal-header">
              <div>
                <p className="pdf-builder-kicker">PDF Builder</p>
                <h2>Create a report that fits your story</h2>
              </div>
              <button
                type="button"
                className="button button-secondary pdf-builder-close"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </header>

            <div className="pdf-builder-tabs">
              <button
                type="button"
                className={`pdf-builder-tab ${activeTab === 'content' ? 'active' : ''}`}
                onClick={() => setActiveTab('content')}
              >
                Content
              </button>
              <button
                type="button"
                className={`pdf-builder-tab ${activeTab === 'design' ? 'active' : ''}`}
                onClick={() => setActiveTab('design')}
              >
                Design
              </button>
              <button
                type="button"
                className={`pdf-builder-tab ${activeTab === 'review' ? 'active' : ''}`}
                onClick={() => setActiveTab('review')}
              >
                Review
              </button>
            </div>

            <div className="pdf-builder-content">
              {activeTab === 'content' && (
                <div className="pdf-builder-panel">
                  {orderedSections.map((section) => (
                    <div key={section.id} className="pdf-builder-section card">
                      <div className="pdf-builder-section-header">
                        <label className="pdf-builder-section-toggle">
                          <input
                            type="checkbox"
                            checked={section.enabled}
                            onChange={(event) =>
                              handleSectionToggle(section.id, event.target.checked)
                            }
                          />
                          <span className="pdf-builder-section-title">
                            {SECTION_METADATA[section.id].title}
                          </span>
                        </label>
                        <div className="pdf-builder-section-actions">
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => handleMoveSection(section.id, -1)}
                          >
                            Move Up
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => handleMoveSection(section.id, 1)}
                          >
                            Move Down
                          </button>
                        </div>
                      </div>
                      <p className="pdf-builder-section-description">
                        {SECTION_METADATA[section.id].description}
                      </p>

                      {section.enabled && section.id === 'financialAnalysis' && (
                        <div className="pdf-builder-options">
                          <p className="pdf-builder-option-title">Analysis sections</p>
                          <div className="pdf-builder-grid">
                            {ANALYSIS_SECTIONS.map((analysis) => (
                              <label key={analysis.id} className="pdf-builder-checkbox">
                                <input
                                  type="checkbox"
                                  checked={
                                    section.options?.analysisSections?.includes(analysis.id) ?? false
                                  }
                                  onChange={(event) => {
                                    const current = section.options?.analysisSections || [];
                                    const next = event.target.checked
                                      ? [...current, analysis.id]
                                      : current.filter((id) => id !== analysis.id);
                                    updateSectionOptions(section.id, { analysisSections: next });
                                  }}
                                />
                                <span>{analysis.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {section.enabled && section.id === 'news' && (
                        <div className="pdf-builder-options">
                          <div className="pdf-builder-option-row">
                            <label>
                              Articles
                              <select
                                value={section.options?.newsCount || 5}
                                onChange={(event) =>
                                  updateSectionOptions(section.id, {
                                    newsCount: Number(event.target.value),
                                  })
                                }
                              >
                                {[3, 5, 8, 10].map((count) => (
                                  <option key={count} value={count}>
                                    {count}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Mode
                              <select
                                value={(section.options?.newsMode || 'summary') as ReportNewsMode}
                                onChange={(event) =>
                                  updateSectionOptions(section.id, {
                                    newsMode: event.target.value as ReportNewsMode,
                                  })
                                }
                              >
                                <option value="summary">Summary</option>
                                <option value="full">Full</option>
                              </select>
                            </label>
                          </div>
                        </div>
                      )}

                      {section.enabled && section.id === 'priceChart' && (
                        <div className="pdf-builder-options">
                          <label>
                            Chart type
                            <select
                              value={(section.options?.chartType || 'line') as ReportChartType}
                              onChange={(event) =>
                                updateSectionOptions(section.id, {
                                  chartType: event.target.value as ReportChartType,
                                })
                              }
                            >
                              <option value="line">Line</option>
                              <option value="area">Area</option>
                              <option value="bar">Bar</option>
                            </select>
                          </label>
                        </div>
                      )}

                      {section.enabled && section.id === 'appendix' && (
                        <div className="pdf-builder-options">
                          <label className="pdf-builder-textarea">
                            Appendix notes
                            <textarea
                              value={section.options?.appendixNotes || ''}
                              onChange={(event) =>
                                updateSectionOptions(section.id, {
                                  appendixNotes: event.target.value,
                                })
                              }
                              rows={3}
                              placeholder="Add sources, methodology, or disclaimers."
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'design' && (
                <div className="pdf-builder-panel">
                  <div className="pdf-builder-presets">
                    {(Object.keys(PRESET_CONFIGS) as ReportPreset[]).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`pdf-builder-preset ${
                          design.preset === preset ? 'active' : ''
                        }`}
                        onClick={() => handlePresetChange(preset)}
                      >
                        <span className="pdf-builder-preset-title">
                          {preset === 'classic' && 'Classic Research'}
                          {preset === 'investor' && 'Investor Brief'}
                          {preset === 'minimal' && 'Modern Minimal'}
                          {preset === 'executive' && 'Executive Summary'}
                        </span>
                        <span className="pdf-builder-preset-desc">
                          {preset === 'classic' &&
                            'Balanced layout with signature Hippo blue.'}
                          {preset === 'investor' && 'Compact, data-heavy, executive tone.'}
                          {preset === 'minimal' && 'Clean, monochrome, space efficient.'}
                          {preset === 'executive' && 'Warm accent, narrative friendly.'}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="pdf-builder-options-grid">
                    <label>
                      Brand color
                      <input
                        type="color"
                        value={design.brandColor || '#1a73e8'}
                        onChange={(event) => updateDesign({ brandColor: event.target.value })}
                      />
                    </label>
                    <label>
                      Accent color
                      <input
                        type="color"
                        value={design.accentColor || '#e8f0fe'}
                        onChange={(event) => updateDesign({ accentColor: event.target.value })}
                      />
                    </label>
                    <label>
                      Typeface
                      <select
                        value={design.fontFamily || 'sans'}
                        onChange={(event) =>
                          updateDesign({ fontFamily: event.target.value as 'sans' | 'serif' })
                        }
                      >
                        <option value="sans">Sans Serif</option>
                        <option value="serif">Serif</option>
                      </select>
                    </label>
                    <label>
                      Density
                      <select
                        value={design.density || 'comfortable'}
                        onChange={(event) =>
                          updateDesign({
                            density: event.target.value as 'compact' | 'comfortable',
                          })
                        }
                      >
                        <option value="comfortable">Comfortable</option>
                        <option value="compact">Compact</option>
                      </select>
                    </label>
                  </div>

                  <div className="pdf-builder-options-grid">
                    <label className="pdf-builder-checkbox">
                      <input
                        type="checkbox"
                        checked={design.header?.showCompanyName ?? true}
                        onChange={(event) =>
                          updateDesign({
                            header: { showCompanyName: event.target.checked },
                          })
                        }
                      />
                      <span>Show company name in header</span>
                    </label>
                    <label className="pdf-builder-checkbox">
                      <input
                        type="checkbox"
                        checked={design.footer?.showPageNumbers ?? true}
                        onChange={(event) =>
                          updateDesign({
                            footer: { showPageNumbers: event.target.checked },
                          })
                        }
                      />
                      <span>Show page numbers in footer</span>
                    </label>
                    <label>
                      Footer disclaimer
                      <input
                        type="text"
                        value={design.footer?.disclaimer || ''}
                        onChange={(event) =>
                          updateDesign({
                            footer: { disclaimer: event.target.value },
                          })
                        }
                        placeholder="Optional short disclaimer."
                      />
                    </label>
                    <label>
                      Cover subtitle
                      <input
                        type="text"
                        value={design.cover?.subtitle || ''}
                        onChange={(event) =>
                          updateDesign({
                            cover: { subtitle: event.target.value },
                          })
                        }
                        placeholder="Report subtitle."
                      />
                    </label>
                    <label className="pdf-builder-checkbox">
                      <input
                        type="checkbox"
                        checked={design.cover?.showBadge ?? true}
                        onChange={(event) =>
                          updateDesign({
                            cover: { showBadge: event.target.checked },
                          })
                        }
                      />
                      <span>Show symbol badge on cover</span>
                    </label>
                    <label className="pdf-builder-checkbox">
                      <input
                        type="checkbox"
                        checked={design.chart?.showGrid ?? true}
                        onChange={(event) =>
                          updateDesign({
                            chart: { showGrid: event.target.checked },
                          })
                        }
                      />
                      <span>Show chart grid</span>
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'review' && (
                <div className="pdf-builder-panel">
                  <div className="pdf-builder-review card">
                    <h3>Report summary</h3>
                    <p>
                      Sections enabled: <strong>{enabledSections.length}</strong>
                    </p>
                    <p>
                      Estimated pages: <strong>{estimatedPages}</strong>
                    </p>
                    <div className="pdf-builder-review-list">
                      {enabledSections.map((section) => (
                        <span key={section.id}>{SECTION_METADATA[section.id].title}</span>
                      ))}
                    </div>
                    {!hasValidSelection && (
                      <p className="pdf-builder-warning">
                        Select at least one section to generate a report.
                      </p>
                    )}
                    <p className="pdf-builder-note">
                      Estimates vary based on data availability and translation length.
                    </p>
                  </div>

                  <div className="pdf-builder-generate">
                    <PDFReportButton
                      stockSymbol={stockSymbol}
                      language={language}
                      userId={userId}
                      reportConfig={reportConfig}
                      generateLabelOverride="Generate Custom PDF"
                      downloadLabelOverride="Download Custom PDF"
                      disabled={!hasValidSelection}
                      className="pdf-builder-generate-button"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFReportBuilder;
