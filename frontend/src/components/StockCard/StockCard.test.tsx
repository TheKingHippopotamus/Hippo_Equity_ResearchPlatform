import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockCard } from './StockCard';
import type { StockData } from '../../types/models';
import { translationService } from '../../services/translation';

// Mock translation service
vi.mock('../../services/translation', () => ({
  translationService: {
    translate: vi.fn((key: string) => Promise.resolve(key)),
  },
}));

const mockStockData: StockData = {
  symbol: 'AAPL',
  currentPrice: 150.25,
  previousClose: 148.50,
  priceChange: 1.75,
  priceChangePercent: 1.18,
  tradingDate: '2024-01-15',
  timestamp: '2024-01-15T10:00:00Z',
};

describe('StockCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders stock symbol and price correctly', () => {
    render(<StockCard stockData={mockStockData} />);
    
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('$150.25')).toBeInTheDocument();
  });

  it('displays positive price change in green', () => {
    render(<StockCard stockData={mockStockData} />);
    
    const positiveChange = screen.getByText('+1.18%');
    expect(positiveChange).toBeInTheDocument();
    expect(positiveChange).toHaveClass('positive');
  });

  it('displays negative price change in red', () => {
    const negativeData: StockData = {
      ...mockStockData,
      priceChange: -1.75,
      priceChangePercent: -1.18,
    };
    
    render(<StockCard stockData={negativeData} />);
    
    const negativeChange = screen.getByText('-1.18%');
    expect(negativeChange).toBeInTheDocument();
    expect(negativeChange).toHaveClass('negative');
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<StockCard stockData={mockStockData} onSelect={onSelect} />);
    
    const card = screen.getByRole('button');
    card.click();
    
    expect(onSelect).toHaveBeenCalledWith('AAPL');
  });

  it('does not call onSelect when not provided', () => {
    render(<StockCard stockData={mockStockData} />);
    
    const card = screen.getByText('AAPL').closest('.stock-card');
    expect(card).not.toHaveClass('clickable');
  });

  it('formats currency correctly', () => {
    render(<StockCard stockData={mockStockData} />);
    
    expect(screen.getByText('$150.25')).toBeInTheDocument();
    expect(screen.getByText('$148.50')).toBeInTheDocument();
  });

  it('loads translations for labels', async () => {
    render(<StockCard stockData={mockStockData} language="he" />);
    
    // Wait for translations to load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(translationService.translate).toHaveBeenCalled();
  });
});

