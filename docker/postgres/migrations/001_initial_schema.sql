-- Migration: Initial Database Schema
-- Description: Creates all required tables and indexes for Hippo Equity Research App
-- Created: 2024

-- Stock Data Schema
CREATE TABLE IF NOT EXISTS stock_data.stocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(10) NOT NULL,
    current_price DECIMAL(15, 4) NOT NULL,
    previous_close DECIMAL(15, 4) NOT NULL,
    price_change DECIMAL(15, 4) NOT NULL,
    price_change_percent DECIMAL(10, 4) NOT NULL,
    trading_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_symbol_date UNIQUE (symbol, trading_date)
);

-- Indexes for stock_data.stocks
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stock_data.stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_trading_date ON stock_data.stocks(trading_date);
CREATE INDEX IF NOT EXISTS idx_stocks_created_at ON stock_data.stocks(created_at);

-- News Articles Schema
CREATE TABLE IF NOT EXISTS stock_data.news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_id UUID REFERENCES stock_data.stocks(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    article_id VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    content_preview TEXT,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sentiment INTEGER CHECK (sentiment >= -2 AND sentiment <= 4),
    source VARCHAR(255),
    url TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_article_id UNIQUE (article_id)
);

-- Indexes for stock_data.news_articles
CREATE INDEX IF NOT EXISTS idx_news_symbol ON stock_data.news_articles(symbol);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON stock_data.news_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_news_sentiment ON stock_data.news_articles(sentiment);
CREATE INDEX IF NOT EXISTS idx_news_stock_id ON stock_data.news_articles(stock_id);

-- Financial Analysis Schema
CREATE TABLE IF NOT EXISTS stock_data.financial_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_id UUID REFERENCES stock_data.stocks(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    company_description TEXT,
    competitors_industry VARCHAR(255),
    competitors_key_points TEXT[],
    competitors_rating INTEGER CHECK (competitors_rating >= 1 AND competitors_rating <= 5),
    competitors_summary TEXT,
    financial_health_key_points TEXT[],
    financial_health_rating INTEGER CHECK (financial_health_rating >= 1 AND financial_health_rating <= 5),
    financial_health_summary TEXT,
    growth_key_points TEXT[],
    growth_rating INTEGER CHECK (growth_rating >= 1 AND growth_rating <= 5),
    growth_summary TEXT,
    profitability_key_points TEXT[],
    profitability_rating INTEGER CHECK (profitability_rating >= 1 AND profitability_rating <= 5),
    profitability_summary TEXT,
    shareholder_returns_key_points TEXT[],
    shareholder_returns_summary TEXT,
    valuation_key_points TEXT[],
    valuation_rating INTEGER CHECK (valuation_rating >= 1 AND valuation_rating <= 5),
    valuation_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_symbol_analysis UNIQUE (symbol, created_at)
);

-- Indexes for stock_data.financial_analysis
CREATE INDEX IF NOT EXISTS idx_analysis_symbol ON stock_data.financial_analysis(symbol);
CREATE INDEX IF NOT EXISTS idx_analysis_created_at ON stock_data.financial_analysis(created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_stock_id ON stock_data.financial_analysis(stock_id);

-- User Preferences Schema
CREATE TABLE IF NOT EXISTS user_preferences.preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    theme VARCHAR(10) DEFAULT 'light',
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_id UNIQUE (user_id)
);

-- Indexes for user_preferences.preferences
CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON user_preferences.preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_language ON user_preferences.preferences(language);
CREATE INDEX IF NOT EXISTS idx_preferences_created_at ON user_preferences.preferences(created_at);

-- Reports Metadata Schema
CREATE TABLE IF NOT EXISTS reports_metadata.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    file_path TEXT NOT NULL,
    file_size BIGINT,
    minio_bucket VARCHAR(255),
    minio_object_name VARCHAR(255),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for reports_metadata.reports
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports_metadata.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_symbol ON reports_metadata.reports(symbol);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports_metadata.reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports_metadata.reports(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_stocks_updated_at BEFORE UPDATE ON stock_data.stocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_articles_updated_at BEFORE UPDATE ON stock_data.news_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_analysis_updated_at BEFORE UPDATE ON stock_data.financial_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at BEFORE UPDATE ON user_preferences.preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports_metadata.reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

