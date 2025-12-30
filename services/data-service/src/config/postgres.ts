import { Pool } from 'pg';
import logger from '../utils/logger.js';

/**
 * PostgreSQL Client for Data Service
 * Handles connection pooling and database operations
 * Requirements: 8.1, 7.1
 */
class PostgresClient {
  private pool: Pool | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<Pool> {
    try {
      if (this.pool) {
        return this.pool;
      }

      this.pool = new Pool({
        host: process.env.POSTGRES_HOST || 'postgres',
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        database: process.env.POSTGRES_DB || 'hippo_db',
        user: process.env.POSTGRES_USER || 'hippo_user',
        password: process.env.POSTGRES_PASSWORD || 'hippo_password',
        max: 20, // Connection pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      this.pool.on('error', (err: Error) => {
        logger.error(`PostgreSQL Pool Error: ${err.message}`);
        this.isConnected = false;
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      logger.info('PostgreSQL connected successfully');
      
      return this.pool;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to connect to PostgreSQL: ${errorMessage}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('PostgreSQL disconnected');
    }
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('PostgreSQL pool is not connected');
    }
    return this.pool;
  }

  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      if (!this.pool) {
        return { status: 'disconnected', message: 'PostgreSQL pool is not connected' };
      }
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return { status: 'healthy', message: 'PostgreSQL connection is healthy' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'unhealthy', message: errorMessage };
    }
  }

  isPoolConnected(): boolean {
    return this.isConnected && this.pool !== null;
  }
}

// Singleton instance
const postgresClient = new PostgresClient();

export default postgresClient;

