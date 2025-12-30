import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageSelector } from './LanguageSelector';
import { apiService } from '../../services/api';
import { translationService } from '../../services/translation';

// Mock services
vi.mock('../../services/api', () => ({
  apiService: {
    getAvailableLanguages: vi.fn(() => Promise.resolve(['en', 'es', 'fr', 'de', 'zh', 'he'])),
    setLanguagePreference: vi.fn(() => Promise.resolve({ userId: 'user1', language: 'he' })),
  },
}));

vi.mock('../../services/translation', () => ({
  translationService: {
    translate: vi.fn((key: string) => Promise.resolve(key)),
    setLanguage: vi.fn(() => Promise.resolve()),
  },
}));

describe('LanguageSelector', () => {
  const mockOnLanguageChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders current language', () => {
    render(
      <LanguageSelector
        currentLanguage="en"
        onLanguageChange={mockOnLanguageChange}
      />
    );
    
    expect(screen.getByText(/English \(EN\)/)).toBeInTheDocument();
  });

  it('opens dropdown when clicked', () => {
    render(
      <LanguageSelector
        currentLanguage="en"
        onLanguageChange={mockOnLanguageChange}
      />
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Español')).toBeInTheDocument();
  });

  it('calls onLanguageChange when language is selected', async () => {
    render(
      <LanguageSelector
        currentLanguage="en"
        onLanguageChange={mockOnLanguageChange}
      />
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const hebrewOption = screen.getByText('עברית');
    fireEvent.click(hebrewOption);
    
    await waitFor(() => {
      expect(mockOnLanguageChange).toHaveBeenCalledWith('he');
    });
  });

  it('saves language preference to backend when userId provided', async () => {
    render(
      <LanguageSelector
        currentLanguage="en"
        onLanguageChange={mockOnLanguageChange}
        userId="user1"
      />
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const hebrewOption = screen.getByText('עברית');
    fireEvent.click(hebrewOption);
    
    await waitFor(() => {
      expect(apiService.setLanguagePreference).toHaveBeenCalledWith('user1', 'he');
    });
  });

  it('updates translation service when language changes', async () => {
    render(
      <LanguageSelector
        currentLanguage="en"
        onLanguageChange={mockOnLanguageChange}
      />
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const hebrewOption = screen.getByText('עברית');
    fireEvent.click(hebrewOption);
    
    await waitFor(() => {
      expect(translationService.setLanguage).toHaveBeenCalledWith('he');
    });
  });

  it('marks current language as active', () => {
    render(
      <LanguageSelector
        currentLanguage="he"
        onLanguageChange={mockOnLanguageChange}
      />
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    const hebrewOption = screen.getByText('עברית').closest('button');
    expect(hebrewOption).toHaveClass('active');
  });
});

