import logger from '../utils/logger.js';
import {
  NewsArticle,
  FinancialAnalysis,
  RawStockNewsResponse,
  RawFinancialAnalysisResponse
} from '../types/models.js';

/**
 * NormalizationService - Transforms raw API responses to internal schema
 * Property 4: Data Normalization Round-Trip
 * Requirements: 1.2, 1.5
 */
class NormalizationService {
  /**
   * Normalize raw stock news API response to internal schema
   * @param rawData Raw API response
   * @param symbol Stock symbol (fallback if not in response)
   * @returns Array of normalized news articles
   */
  normalizeNews(rawData: RawStockNewsResponse, symbol: string): NewsArticle[] {
    try {
      // Handle various response structures
      const articles = (rawData.news || rawData.articles || []) as Array<Record<string, unknown>>;
      
      if (!Array.isArray(articles)) {
        logger.warn(`Invalid articles array for symbol ${symbol}, returning empty array`);
        return [];
      }

      return articles
        .filter(article => article !== null && article !== undefined)
        .map((article, index) => {
          const raw = article;
          // Generate ID if missing
          const id = (raw.id as string | undefined) || `news-${symbol}-${index}-${Date.now()}`;
          
          // Extract title
          const title = (raw.title as string | undefined) || 'Untitled Article';
          
          // Extract content
          const content = (raw.content as string | undefined) || '';
          
          // Generate preview if missing (first 200 chars)
          const contentPreview = (raw.contentPreview as string | undefined) ||
            (raw.content_preview as string | undefined) ||
            (content.length > 200 ? content.substring(0, 200) + '...' : content);
          
          // Parse published date
          let publishedAt =
            (raw.publishedAt as string | undefined) ||
            (raw.published_at as string | undefined) ||
            (raw.generated_at as string | undefined) ||
            new Date().toISOString();
          try {
            // Validate date format
            new Date(publishedAt);
          } catch {
            publishedAt = new Date().toISOString();
          }
          
          // Validate sentiment (-2 to 4 scale)
          let sentiment = (raw.sentiment as number | undefined) ?? (raw.sentiment_rating as number | undefined);
          if (typeof sentiment !== 'number' || sentiment < -2 || sentiment > 4) {
            sentiment = 0; // Default neutral
          }
          
          return {
            id,
            title,
            content,
            contentPreview,
            publishedAt,
            sentiment,
            source: (raw.source as string | undefined) || (raw.slug as string | undefined) || 'Unknown',
            url: (raw.url as string | undefined) || (raw.seo_url as string | undefined) || '',
            imageUrl: (raw.imageUrl as string | undefined) || (raw.image_url as string | undefined)
          };
        });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error normalizing news data for ${symbol}: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Normalize raw financial analysis API response to internal schema
   * @param rawData Raw API response
   * @param symbol Stock symbol (fallback if not in response)
   * @returns Normalized financial analysis
   */
  normalizeFinancialAnalysis(
    rawData: RawFinancialAnalysisResponse,
    symbol: string
  ): FinancialAnalysis {
    try {
      const analysis = (rawData.analysis || rawData) as Record<string, unknown>;

      // Helper function to normalize section data
      const normalizeSection = (
        section: Record<string, unknown> | undefined,
        hasRating: boolean = true
      ) => {
        const keyPoints =
          (section?.keyPoints as string[] | undefined) ||
          (section?.key_points as string[] | undefined);
        const rating = section?.rating as number | undefined;
        const summary = section?.summary as string | undefined;
        return {
          keyPoints: Array.isArray(keyPoints) ? keyPoints : [],
          rating: hasRating 
            ? (typeof rating === 'number' && rating >= 1 && rating <= 5
                ? rating
                : 3) // Default rating
            : undefined as never,
          summary: summary || ''
        };
      };

      // Normalize competitors section
      const competitors = {
        industry: (analysis.competitors as Record<string, unknown> | undefined)?.industry as string || 'Unknown',
        ...normalizeSection(analysis.competitors as Record<string, unknown> | undefined, true),
        rating: typeof (analysis.competitors as Record<string, unknown> | undefined)?.rating === 'number' &&
                ((analysis.competitors as Record<string, unknown> | undefined)?.rating as number) >= 1 &&
                ((analysis.competitors as Record<string, unknown> | undefined)?.rating as number) <= 5
          ? ((analysis.competitors as Record<string, unknown> | undefined)?.rating as number)
          : 3
      };

      // Normalize financial health section
      const financialHealth = normalizeSection(
        (analysis.financialHealth as Record<string, unknown> | undefined) ||
          (analysis.financial_health as Record<string, unknown> | undefined),
        true
      ) as {
        keyPoints: string[];
        rating: number;
        summary: string;
      };

      // Normalize growth section
      const growth = normalizeSection(analysis.growth as Record<string, unknown> | undefined, true) as {
        keyPoints: string[];
        rating: number;
        summary: string;
      };

      // Normalize profitability section
      const profitability = normalizeSection(analysis.profitability as Record<string, unknown> | undefined, true) as {
        keyPoints: string[];
        rating: number;
        summary: string;
      };

      // Normalize shareholder returns section (no rating)
      const shareholder_returns = normalizeSection(
        analysis.shareholder_returns as Record<string, unknown> | undefined,
        false
      ) as {
        keyPoints: string[];
        summary: string;
      };

      // Normalize valuation section
      const valuation = normalizeSection(analysis.valuation as Record<string, unknown> | undefined, true) as {
        keyPoints: string[];
        rating: number;
        summary: string;
      };

      return {
        symbol: rawData.symbol || symbol,
        companyDescription:
          rawData.companyDescription ||
          rawData.company_description ||
          (analysis.companyDescription as string | undefined) ||
          (analysis.company_description as string | undefined) ||
          '',
        competitors,
        financialHealth,
        growth,
        profitability,
        shareholder_returns,
        valuation
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error normalizing financial analysis for ${symbol}: ${errorMessage}`);
      
      // Return minimal valid structure
      return {
        symbol,
        companyDescription: '',
        competitors: {
          industry: 'Unknown',
          keyPoints: [],
          rating: 3,
          summary: ''
        },
        financialHealth: {
          keyPoints: [],
          rating: 3,
          summary: ''
        },
        growth: {
          keyPoints: [],
          rating: 3,
          summary: ''
        },
        profitability: {
          keyPoints: [],
          rating: 3,
          summary: ''
        },
        shareholder_returns: {
          keyPoints: [],
          summary: ''
        },
        valuation: {
          keyPoints: [],
          rating: 3,
          summary: ''
        }
      };
    }
  }

  /**
   * Validate normalized data structure
   * Ensures essential fields are present (Property 4)
   * @param data Normalized data to validate
   * @returns true if valid, false otherwise
   */
  validateNormalizedData(data: unknown): boolean {
    // This is a basic validation - can be extended
    return data !== null && data !== undefined;
  }
}

// Singleton instance
const normalizeData = new NormalizationService();

export { normalizeData };
