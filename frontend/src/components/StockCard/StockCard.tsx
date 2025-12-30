import React from 'react';
import type { StockData } from '../../types/models';
import { translationService } from '../../services/translation';
import type { SupportedLanguage } from '../../types/models';
import './StockCard.css';

interface StockCardProps {
  stockData: StockData;
  language?: SupportedLanguage;
  onSelect?: (symbol: string) => void;
}

export const StockCard: React.FC<StockCardProps> = ({
  stockData,
  language = 'en',
  onSelect,
}) => {
  const [priceLabel, setPriceLabel] = React.useState('Current Price');
  const [changeLabel, setChangeLabel] = React.useState('Change');
  const [percentLabel, setPercentLabel] = React.useState('Change %');
  const [previousLabel, setPreviousLabel] = React.useState('Previous Close');

  React.useEffect(() => {
    const loadTranslations = async () => {
      const translations = await Promise.all([
        translationService.translate('metrics.currentPrice', language),
        translationService.translate('metrics.priceChange', language),
        translationService.translate('metrics.priceChangePercent', language),
        translationService.translate('metrics.previousClose', language),
      ]);
      setPriceLabel(translations[0]);
      setChangeLabel(translations[1]);
      setPercentLabel(translations[2]);
      setPreviousLabel(translations[3]);
    };
    loadTranslations();
  }, [language]);

  const isPositive = stockData.priceChange >= 0;
  const changeColor = isPositive ? 'positive' : 'negative';

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatPercent = (percent: number): string => {
    return `${isPositive ? '+' : ''}${percent.toFixed(2)}%`;
  };

  return (
    <div
      className={`stock-card card ${onSelect ? 'clickable' : ''}`}
      onClick={() => onSelect?.(stockData.symbol)}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(stockData.symbol);
        }
      }}
    >
      <div className="stock-card-header">
        <h2 className="stock-card-symbol">{stockData.symbol}</h2>
        <span className="stock-card-date">{stockData.tradingDate}</span>
      </div>
      
      <div className="stock-card-price">
        <div className="stock-card-price-label">{priceLabel}</div>
        <div className="stock-card-price-value">{formatPrice(stockData.currentPrice)}</div>
      </div>

      <div className="stock-card-metrics">
        <div className="stock-card-metric">
          <span className="metric-label">{changeLabel}</span>
          <span className={`metric-value ${changeColor}`}>
            {formatPrice(stockData.priceChange)}
          </span>
        </div>
        
        <div className="stock-card-metric">
          <span className="metric-label">{percentLabel}</span>
          <span className={`metric-value ${changeColor}`}>
            {formatPercent(stockData.priceChangePercent)}
          </span>
        </div>
        
        <div className="stock-card-metric">
          <span className="metric-label">{previousLabel}</span>
          <span className="metric-value">{formatPrice(stockData.previousClose)}</span>
        </div>
      </div>
    </div>
  );
};

export default StockCard;

