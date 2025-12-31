// API Service for communicating with backend services
import axios, { AxiosInstance } from 'axios';
import type {
  ProcessedStockData,
  QueueStatus,
  ReportConfig,
  SupportedLanguage,
  UserPreferences,
} from '../types/models';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

    this.client = axios.create({
      baseURL: apiBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // Server responded with error
          return Promise.reject({
            message: error.response.data?.message || 'An error occurred',
            status: error.response.status,
            data: error.response.data,
          });
        } else if (error.request) {
          // Request made but no response
          return Promise.reject({
            message: 'Network error. Please check your connection.',
            status: 0,
          });
        } else {
          // Error in request setup
          return Promise.reject({
            message: error.message || 'An unexpected error occurred',
            status: 0,
          });
        }
      }
    );
  }

  // Data Service endpoints
  async getStockData(symbol: string, language: SupportedLanguage = 'en'): Promise<ProcessedStockData> {
    const response = await this.client.get(`/data/stock/${symbol}`, {
      params: { language },
    });
    return response.data;
  }

  async getStockNews(symbol: string, language: SupportedLanguage = 'en') {
    const response = await this.client.get(`/data/stock/${symbol}/news`, {
      params: { language },
    });
    return response.data;
  }

  async getFinancialAnalysis(symbol: string, language: SupportedLanguage = 'en') {
    const response = await this.client.get(`/data/stock/${symbol}/analysis`, {
      params: { language },
    });
    return response.data;
  }

  // Translation Service endpoints
  async translate(key: string, language: SupportedLanguage = 'en'): Promise<string> {
    const response = await this.client.post('/translation/translate', {
      key,
      language,
    });
    return response.data.translation;
  }

  async translateContent(content: unknown, language: SupportedLanguage = 'en') {
    const response = await this.client.post('/translation/translate-content', {
      content,
      language,
    });
    return response.data.translated;
  }

  async getSentimentLabel(sentiment: number, language: SupportedLanguage = 'en'): Promise<string> {
    const response = await this.client.post('/translation/sentiment', {
      sentiment,
      language,
    });
    return response.data.label;
  }

  async getAvailableLanguages() {
    const response = await this.client.get('/translation/languages');
    return response.data.languages;
  }

  // User Service endpoints
  async setLanguagePreference(userId: string, language: SupportedLanguage): Promise<UserPreferences> {
    const response = await this.client.post('/user/preferences/language', {
      userId,
      language,
    });
    return response.data.preferences;
  }

  async getLanguagePreference(userId: string): Promise<string> {
    const response = await this.client.get(`/user/preferences/language/${userId}`);
    return response.data.language;
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const response = await this.client.get(`/user/preferences/${userId}`);
      return response.data;
    } catch (error: unknown) {
      if ((error as { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Queue Service endpoints
  async enqueueSymbols(symbols: string[]): Promise<string> {
    const response = await this.client.post('/queue/enqueue', { symbols });
    return response.data.queueId;
  }

  async getQueueStatus(queueId: string): Promise<QueueStatus> {
    const response = await this.client.get(`/queue/${queueId}/status`);
    return response.data;
  }

  // Report Service endpoints
  async generatePDF(
    symbol: string,
    language: SupportedLanguage = 'en',
    userId: string = 'anonymous',
    reportConfig?: ReportConfig
  ): Promise<{ reportId: string; downloadUrl: string; fileSize?: number }> {
    const response = await this.client.post('/report/generate', {
      symbol,
      language,
      userId,
      reportConfig,
    });
    return response.data;
  }

  async downloadPDF(reportId: string): Promise<Blob> {
    const response = await this.client.get(`/report/download/${reportId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async getReportMetadata(reportId: string) {
    const response = await this.client.get(`/report/metadata/${reportId}`);
    return response.data;
  }

  async listReports(userId: string = 'anonymous', limit: number = 50) {
    const response = await this.client.get('/report/reports', {
      params: { userId, limit },
    });
    return response.data;
  }

  // Price History endpoint
  async getPriceHistory(symbol: string, range?: string) {
    const response = await this.client.get(`/data/stock/${symbol}/history`, {
      params: range ? { range } : {},
    });
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
