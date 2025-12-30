import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewsCard } from './NewsCard';
import type { NewsArticle } from '../../types/models';
import { apiService } from '../../services/api';
import { translationService } from '../../services/translation';

// Mock services
vi.mock('../../services/api', () => ({
  apiService: {
    getSentimentLabel: vi.fn((sentiment: number) => Promise.resolve('Positive')),
  },
}));

vi.mock('../../services/translation', () => ({
  translationService: {
    translate: vi.fn((key: string) => Promise.resolve(key)),
  },
}));

const mockArticle: NewsArticle = {
  id: '1',
  title: 'Test Article',
  content: 'Full article content here',
  contentPreview: 'Article preview...',
  publishedAt: '2024-01-15T10:00:00Z',
  sentiment: 2,
  source: 'Test Source',
  url: 'https://example.com/article',
};

describe('NewsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders article title and preview', () => {
    render(<NewsCard article={mockArticle} />);
    
    expect(screen.getByText('Test Article')).toBeInTheDocument();
    expect(screen.getByText('Article preview...')).toBeInTheDocument();
  });

  it('expands to show full content when clicked', async () => {
    render(<NewsCard article={mockArticle} />);
    
    const expandButton = screen.getByText('Read More');
    fireEvent.click(expandButton);
    
    expect(await screen.findByText('Full article content here')).toBeInTheDocument();
    expect(screen.getByText('Show Less')).toBeInTheDocument();
  });

  it('displays sentiment badge', async () => {
    render(<NewsCard article={mockArticle} />);
    
    // Wait for sentiment label to load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(apiService.getSentimentLabel).toHaveBeenCalledWith(2, 'en');
  });

  it('displays article source and date', () => {
    render(<NewsCard article={mockArticle} />);
    
    expect(screen.getByText('Test Source')).toBeInTheDocument();
  });

  it('shows image when provided', () => {
    const articleWithImage: NewsArticle = {
      ...mockArticle,
      imageUrl: 'https://example.com/image.jpg',
    };
    
    render(<NewsCard article={articleWithImage} />);
    
    const image = screen.getByAltText('Test Article');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('calls onExpand when article is expanded', () => {
    const onExpand = vi.fn();
    render(<NewsCard article={mockArticle} onExpand={onExpand} />);
    
    const expandButton = screen.getByText('Read More');
    fireEvent.click(expandButton);
    
    expect(onExpand).toHaveBeenCalledWith(mockArticle);
  });
});

