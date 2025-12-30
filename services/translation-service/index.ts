import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import logger from './src/utils/logger.js';
import translationService, { SUPPORTED_LANGUAGES } from './src/services/translationService.js';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3004', 10);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'translation-service',
    availableLanguages: translationService.getAvailableLanguages()
  });
});

// Get available languages
app.get('/languages', (req: Request, res: Response) => {
  res.json({
    languages: translationService.getAvailableLanguages(),
    defaultLanguage: 'en'
  });
});

// Translate UI string
app.post('/translate', (req: Request, res: Response) => {
  try {
    const { key, language = 'en' } = req.body;

    if (!key || typeof key !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'key is required and must be a string'
      });
    }

    const translated = translationService.translate(key, language);

    res.json({
      key,
      language,
      translation: translated
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Translation error: ${errorMessage}`);
    res.status(500).json({
      error: 'Translation failed',
      message: errorMessage
    });
  }
});

// Translate content (news articles, financial analysis, etc.)
app.post('/translate-content', async (req: Request, res: Response) => {
  try {
    const { content, language = 'en' } = req.body;

    if (content === undefined) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'content is required'
      });
    }

    const translated = await translationService.translateContent(content, language);

    res.json({
      language,
      original: content,
      translated
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Content translation error: ${errorMessage}`);
    res.status(500).json({
      error: 'Content translation failed',
      message: errorMessage
    });
  }
});

// Get sentiment label
app.post('/sentiment', (req: Request, res: Response) => {
  try {
    const { sentiment, language = 'en' } = req.body;

    if (typeof sentiment !== 'number') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'sentiment must be a number (-2 to 4)'
      });
    }

    if (sentiment < -2 || sentiment > 4) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'sentiment must be between -2 and 4'
      });
    }

    const label = translationService.getSentimentLabel(sentiment, language);

    res.json({
      sentiment,
      language,
      label
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Sentiment label error: ${errorMessage}`);
    res.status(500).json({
      error: 'Sentiment label failed',
      message: errorMessage
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: () => void) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Translation Service listening on port ${PORT}`);
  logger.info(`Available languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
});

export default app;

