import { Client } from 'minio';
import logger from '../utils/logger.js';

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const requireEitherEnv = (primary: string, secondary: string): string => {
  const value = process.env[primary] || process.env[secondary];
  if (!value) {
    throw new Error(`Missing required environment variable: ${primary} or ${secondary}`);
  }
  return value;
};

class MinioClient {
  private client: Client | null = null;
  private bucketName: string = 'reports';
  private isConnected: boolean = false;

  async connect(): Promise<Client> {
    try {
      this.client = new Client({
        endPoint: process.env.MINIO_ENDPOINT || 'minio',
        port: parseInt(process.env.MINIO_PORT || '9000', 10),
        useSSL: false,
        accessKey: requireEitherEnv('MINIO_ACCESS_KEY', 'MINIO_ROOT_USER'),
        secretKey: requireEitherEnv('MINIO_SECRET_KEY', 'MINIO_ROOT_PASSWORD'),
      });

      // Ensure bucket exists
      const bucketExists = await this.client.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.client.makeBucket(this.bucketName, 'us-east-1');
        logger.info(`Created MinIO bucket: ${this.bucketName}`);
      }

      this.isConnected = true;
      logger.info('MinIO connected successfully');
      
      return this.client;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to connect to MinIO: ${errorMessage}`);
      throw error;
    }
  }

  getClient(): Client {
    if (!this.client || !this.isConnected) {
      throw new Error('MinIO client is not connected');
    }
    return this.client;
  }

  getBucketName(): string {
    return this.bucketName;
  }

  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      if (!this.isConnected || !this.client) {
        return { status: 'disconnected', message: 'MinIO client is not connected' };
      }
      // List buckets to test connection
      await this.client.listBuckets();
      return { status: 'healthy', message: 'MinIO connection is healthy' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'unhealthy', message: errorMessage };
    }
  }
}

// Singleton instance
const minioClient = new MinioClient();

export default minioClient;
