import 'dotenv/config';
import kafkaClient from './src/config/kafka.js';
import { initializeTopics } from './src/config/kafka-topics.js';
import logger from './src/utils/logger.js';
import queueService from './src/services/queueService.js';
import redisClient from './src/config/redis.js';
import { startServer } from './src/api/server.js';

const PORT = parseInt(process.env.PORT || '3002', 10);

async function startQueueService(): Promise<void> {
  try {
    logger.info('Starting Queue Service...');

    // Connect to Redis
    await redisClient.connect();
    logger.info('Redis connected successfully');

    // Initialize Kafka client
    kafkaClient.initialize();

    // Create required topics
    logger.info('Initializing Kafka topics...');
    await initializeTopics(kafkaClient);
    logger.info('Kafka topics initialized');

    // Initialize queue service (creates producer and consumer)
    await queueService.initialize();
    logger.info('QueueService initialized');

    // Start consuming and processing tasks
    await queueService.startConsumer();
    logger.info('Queue Service started successfully and processing tasks');

    // Start Express API server
    await startServer(PORT);
    logger.info(`Queue Service API started on port ${PORT}`);

    // Graceful shutdown handlers
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing queue service');
      await queueService.disconnect();
      await kafkaClient.disconnect();
      await redisClient.disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT signal received: closing queue service');
      await queueService.disconnect();
      await kafkaClient.disconnect();
      await redisClient.disconnect();
      process.exit(0);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to start Queue Service: ${errorMessage}`);
    process.exit(1);
  }
}

// Start the service
startQueueService().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`Fatal error: ${errorMessage}`);
  process.exit(1);
});

export { startQueueService };
export { default as queueService } from './src/services/queueService.js';

