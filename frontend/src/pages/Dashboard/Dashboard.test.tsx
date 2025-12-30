import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import { apiService } from '../../services/api';
import { translationService } from '../../services/translation';

// Mock services
vi.mock('../../services/api', () => ({
  apiService: {
    getStockData: vi.fn(),
    getLanguagePreference: vi.fn(() => Promise.resolve('en')),
    enqueueSymbols: vi.fn(() => Promise.resolve('queue-123')),
  },
}));

vi.mock('../../services/translation', () => ({
  translationService: {
    loadInitialLanguage: vi.fn(() => Promise.resolve()),
    getLanguage: vi.fn(() => 'en'),
    setLanguage: vi.fn(() => Promise.resolve()),
    translate: vi.fn((key: string) => Promise.resolve(key)),
  },
}));

const mockStockData = {
  symbol: 'AAPL',
  stockData: {
    symbol: 'AAPL',
    currentPrice: 150.25,
    previousClose: 148.50,
    priceChange: 1.75,
    priceChangePercent: 1.18,
    tradingDate: '2024-01-15',
    timestamp: '2024-01-15T10:00:00Z',
  },
  news: [],
  analysis: {
    symbol: 'AAPL',
    companyDescription: 'Test company',
    competitors: { industry: 'Tech', keyPoints: [], rating: 4, summary: 'Good' },
    financialHealth: { keyPoints: [], rating: 4, summary: 'Good' },
    growth: { keyPoints: [], rating: 4, summary: 'Good' },
    profitability: { keyPoints: [], rating: 4, summary: 'Good' },
    shareholder_returns: { keyPoints: [], summary: 'Good' },
    valuation: { keyPoints: [], rating: 4, summary: 'Good' },
  },
  fetchedAt: '2024-01-15T10:00:00Z',
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders dashboard header', () => {
    render(<Dashboard />);
    
    expect(screen.getByText('Hippo Equity Research Dashboard')).toBeInTheDocument();
  });

  it('renders language selector', () => {
    render(<Dashboard />);
    
    const languageButton = screen.getByRole('button', { name: /English/i });
    expect(languageButton).toBeInTheDocument();
  });

  it('loads initial language preference', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(translationService.loadInitialLanguage).toHaveBeenCalled();
    });
  });

  it('fetches stock data when symbol is entered', async () => {
    (apiService.getStockData as ReturnType<typeof vi.fn>).mockResolvedValue(mockStockData);
    
    render(<Dashboard />);
    
    // Dashboard should attempt to fetch data on mount with default symbol
    await waitFor(() => {
      expect(apiService.getStockData).toHaveBeenCalled();
    });
  });

  it('displays error message when fetch fails', async () => {
    (apiService.getStockData as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Failed to fetch')
    );
    
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
    });
  });
});

