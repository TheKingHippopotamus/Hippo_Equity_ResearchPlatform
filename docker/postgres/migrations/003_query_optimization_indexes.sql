-- Migration: Query Optimization Indexes
-- Description: Adds composite indexes for common query patterns to optimize performance
-- Created: 2024
-- Requirements: 7.1, 8.4

-- Composite index for stock lookups by symbol and date range
CREATE INDEX IF NOT EXISTS idx_stocks_symbol_trading_date 
ON stock_data.stocks(symbol, trading_date DESC);

-- Composite index for stock lookups by symbol and created_at (for historical queries)
CREATE INDEX IF NOT EXISTS idx_stocks_symbol_created_at 
ON stock_data.stocks(symbol, created_at DESC);

-- Composite index for news articles by symbol and published date
CREATE INDEX IF NOT EXISTS idx_news_symbol_published_at 
ON stock_data.news_articles(symbol, published_at DESC);

-- Composite index for news articles by symbol and sentiment (for filtering)
CREATE INDEX IF NOT EXISTS idx_news_symbol_sentiment 
ON stock_data.news_articles(symbol, sentiment);

-- Composite index for financial analysis by symbol and created_at
CREATE INDEX IF NOT EXISTS idx_analysis_symbol_created_at 
ON stock_data.financial_analysis(symbol, created_at DESC);

-- Index for user preferences lookups (already exists, but ensure it's optimized)
-- idx_preferences_user_id already exists

-- Index for reports metadata by user and symbol
CREATE INDEX IF NOT EXISTS idx_reports_user_symbol 
ON reports_metadata.reports(user_id, symbol);

-- Index for reports metadata by user and generated_at (for date range queries)
CREATE INDEX IF NOT EXISTS idx_reports_user_generated_at 
ON reports_metadata.reports(user_id, generated_at DESC);

-- Partial index for active/unresolved errors (for error logging queries)
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved 
ON error_logging.error_logs(created_at DESC) 
WHERE resolved = false;

-- Composite index for error logs by service and status code
CREATE INDEX IF NOT EXISTS idx_error_logs_service_status 
ON error_logging.error_logs(service_name, status_code, created_at DESC);

-- Analyze tables to update statistics
ANALYZE stock_data.stocks;
ANALYZE stock_data.news_articles;
ANALYZE stock_data.financial_analysis;
ANALYZE user_preferences.preferences;
ANALYZE reports_metadata.reports;
ANALYZE error_logging.error_logs;

