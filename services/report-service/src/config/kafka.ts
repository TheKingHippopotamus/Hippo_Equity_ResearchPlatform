import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import logger from '../utils/logger.js';

export class KafkaClient {
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private isConnected: boolean = false;

  initialize(): void {
    try {
      const brokers = (process.env.KAFKA_BROKER || 'kafka:29092').split(',');
      
      this.kafka = new Kafka({
        clientId: 'hippo-report-service',
        brokers,
        retry: {
          initialRetryTime: 100,
          retries: 8,
        },
      });

      this.isConnected = true;
      logger.info('Kafka client initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initialize Kafka client: ${errorMessage}`);
      throw error;
    }
  }

  async createProducer(): Promise<Producer> {
    try {
      if (!this.kafka) {
        this.initialize();
      }

      if (!this.kafka) {
        throw new Error('Kafka client not initialized');
      }

      this.producer = this.kafka.producer({
        maxInFlightRequests: 1,
        idempotent: true,
        transactionTimeout: 30000,
      });

      await this.producer.connect();
      logger.info('Kafka producer connected');

      return this.producer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to create Kafka producer: ${errorMessage}`);
      throw error;
    }
  }

  async createConsumer(groupId: string, topics: string[]): Promise<Consumer> {
    try {
      if (!this.kafka) {
        this.initialize();
      }

      if (!this.kafka) {
        throw new Error('Kafka client not initialized');
      }

      this.consumer = this.kafka.consumer({
        groupId: groupId || 'hippo-report-consumer-group',
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxBytesPerPartition: 1048576, // 1MB
        minBytes: 1,
        maxBytes: 10485760, // 10MB
        maxWaitTimeInMs: 5000
      });

      await this.consumer.connect();
      logger.info('Kafka consumer connected');

      // Subscribe to topics
      if (topics && topics.length > 0) {
        await this.consumer.subscribe({ topics });
        logger.info(`Kafka consumer subscribed to topics: ${topics.join(', ')}`);
      }

      // Handle consumer errors
      this.consumer.on('consumer.disconnect', () => {
        logger.warn('Kafka consumer disconnected');
        this.isConnected = false;
      });

      return this.consumer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to create Kafka consumer: ${errorMessage}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        logger.info('Kafka producer disconnected');
      }
      if (this.consumer) {
        await this.consumer.disconnect();
        logger.info('Kafka consumer disconnected');
      }
      this.isConnected = false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error disconnecting Kafka: ${errorMessage}`);
    }
  }

  getProducer(): Producer | null {
    return this.producer;
  }

  getConsumer(): Consumer | null {
    return this.consumer;
  }
}

// Singleton instance
const kafkaClient = new KafkaClient();

export default kafkaClient;

