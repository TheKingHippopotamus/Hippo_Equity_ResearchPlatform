import React, { useState, useEffect, useMemo } from 'react';
import { StockCard } from '../../components/StockCard/StockCard';
import { NewsCard } from '../../components/NewsCard/NewsCard';
import { ChartComponent } from '../../components/ChartComponent/ChartComponent';
import { FinancialMetricsPanel } from '../../components/FinancialMetricsPanel/FinancialMetricsPanel';
import { LanguageSelector } from '../../components/LanguageSelector/LanguageSelector';
import { AutopilotQueue } from '../../components/AutopilotQueue/AutopilotQueue';
import { PDFReportBuilder } from '../../components/PDFReportBuilder/PDFReportBuilder';
import { apiService } from '../../services/api';
import { translationService } from '../../services/translation';
import { validateStockSymbol, validateStockSymbols } from '../../utils/validation';
import type { ProcessedStockData, SupportedLanguage } from '../../types/models';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const [currentSymbol, setCurrentSymbol] = useState<string>('AAPL');
  const [stockData, setStockData] = useState<ProcessedStockData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage>('en');
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

  // Generate sample chart data from stock data
  const chartData = useMemo(() => {
    if (!stockData) return [];

    // Generate mock time-series data (in production, this would come from historical data API)
    const data = [];
    const basePrice = stockData.stockData.currentPrice;
    const days = 30;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
      data.push({
        date: date.toISOString().split('T')[0],
        value: basePrice * (1 + variation),
      });
    }

    return data;
  }, [stockData?.symbol, stockData?.stockData.currentPrice]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-content container">
          <h1 className="dashboard-title">Hippo Equity Research Dashboard</h1>
          <div className="dashboard-header-actions">
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
                title="Price History (30 Days)"
                xAxisLabel="Date"
                yAxisLabel="Price (USD)"
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
