import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './src/utils/logger.js';
import redisClient from './src/config/redis.js';
import postgresClient from './src/config/postgres.js';
import userService from './src/services/userService.js';

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
const PORT = parseInt(process.env.PORT || '3005', 10);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const redisHealth = await redisClient.healthCheck();
    const postgresHealth = await postgresClient.healthCheck();
    
    const isHealthy = redisHealth.status === 'healthy' && postgresHealth.status === 'healthy';
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'user-service',
      redis: redisHealth.status,
      postgres: postgresHealth.status
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Health check failed: ${errorMessage}`);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'user-service',
      error: errorMessage
    });
  }
});

// Set language preference
app.post('/preferences/language', async (req: Request, res: Response) => {
  try {
    const { userId, language } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userId is required and must be a string'
      });
    }

    if (!language || typeof language !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'language is required and must be a string'
      });
    }

    const preferences = await userService.setLanguagePreference(userId, language);

    res.json({
      success: true,
      preferences,
      message: `Language preference set to ${preferences.language}`
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Set language preference error: ${errorMessage}`);
    res.status(500).json({
      error: 'Failed to set language preference',
      message: errorMessage
    });
  }
});

// Get language preference
app.get('/preferences/language/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userId is required'
      });
    }

    const language = await userService.getLanguagePreference(userId);

    res.json({
      userId,
      language,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Get language preference error: ${errorMessage}`);
    res.status(500).json({
      error: 'Failed to get language preference',
      message: errorMessage
    });
  }
});

// Get full user preferences
app.get('/preferences/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userId is required'
      });
    }

    const preferences = await userService.getUserPreferences(userId);

    if (!preferences) {
      return res.status(404).json({
        error: 'Not found',
        message: `Preferences not found for user ${userId}`
      });
    }

    res.json(preferences);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Get user preferences error: ${errorMessage}`);
    res.status(500).json({
      error: 'Failed to get user preferences',
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

// Initialize connections and start server
async function startServer(): Promise<void> {
  try {
    // Connect to Redis
    await redisClient.connect();
    logger.info('Redis connected successfully');

    // Connect to PostgreSQL
    await postgresClient.connect();
    logger.info('PostgreSQL connected successfully');

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`User Service listening on port ${PORT}`);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing user service');
      await redisClient.disconnect();
      await postgresClient.disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT signal received: closing user service');
      await redisClient.disconnect();
      await postgresClient.disconnect();
      process.exit(0);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to start User Service: ${errorMessage}`);
    process.exit(1);
  }
}

startServer();

export default app;
