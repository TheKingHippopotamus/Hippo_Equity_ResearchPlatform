// Queue Service Data Models
// Based on design.md specifications

export interface QueueTask {
  id: string;
  symbol: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: ProcessedStockData;
  error?: string;
}

export interface QueueStatus {
  queueId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  currentPosition: number;
  currentTask?: QueueTask;
  progress: number; // 0-100 percentage
  estimatedCompletionTime?: string; // ISO timestamp
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ProcessedStockData {
  symbol: string;
  stockData: StockData;
  news: NewsArticle[];
  analysis: FinancialAnalysis;
  fetchedAt: string;
}

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

export interface QueueCompletionEvent {
  queueId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  completedAt: string;
  results: ProcessedStockData[];
}

