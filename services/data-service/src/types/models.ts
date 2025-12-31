// Data Models for Data Service
// Based on design.md specifications

export interface StockData {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  priceChange: number;
  priceChangePercent: number;
  tradingDate: string;
  timestamp: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  contentPreview: string;
  publishedAt: string;
  sentiment: number; // -2 to 4 scale
  source: string;
  url: string;
  imageUrl?: string;
}

export interface FinancialAnalysis {
  symbol: string;
  companyDescription: string;
  competitors: {
    industry: string;
    keyPoints: string[];
    rating: number;
    summary: string;
  };
  financialHealth: {
    keyPoints: string[];
    rating: number;
    summary: string;
  };
  growth: {
    keyPoints: string[];
    rating: number;
    summary: string;
  };
  profitability: {
    keyPoints: string[];
    rating: number;
    summary: string;
  };
  shareholder_returns: {
    keyPoints: string[];
    summary: string;
  };
  valuation: {
    keyPoints: string[];
    rating: number;
    summary: string;
  };
}

export interface ProcessedStockData {
  symbol: string;
  stockData: StockData;
  news: NewsArticle[];
  analysis: FinancialAnalysis;
  priceHistory?: PriceHistoryMap;
  fetchedAt: string;
}

export interface PriceHistorySeries {
  labels: string[];
  prices: number[];
}

export type PriceHistoryMap = Record<string, PriceHistorySeries>;

// Raw API Response Types (may vary from actual API)
export interface RawStockNewsResponse {
  news?: Array<{
    id?: string;
    title?: string;
    content?: string;
    content_preview?: string;
    contentPreview?: string;
    published_at?: string;
    publishedAt?: string;
    sentiment_rating?: number;
    sentiment?: number;
    source?: string;
    url?: string;
    seo_url?: string;
    imageUrl?: string;
    image_url?: string;
    current_price?: number;
    previous_close?: number;
    price_change_percent?: number;
    trading_date?: string;
  }>;
  articles?: Array<{
    id?: string;
    title?: string;
    content?: string;
    contentPreview?: string;
    publishedAt?: string;
    sentiment?: number;
    source?: string;
    url?: string;
    imageUrl?: string;
  }>;
  symbol?: string;
  ticker?: string;
  total_articles?: number;
  [key: string]: unknown;
}

export interface RawFinancialAnalysisResponse {
  analysis?: {
    competitors?: {
      industry?: string;
      key_points?: string[];
      rating?: number;
      summary?: string;
    };
    financial_health?: {
      key_points?: string[];
      rating?: number;
      summary?: string;
    };
    growth?: {
      key_points?: string[];
      rating?: number;
      summary?: string;
    };
    profitability?: {
      key_points?: string[];
      rating?: number;
      summary?: string;
    };
    shareholder_returns?: {
      key_points?: string[];
      summary?: string;
    };
    valuation?: {
      key_points?: string[];
      rating?: number;
      summary?: string;
    };
    company_description?: string;
  };
  symbol?: string;
  companyDescription?: string;
  company_description?: string;
  competitors?: {
    industry?: string;
    keyPoints?: string[];
    key_points?: string[];
    rating?: number;
    summary?: string;
  };
  financialHealth?: {
    keyPoints?: string[];
    key_points?: string[];
    rating?: number;
    summary?: string;
  };
  growth?: {
    keyPoints?: string[];
    key_points?: string[];
    rating?: number;
    summary?: string;
  };
  profitability?: {
    keyPoints?: string[];
    key_points?: string[];
    rating?: number;
    summary?: string;
  };
  shareholder_returns?: {
    keyPoints?: string[];
    key_points?: string[];
    summary?: string;
  };
  valuation?: {
    keyPoints?: string[];
    key_points?: string[];
    rating?: number;
    summary?: string;
  };
  [key: string]: unknown;
}

export interface RawPriceHistoryResponse {
  price_history?: Record<string, {
    labels?: string[];
    prices?: number[];
  }>;
  [key: string]: unknown;
}
