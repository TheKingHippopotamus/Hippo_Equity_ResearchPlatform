// Data Models for Report Service
// Based on design.md specifications and shared with other services

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

export interface ReportMetadata {
  id: string;
  userId: string;
  symbol: string;
  language: string;
  filePath: string;
  fileSize?: number;
  minioBucket?: string;
  minioObjectName?: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChartData {
  labels: string[];
  values: number[];
  title?: string;
  type?: 'line' | 'bar' | 'area';
}

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'he';

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
  mergeToPage?: number; // Page number to merge this section to (0-based, undefined = new page)
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
