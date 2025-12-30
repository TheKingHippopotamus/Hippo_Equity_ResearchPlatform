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
  const [isExpanded, setIsExpanded] = useState(false);
  const [sentimentLabel, setSentimentLabel] = useState<string>('');

  React.useEffect(() => {
    const loadTranslations = async () => {
      const sentiment = await apiService.getSentimentLabel(article.sentiment, language);
      setSentimentLabel(sentiment);
    };
    loadTranslations();
  }, [article.sentiment, language]);

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

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
    if (onExpand && !isExpanded) {
      onExpand(article);
    }
  };

  return (
    <article className="news-card card">
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
          {isExpanded ? (
            <div className="news-card-full-content">
              <p>{article.content}</p>
            </div>
          ) : (
            <p className="news-card-preview">{article.contentPreview}</p>
          )}

          <button
            className="news-card-expand button button-secondary"
            onClick={handleExpand}
            aria-expanded={isExpanded}
          >
            {isExpanded ? 'Show Less' : 'Read More'}
          </button>
        </div>

        {article.url && (
          <div className="news-card-footer">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="news-card-link"
            >
              View Original Article →
            </a>
          </div>
        )}
      </div>
    </article>
  );
};

export default NewsCard;

