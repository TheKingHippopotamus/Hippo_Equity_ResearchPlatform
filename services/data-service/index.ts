import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './src/utils/logger.js';
import redisClient from './src/config/redis.js';
import postgresClient from './src/config/postgres.js';
import persistenceService from './src/services/persistenceService.js';
import dataService from './src/services/dataService.js';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  path.resolve(__dirname, '../..', '.env'),
  path.resolve(__dirname, '../../..', '.env'),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const redisHealth = await redisClient.healthCheck();
    const postgresHealth = await postgresClient.healthCheck();
    
    const isHealthy = redisHealth.status === 'healthy';
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'data-service',
      redis: redisHealth.status,
      postgres: postgresHealth.status
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Health check failed: ${errorMessage}`);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'data-service',
      error: errorMessage
    });
  }
});

// Get stock news
app.get('/stock/:symbol/news', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const language = (req.query.language as string) || 'en';
    
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: 'Invalid symbol',
        message: 'Stock symbol is required'
      });
    }

    const news = await dataService.fetchStockNews(symbol.toUpperCase(), language);
    
    res.json({
      symbol: symbol.toUpperCase(),
      language,
      news,
      count: news.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error fetching stock news: ${errorMessage}`);
    
    res.status(500).json({
      error: 'Failed to fetch stock news',
      message: 'An error occurred while fetching stock news. Please try again later.',
      symbol: req.params.symbol
    });
  }
});

// Get financial analysis
app.get('/stock/:symbol/analysis', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const language = (req.query.language as string) || 'en';
    
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: 'Invalid symbol',
        message: 'Stock symbol is required'
      });
    }

    const analysis = await dataService.fetchFinancialAnalysis(symbol.toUpperCase(), language);
    
    res.json({
      symbol: symbol.toUpperCase(),
      language,
      analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error fetching financial analysis: ${errorMessage}`);
    
    res.status(500).json({
      error: 'Failed to fetch financial analysis',
      message: 'An error occurred while fetching financial analysis. Please try again later.',
      symbol: req.params.symbol
    });
  }
});

// Get combined stock data
app.get('/stock/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const language = (req.query.language as string) || 'en';
    
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: 'Invalid symbol',
        message: 'Stock symbol is required'
      });
    }

    const data = await dataService.fetchStockData(symbol.toUpperCase(), language);
    
    res.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error fetching stock data: ${errorMessage}`);
    
    res.status(500).json({
      error: 'Failed to fetch stock data',
      message: 'An error occurred while fetching stock data. Please try again later.',
      symbol: req.params.symbol
    });
  }
});

// Get stock price history
app.get('/stock/:symbol/history', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const range = (req.query.range as string | undefined)?.toUpperCase();

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: 'Invalid symbol',
        message: 'Stock symbol is required'
      });
    }

    const history = await dataService.fetchPriceHistorySeries(symbol.toUpperCase());
    const availableRanges = Object.keys(history).sort();

    if (range) {
      const series = history[range];
      if (!series) {
        return res.status(404).json({
          error: 'Range not available',
          message: `No price history found for range ${range}`,
          symbol: symbol.toUpperCase(),
          availableRanges
        });
      }

      return res.json({
        symbol: symbol.toUpperCase(),
        range,
        series,
        availableRanges,
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      symbol: symbol.toUpperCase(),
      priceHistory: history,
      availableRanges,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error fetching price history: ${errorMessage}`);

    res.status(500).json({
      error: 'Failed to fetch price history',
      message: 'An error occurred while fetching price history. Please try again later.',
      symbol: req.params.symbol
    });
  }
});

// Initialize Redis connection and start server
async function startServer() {
  try {
    // Connect to Redis
    await redisClient.connect();
    logger.info('Redis connected successfully');

    // Connect to PostgreSQL and initialize persistence service
    try {
      await postgresClient.connect();
      await persistenceService.initialize();
      logger.info('PostgreSQL and PersistenceService initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`PostgreSQL connection failed, persistence disabled: ${errorMessage}`);
      // Don't exit - service can continue without persistence
    }

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Data Service running on port ${PORT}`);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to start server: ${errorMessage}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redisClient.disconnect();
  await postgresClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await redisClient.disconnect();
  await postgresClient.disconnect();
  process.exit(0);
});

// Start the server
startServer();

export default app;
