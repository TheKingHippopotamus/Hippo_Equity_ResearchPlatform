// Frontend Type Definitions
// Based on backend service models

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
    rating: number; // 1-5 scale
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
  pendingTasks: number;
  currentPosition: number;
  currentTask?: QueueTask;
  progress: number; // 0-100 percentage
  estimatedCompletionTime?: string; // ISO timestamp
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'he';

export interface UserPreferences {
  userId: string;
  language: string;
  theme?: 'light' | 'dark';
  notificationsEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type ReportSectionId =
  | 'cover'
  | 'stockSummary'
  | 'companyOverview'
  | 'financialAnalysis'
  | 'news'
  | 'priceChart'
  | 'appendix';

export type ReportAnalysisSectionId =
  | 'competitors'
  | 'financialHealth'
  | 'growth'
  | 'profitability'
  | 'shareholderReturns'
  | 'valuation';

export type ReportPreset = 'classic' | 'investor' | 'minimal' | 'executive';
export type ReportFontFamily = 'sans' | 'serif';
export type ReportDensity = 'compact' | 'comfortable';
export type ReportNewsMode = 'full' | 'summary';
export type ReportChartType = 'line' | 'bar' | 'area';

export interface ReportSectionConfig {
  id: ReportSectionId;
  enabled: boolean;
  order: number;
  options?: {
    newsCount?: number;
    newsMode?: ReportNewsMode;
    chartType?: ReportChartType;
    analysisSections?: ReportAnalysisSectionId[];
    appendixNotes?: string;
  };
}

export interface ReportDesignConfig {
  preset: ReportPreset;
  brandColor?: string;
  accentColor?: string;
  fontFamily?: ReportFontFamily;
  density?: ReportDensity;
  header?: {
    showCompanyName?: boolean;
  };
  footer?: {
    showPageNumbers?: boolean;
    disclaimer?: string;
  };
  cover?: {
    subtitle?: string;
    showLogo?: boolean;
    showBadge?: boolean;
  };
  chart?: {
    showGrid?: boolean;
    lineWidth?: number;
  };
}

export interface ReportConfig {
  sections: ReportSectionConfig[];
  design: ReportDesignConfig;
}
