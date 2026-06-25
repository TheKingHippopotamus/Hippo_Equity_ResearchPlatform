import React, { useState, useEffect, useMemo } from 'react';
import { StockCard } from '../../components/StockCard/StockCard';
import { NewsCard } from '../../components/NewsCard/NewsCard';
import { FinancialMetricsPanel } from '../../components/FinancialMetricsPanel/FinancialMetricsPanel';
import { LanguageSelector } from '../../components/LanguageSelector/LanguageSelector';
import { AutopilotQueue } from '../../components/AutopilotQueue/AutopilotQueue';
import { PDFReportBuilder } from '../../components/PDFReportBuilder/PDFReportBuilder';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle';
import { ChartComponent } from '../../components/ChartComponent/ChartComponent';
import type { ChartDataPoint, ChartNewsItem } from '../../components/ChartComponent/ChartComponent';
import { apiService } from '../../services/api';
import { translationService } from '../../services/translation';
import { validateStockSymbol, validateStockSymbols } from '../../utils/validation';
import type { ProcessedStockData, SupportedLanguage, PriceHistoryMap } from '../../types/models';
import type { ThemeId } from '../../components/ThemeToggle/ThemeToggle';
import './Dashboard.css';

const normalizeHistoryLabel = (label: string) => {
  const trimmed = label.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const hasTime = trimmed.includes('T') || trimmed.includes(':');
    return hasTime ? parsed.toISOString() : parsed.toISOString().slice(0, 10);
  }
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber)) {
    const ms = asNumber > 1e12 ? asNumber : asNumber * 1000;
    const numericDate = new Date(ms);
    if (!Number.isNaN(numericDate.getTime())) {
      return numericDate.toISOString();
    }
  }
  return trimmed;
};


export const Dashboard: React.FC = () => {
  const getStoredTheme = (): ThemeId => {
    const stored = localStorage.getItem('theme');
    if (stored === 'minimal' || stored === 'tech' || stored === 'luxury') {
      return stored;
    }
    return 'luxury';
  };

  const [currentSymbol, setCurrentSymbol] = useState<string>('AAPL');
  const [stockData, setStockData] = useState<ProcessedStockData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());
  const [queueId, setQueueId] = useState<string | null>(null);
  const [showAutopilot, setShowAutopilot] = useState<boolean>(false);
  const [symbolInput, setSymbolInput] = useState<string>('');
  const [symbolValidationError, setSymbolValidationError] = useState<string | null>(null);
  const [userId] = useState<string>(() => {
    // Generate or retrieve user ID
    const stored = localStorage.getItem('userId');
    if (stored) return stored;
    const newId = `user_${Date.now()}`;
    localStorage.setItem('userId', newId);
    return newId;
  });
  const [priceHistory, setPriceHistory] = useState<PriceHistoryMap | null>(null);
  const [chartLoading, setChartLoading] = useState<boolean>(false);

  useEffect(() => {
    const body = document.body;
    body.classList.remove('theme-luxury', 'theme-minimal', 'theme-tech');
    body.classList.add(`theme-${theme}`);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const initializeLanguage = async () => {
      await translationService.loadInitialLanguage();
      const currentLang = translationService.getLanguage();
      setLanguage(currentLang);

      // Load user preference from backend
      try {
        const userLang = await apiService.getLanguagePreference(userId);
        if (userLang && userLang !== currentLang) {
          await translationService.setLanguage(userLang as SupportedLanguage);
          setLanguage(userLang as SupportedLanguage);
        }
      } catch (error) {
        console.warn('Failed to load user language preference:', error);
      }
    };
    initializeLanguage();
  }, [userId]);

  useEffect(() => {
    if (currentSymbol) {
      fetchStockData(currentSymbol);
    }
  }, [currentSymbol, language]);

  const fetchStockData = async (symbol: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiService.getStockData(symbol, language);
      setStockData(data);
      
      // Fetch price history if not included in stockData
      if (data.priceHistory) {
        setPriceHistory(data.priceHistory);
      } else {
        setChartLoading(true);
        try {
          const historyData = await apiService.getPriceHistory(symbol);
          if (historyData.priceHistory) {
            setPriceHistory(historyData.priceHistory);
          }
        } catch (historyErr) {
          console.warn('Failed to fetch price history:', historyErr);
          setPriceHistory(null);
        } finally {
          setChartLoading(false);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch stock data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = async (newLanguage: SupportedLanguage) => {
    setLanguage(newLanguage);
    await translationService.setLanguage(newLanguage);
    
    // Refresh data with new language
    if (currentSymbol) {
      await fetchStockData(currentSymbol);
    }
  };

  const handleEnqueueSymbols = async (symbols: string[]) => {
    // Validate symbols before submission
    const validation = validateStockSymbols(symbols);
    
    if (!validation.valid) {
      const errorMessages = validation.errors?.map(e => 
        `Symbol ${e.index >= 0 ? `at position ${e.index + 1}` : ''}: ${e.error}`
      ).join(', ') || 'Invalid symbols';
      setError(errorMessages);
      return;
    }

    try {
      const normalizedSymbols = validation.normalized || symbols;
      const id = await apiService.enqueueSymbols(normalizedSymbols);
      setQueueId(id);
      setShowAutopilot(true);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enqueue symbols';
      setError(errorMessage);
    }
  };

  const handleSymbolInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSymbolInput(value);
    
    // Real-time validation feedback
    if (value.trim()) {
      const validation = validateStockSymbol(value);
      if (!validation.valid) {
        setSymbolValidationError(validation.error || 'Invalid symbol');
      } else {
        setSymbolValidationError(null);
      }
    } else {
      setSymbolValidationError(null);
    }
  };

  const handleSymbolInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const input = e.currentTarget;
      const symbol = input.value.trim();
      
      // Validate before submission
      const validation = validateStockSymbol(symbol);
      
      if (!validation.valid) {
        setSymbolValidationError(validation.error || 'Invalid symbol');
        return;
      }
      
      if (validation.normalized) {
        setCurrentSymbol(validation.normalized);
        setSymbolInput('');
        setSymbolValidationError(null);
        setError(null);
      }
    }
  };

  const handleSymbolSubmit = () => {
    if (!symbolInput.trim()) {
      setSymbolValidationError('Stock symbol is required');
      return;
    }

    const validation = validateStockSymbol(symbolInput);
    
    if (!validation.valid) {
      setSymbolValidationError(validation.error || 'Invalid symbol');
      return;
    }

    if (validation.normalized) {
      setCurrentSymbol(validation.normalized);
      setSymbolInput('');
      setSymbolValidationError(null);
      setError(null);
    }
  };

  const chartSeriesByRange = useMemo<Record<string, ChartDataPoint[]>>(() => {
    if (!priceHistory) {
      return {};
    }

    return Object.entries(priceHistory).reduce((acc, [range, series]) => {
      const length = Math.min(series.labels?.length || 0, series.prices?.length || 0);
      if (length === 0) {
        return acc;
      }

      const mapped: ChartDataPoint[] = [];
      for (let i = 0; i < length; i += 1) {
        const label = normalizeHistoryLabel(String(series.labels?.[i] ?? ''));
        const value = series.prices?.[i];
        if (!label || !Number.isFinite(value)) {
          continue;
        }
        mapped.push({ date: label, value });
      }

      if (mapped.length > 0) {
        acc[range] = mapped.sort((a, b) => a.date.localeCompare(b.date));
      }
      return acc;
    }, {} as Record<string, ChartDataPoint[]>);
  }, [priceHistory]);

  const chartData = useMemo<ChartDataPoint[]>(() => {
    const entries = Object.values(chartSeriesByRange)
      .map((series) => ({ series, length: series.length }))
      .filter((entry) => entry.length > 0)
      .sort((a, b) => b.length - a.length);

    return entries[0]?.series || [];
  }, [chartSeriesByRange]);

  const chartSeriesForRange = useMemo(() => {
    const supportedRanges = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'] as const;
    return supportedRanges.reduce((acc, key) => {
      if (chartSeriesByRange[key]) {
        acc[key] = chartSeriesByRange[key];
      }
      return acc;
    }, {} as Partial<Record<(typeof supportedRanges)[number], ChartDataPoint[]>>);
  }, [chartSeriesByRange]);

  // Transform news items for chart markers
  const chartNewsItems = useMemo<ChartNewsItem[]>(() => {
    if (!stockData?.news) return [];
    return stockData.news.map((article) => ({
      id: article.id,
      title: article.title,
      publishedAt: article.publishedAt,
      url: article.url,
      source: article.source,
      sentiment: article.sentiment,
    }));
  }, [stockData?.news]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-content dashboard-shell">
          <div className="dashboard-brand">
            <div className="dashboard-logo">
              <img src="/logo.png" alt="Hippopotamus Research logo" />
            </div>
            <div className="dashboard-brand-text">
              <span className="dashboard-brand-kicker">Hippopotamus Research</span>
              <h1 className="dashboard-title">Hippo Equity Research Dashboard</h1>
            </div>
          </div>
          <div className="dashboard-header-actions">
            <ThemeToggle value={theme} onChange={setTheme} />
            <LanguageSelector
              currentLanguage={language}
              onLanguageChange={handleLanguageChange}
              userId={userId}
            />
          </div>
        </div>
      </header>

      <main className="dashboard-main dashboard-shell">
        <div className="dashboard-layout">
          <div className="dashboard-primary">
            {error && (
              <div className="dashboard-error card">
                <p>{error}</p>
                <button
                  className="button button-secondary"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            {loading && (
              <div className="dashboard-loading card">
                <p>Loading stock data...</p>
              </div>
            )}

            {stockData && !loading && (
              <div className="dashboard-content">
                <div className="dashboard-hero-section">
                  <div className="dashboard-chart-section">
                    {chartLoading ? (
                      <div className="dashboard-chart-loading card">
                        <p>Loading chart data...</p>
                      </div>
                    ) : chartData.length > 0 ? (
                      <ChartComponent
                        data={chartData}
                        seriesByRange={chartSeriesForRange}
                        type="area"
                        title={`${stockData.symbol} Price History`}
                        newsItems={chartNewsItems}
                        xAxisLabel="Date"
                        yAxisLabel="Price (USD)"
                      />
                    ) : (
                      <div className="dashboard-chart-empty card">
                        <p>Price history data not available</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="dashboard-pdf-section">
                  <PDFReportBuilder
                    stockSymbol={stockData.symbol}
                    language={language}
                    userId={userId}
                    inline={true}
                    defaultOpen={true}
                  />
                </div>

                <div className="dashboard-news-section">
                  <h2 className="dashboard-section-title">News Articles</h2>
                  <div className="news-grid">
                    {stockData.news.map((article) => (
                      <NewsCard
                        key={article.id}
                        article={article}
                        language={language}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!stockData && !loading && !error && (
              <div className="dashboard-empty card">
                <p>Enter a stock symbol to get started</p>
              </div>
            )}
          </div>

          <aside className="dashboard-sidebar">
            <div className="dashboard-search card">
              <div className="dashboard-search-header">
                <h2>Search</h2>
                <p>Track a new symbol</p>
              </div>
              <div className="symbol-input-group">
                <label htmlFor="symbol-input">Stock Symbol</label>
                <div className="input-wrapper compact">
                  <input
                    id="symbol-input"
                    type="text"
                    placeholder="Enter symbol (AAPL)"
                    value={symbolInput}
                    onChange={handleSymbolInputChange}
                    onKeyDown={handleSymbolInput}
                    className={`symbol-input compact ${symbolValidationError ? 'input-error' : ''}`}
                    aria-invalid={!!symbolValidationError}
                    aria-describedby={symbolValidationError ? 'symbol-error' : undefined}
                  />
                  <button
                    className="button button-primary"
                    onClick={handleSymbolSubmit}
                    disabled={!!symbolValidationError || !symbolInput.trim()}
                  >
                    Search
                  </button>
                </div>
                {symbolValidationError && (
                  <div id="symbol-error" className="validation-error" role="alert">
                    {symbolValidationError}
                  </div>
                )}
              </div>
              {stockData && (
                <div className="dashboard-symbol-display">
                  <span className="dashboard-symbol-text">{stockData.symbol}</span>
                </div>
              )}
              <button
                className="button button-secondary dashboard-autopilot-trigger"
                onClick={() => {
                  const symbols = prompt('Enter stock symbols (comma-separated):');
                  if (symbols) {
                    const symbolList = symbols.split(',').map((s) => s.trim()).filter(Boolean);
                    if (symbolList.length > 0) {
                      handleEnqueueSymbols(symbolList);
                    } else {
                      setError('Please enter at least one valid stock symbol');
                    }
                  }
                }}
              >
                Start Autopilot
              </button>
            </div>

            {stockData && (
              <div className="dashboard-stock-section">
                <StockCard
                  stockData={stockData.stockData}
                  language={language}
                  onSelect={setCurrentSymbol}
                />
              </div>
            )}

            {showAutopilot && queueId && (
              <div className="dashboard-autopilot">
                <AutopilotQueue
                  queueId={queueId}
                  language={language}
                  onCancel={() => {
                    setShowAutopilot(false);
                    setQueueId(null);
                  }}
                />
              </div>
            )}

            {stockData && (
              <div className="dashboard-analysis-section">
                <FinancialMetricsPanel
                  analysis={stockData.analysis}
                  language={language}
                />
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
