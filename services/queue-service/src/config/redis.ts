import { createClient } from 'redis';
import logger from '../utils/logger.js';

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

interface HealthCheckResult {
  status: string;
  message: string;
}

class RedisClient {
  private client: ReturnType<typeof createClient> | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<ReturnType<typeof createClient>> {
    try {
      const config = {
        socket: {
          host: process.env.REDIS_HOST || 'redis',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          reconnectStrategy: (retries: number): number | Error => {
            if (retries > 10) {
              logger.error('Redis reconnection attempts exceeded');
              return new Error('Redis reconnection failed');
            }
            return Math.min(retries * 50, 1000);
          }
        },
        password: requireEnv('REDIS_PASSWORD')
      };

      this.client = createClient(config);

      this.client.on('error', (err: Error) => {
        logger.error(`Redis Client Error: ${err.message}`);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connecting...');
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        logger.warn('Redis client reconnecting...');
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to connect to Redis: ${errorMessage}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis client disconnected');
    }
  }

  getClient(): ReturnType<typeof createClient> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    return this.client;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      if (!this.isConnected || !this.client) {
        return { status: 'disconnected', message: 'Redis client is not connected' };
      }
      const result = await this.client.ping();
      return { status: 'healthy', message: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'unhealthy', message: errorMessage };
    }
  }
}

// Singleton instance
const redisClient = new RedisClient();

export default redisClient;
