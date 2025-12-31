import React, { useState, useEffect, useMemo } from 'react';
import { StockCard } from '../../components/StockCard/StockCard';
import { NewsCard } from '../../components/NewsCard/NewsCard';
import { ChartComponent } from '../../components/ChartComponent/ChartComponent';
import { FinancialMetricsPanel } from '../../components/FinancialMetricsPanel/FinancialMetricsPanel';
import { LanguageSelector } from '../../components/LanguageSelector/LanguageSelector';
import { AutopilotQueue } from '../../components/AutopilotQueue/AutopilotQueue';
import { PDFReportBuilder } from '../../components/PDFReportBuilder/PDFReportBuilder';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle';
import { apiService } from '../../services/api';
import { translationService } from '../../services/translation';
import { validateStockSymbol, validateStockSymbols } from '../../utils/validation';
import type { PriceHistoryMap, PriceHistorySeries, ProcessedStockData, SupportedLanguage } from '../../types/models';
import type { ThemeId } from '../../components/ThemeToggle/ThemeToggle';
import './Dashboard.css';

const HISTORY_PREFERENCE = ['10Y', '5Y', '1Y', '6M', '3M', '1M', '1D'];

const normalizeHistoryLabel = (label: string) => {
  const trimmed = label.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber)) {
    const numericDate = new Date(asNumber);
    if (!Number.isNaN(numericDate.getTime())) {
      return numericDate.toISOString().slice(0, 10);
    }
  }
  return trimmed;
};

const selectHistorySeries = (history?: PriceHistoryMap) => {
  if (!history) {
    return null;
  }
  for (const key of HISTORY_PREFERENCE) {
    if (history[key]) {
      return { range: key, series: history[key] };
    }
  }
  const entries = Object.entries(history);
  if (entries.length === 0) {
    return null;
  }
  entries.sort((a, b) => (b[1].prices?.length || 0) - (a[1].prices?.length || 0));
  return { range: entries[0][0], series: entries[0][1] };
};

const buildChartData = (series: PriceHistorySeries) => {
  const length = Math.min(series.labels.length, series.prices.length);
  const mapped = [];

  for (let i = 0; i < length; i += 1) {
    const label = normalizeHistoryLabel(String(series.labels[i] ?? ''));
    const value = series.prices[i];
    if (!label || !Number.isFinite(value)) {
      continue;
    }
    mapped.push({ date: label, value });
  }

  return mapped.sort((a, b) => a.date.localeCompare(b.date));
};

const sortRanges = (ranges: string[]) =>
  [...ranges].sort((a, b) => {
    const indexA = HISTORY_PREFERENCE.indexOf(a);
    const indexB = HISTORY_PREFERENCE.indexOf(b);
    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b);
    }
    if (indexA === -1) {
      return 1;
    }
    if (indexB === -1) {
      return -1;
    }
    return indexA - indexB;
  });

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

  const historyMeta = useMemo(() => {
    const selection = selectHistorySeries(stockData?.priceHistory);
    if (!selection) {
      return null;
    }
    const availableRanges = stockData?.priceHistory
      ? sortRanges(Object.keys(stockData.priceHistory))
      : [];
    return { ...selection, availableRanges };
  }, [stockData?.priceHistory]);

  // Generate chart data from provider history (fallback to mock if missing)
  const chartData = useMemo(() => {
    if (historyMeta?.series) {
      return buildChartData(historyMeta.series);
    }
    if (!stockData) {
      return [];
    }

    const data = [];
    const basePrice = stockData.stockData.currentPrice;
    const days = 30;

    for (let i = days; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
      data.push({
        date: date.toISOString().split('T')[0],
        value: basePrice * (1 + variation),
      });
    }

    return data;
  }, [historyMeta?.series, stockData?.stockData.currentPrice]);

  const chartTitle = historyMeta?.range
    ? `Price History (${historyMeta.range})`
    : 'Price History (30 Days)';
  const chartTimeRange = historyMeta?.availableRanges?.length
    ? `Available: ${historyMeta.availableRanges.join(' • ')}`
    : 'Mock data';

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-content container">
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

      <main className="dashboard-main container">
        <div className="dashboard-controls">
          <div className="symbol-input-group">
            <label htmlFor="symbol-input">Stock Symbol:</label>
            <div className="input-wrapper">
              <input
                id="symbol-input"
                type="text"
                placeholder="Enter symbol (e.g., AAPL)"
                value={symbolInput}
                onChange={handleSymbolInputChange}
                onKeyDown={handleSymbolInput}
                className={`symbol-input ${symbolValidationError ? 'input-error' : ''}`}
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
          
          <button
            className="button button-primary"
            onClick={() => {
              const symbols = prompt('Enter stock symbols (comma-separated):');
              if (symbols) {
                const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
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

        {loading && (
          <div className="dashboard-loading card">
            <p>Loading stock data...</p>
          </div>
        )}

        {stockData && !loading && (
          <div className="dashboard-content">
            <div className="dashboard-stock-section">
              <StockCard
                stockData={stockData.stockData}
                language={language}
                onSelect={setCurrentSymbol}
              />
              
              <div className="dashboard-actions">
                <PDFReportBuilder
                  stockSymbol={stockData.symbol}
                  language={language}
                  userId={userId}
                />
              </div>
            </div>

            <div className="dashboard-chart-section">
              <ChartComponent
                data={chartData}
                type="line"
                title={chartTitle}
                timeRange={chartTimeRange}
                xAxisLabel="Date"
                yAxisLabel="Price (USD)"
                newsItems={stockData.news}
              />
            </div>

            <div className="dashboard-news-section">
              <h2>News Articles</h2>
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

            <div className="dashboard-analysis-section">
              <FinancialMetricsPanel
                analysis={stockData.analysis}
                language={language}
              />
            </div>
          </div>
        )}

        {!stockData && !loading && !error && (
          <div className="dashboard-empty card">
            <p>Enter a stock symbol to get started</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
