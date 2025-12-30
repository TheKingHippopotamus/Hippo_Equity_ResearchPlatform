import { KafkaClient } from './kafka.js';

// Kafka Topics Configuration
export const KAFKA_TOPICS = {
  QUEUE_TASKS: 'queue-tasks',
  STOCK_DATA: 'stock-data',
  REPORT_GENERATION: 'report-generation'
} as const;

// Initialize topics on service startup
export async function initializeTopics(kafkaClient: KafkaClient): Promise<string[]> {
  const topics = Object.values(KAFKA_TOPICS);
  await kafkaClient.createTopics(topics);
  return topics;
}

