import { Kafka, KafkaConfig, Producer, Consumer, Admin } from 'kafkajs';
import logger from '../utils/logger.js';

interface HealthCheckResult {
  status: string;
  message: string;
  brokerId?: string;
  clusterId?: string;
}

interface TopicConfig {
  topic: string;
  numPartitions: number;
  replicationFactor: number;
  configEntries: Array<{ name: string; value: string }>;
}

export class KafkaClient {
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private isConnected: boolean = false;

  initialize(): Kafka {
    try {
      const kafkaConfig: KafkaConfig = {
        clientId: 'hippo-queue-service',
        brokers: [process.env.KAFKA_BROKER || 'kafka:29092'],
        retry: {
          initialRetryTime: 100,
          retries: 8,
          multiplier: 2,
          maxRetryTime: 30000
        },
        connectionTimeout: 3000,
        requestTimeout: 30000
      };

      this.kafka = new Kafka(kafkaConfig);

      logger.info('Kafka client initialized');
      return this.kafka;
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
        allowAutoTopicCreation: true,
        transactionTimeout: 30000
      });

      await this.producer.connect();
      this.isConnected = true;
      logger.info('Kafka producer connected');

      // Handle producer errors
      this.producer.on('producer.disconnect', () => {
        logger.warn('Kafka producer disconnected');
        this.isConnected = false;
      });

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
        groupId: groupId || 'hippo-queue-consumer-group',
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

  async createTopics(topics: string[]): Promise<void> {
    try {
      if (!this.kafka) {
        this.initialize();
      }

      if (!this.kafka) {
        throw new Error('Kafka client not initialized');
      }

      const admin: Admin = this.kafka.admin();
      await admin.connect();

      const topicConfigs: TopicConfig[] = topics.map(topic => ({
        topic: topic,
        numPartitions: 1,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'compression.type', value: 'snappy' }
        ]
      }));

      await admin.createTopics({
        topics: topicConfigs,
        waitForLeaders: true
      });

      logger.info(`Kafka topics created: ${topics.join(', ')}`);
      await admin.disconnect();
    } catch (error) {
      // Topic might already exist, which is fine
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('TopicExistsException')) {
        logger.info(`Kafka topics already exist: ${topics.join(', ')}`);
      } else {
        logger.error(`Failed to create Kafka topics: ${errorMessage}`);
        throw error;
      }
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

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      if (!this.kafka) {
        return { status: 'uninitialized', message: 'Kafka client not initialized' };
      }

      const admin: Admin = this.kafka.admin();
      await admin.connect();
      const metadata = await admin.describeCluster();
      await admin.disconnect();

      return {
        status: 'healthy',
        message: 'Kafka is accessible',
        brokerId: metadata.brokers.length > 0 ? metadata.brokers[0].nodeId.toString() : undefined,
        clusterId: metadata.clusterId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'unhealthy', message: errorMessage };
    }
  }
}

// Singleton instance
const kafkaClient = new KafkaClient();

export default kafkaClient;

