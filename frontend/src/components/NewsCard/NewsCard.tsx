import React, { useState } from 'react';
import type { NewsArticle } from '../../types/models';
import { apiService } from '../../services/api';
import type { SupportedLanguage } from '../../types/models';
import './NewsCard.css';

interface NewsCardProps {
  article: NewsArticle;
  language?: SupportedLanguage;
  onExpand?: (article: NewsArticle) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  article,
  language = 'en',
  onExpand,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sentimentLabel, setSentimentLabel] = useState<string>('');

  React.useEffect(() => {
    const loadTranslations = async () => {
      const sentiment = await apiService.getSentimentLabel(article.sentiment, language);
      setSentimentLabel(sentiment);
    };
    loadTranslations();
  }, [article.sentiment, language]);

  React.useEffect(() => {
    // Close modal on Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isModalOpen]);

  React.useEffect(() => {
    // Prevent body scroll when modal is open
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const getSentimentColor = (sentiment: number): string => {
    if (sentiment <= -1) return 'very-negative';
    if (sentiment === 0) return 'negative';
    if (sentiment === 1) return 'neutral';
    if (sentiment === 2 || sentiment === 3) return 'positive';
    return 'very-positive';
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on the link
    if ((e.target as HTMLElement).closest('.news-card-link')) {
      return;
    }
    setIsModalOpen(true);
    if (onExpand) {
      onExpand(article);
    }
  };

  const handleCloseModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(false);
  };

  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <article 
        className="news-card card news-card-clickable" 
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick(e as any);
          }
        }}
      >
        {article.imageUrl && (
          <div className="news-card-image">
            <img src={article.imageUrl} alt={article.title} loading="lazy" />
          </div>
        )}

        <div className="news-card-content">
          <div className="news-card-header">
            <h3 className="news-card-title">{article.title}</h3>
            <div className="news-card-meta">
              <span className="news-card-source">{article.source}</span>
              <span className="news-card-date">{formatDate(article.publishedAt)}</span>
            </div>
          </div>

          <div className="news-card-sentiment">
            <span className={`sentiment-badge sentiment-${getSentimentColor(article.sentiment)}`}>
              {sentimentLabel}
            </span>
          </div>

          <div className="news-card-body">
            <p className="news-card-preview">{article.contentPreview}</p>
          </div>

          {article.url && (
            <div className="news-card-footer">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-card-link"
                onClick={(e) => e.stopPropagation()}
              >
                View Original Article →
              </a>
            </div>
          )}
        </div>
      </article>

      {isModalOpen && (
        <div 
          className="news-modal-backdrop" 
          onClick={handleCloseModal}
          role="presentation"
        >
          <div 
            className="news-modal" 
            onClick={handleModalContentClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-modal-title"
          >
            <button
              className="news-modal-close"
              onClick={handleCloseModal}
              aria-label="Close modal"
            >
              ×
            </button>

            {article.imageUrl && (
              <div className="news-modal-image">
                <img src={article.imageUrl} alt={article.title} />
              </div>
            )}

            <div className="news-modal-content">
              <header className="news-modal-header">
                <h2 id="news-modal-title" className="news-modal-title">{article.title}</h2>
                <div className="news-modal-meta">
                  <span className="news-modal-source">{article.source}</span>
                  <span className="news-modal-date">{formatDate(article.publishedAt)}</span>
                </div>
                <div className="news-modal-sentiment">
                  <span className={`sentiment-badge sentiment-${getSentimentColor(article.sentiment)}`}>
                    {sentimentLabel}
                  </span>
                </div>
              </header>

              <div className="news-modal-body">
                <p>{article.content}</p>
              </div>

              {article.url && (
                <footer className="news-modal-footer">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="news-modal-link button button-primary"
                  >
                    View Original Article →
                  </a>
                </footer>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NewsCard;

