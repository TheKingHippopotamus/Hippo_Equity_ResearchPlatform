import express, { Express, Request, Response } from 'express';
import logger from '../utils/logger.js';
import queueService from '../services/queueService.js';
import redisClient from '../config/redis.js';

/**
 * Express server for Queue Service API
 * Provides endpoints for enqueueing symbols and checking queue status
 */
export function createServer(): Express {
  const app: Express = express();
  const PORT = process.env.PORT || 3002;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const redisHealth = await redisClient.healthCheck();
      
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'queue-service',
        redis: redisHealth.status
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Health check failed: ${errorMessage}`);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'queue-service',
        error: errorMessage
      });
    }
  });

  // Enqueue symbols endpoint
  // Requirements: 2.1, 2.2
  app.post('/queue/enqueue', async (req: Request, res: Response) => {
    try {
      const { symbols } = req.body;

      if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'symbols must be a non-empty array of stock symbols'
        });
      }

      // Validate symbols are strings
      const invalidSymbols = symbols.filter(s => typeof s !== 'string' || s.trim().length === 0);
      if (invalidSymbols.length > 0) {
        return res.status(400).json({
          error: 'Invalid symbols',
          message: 'All symbols must be non-empty strings'
        });
      }

      const queueId = await queueService.enqueueSymbols(symbols);

      res.status(201).json({
        queueId,
        message: `Successfully enqueued ${symbols.length} symbols`,
        symbols: symbols.map((s: string) => s.toUpperCase()),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error enqueueing symbols: ${errorMessage}`);
      
      res.status(500).json({
        error: 'Failed to enqueue symbols',
        message: 'An error occurred while enqueueing symbols. Please try again later.'
      });
    }
  });

  // Get queue status endpoint
  // Requirements: 2.4
  app.get('/queue/:queueId/status', async (req: Request, res: Response) => {
    try {
      const { queueId } = req.params;

      if (!queueId || typeof queueId !== 'string') {
        return res.status(400).json({
          error: 'Invalid queue ID',
          message: 'Queue ID is required'
        });
      }

      const status = await queueService.getQueueStatus(queueId);

      if (!status) {
        return res.status(404).json({
          error: 'Queue not found',
          message: `Queue with ID ${queueId} not found`
        });
      }

      res.json(status);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error getting queue status: ${errorMessage}`);
      
      res.status(500).json({
        error: 'Failed to get queue status',
        message: 'An error occurred while retrieving queue status. Please try again later.'
      });
    }
  });

  return app;
}

export async function startServer(port: number = 3002): Promise<void> {
  const app = createServer();
  
  app.listen(port, () => {
    logger.info(`Queue Service API running on port ${port}`);
  });
}

