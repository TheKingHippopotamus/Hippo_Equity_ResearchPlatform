import { Consumer, EachMessagePayload } from 'kafkajs';
import logger from '../utils/logger.js';
import reportService from './reportService.js';
import storageService from './storageService.js';
import { ReportConfig, SupportedLanguage } from '../types/models.js';

/**
 * ReportQueueConsumer - Consumes PDF generation requests from Kafka
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
class ReportQueueConsumer {
  private consumer: Consumer | null = null;
  private readonly TOPIC = 'report-generation';

  /**
   * Initialize consumer
   */
  async initialize(consumer: Consumer): Promise<void> {
    this.consumer = consumer;
    logger.info('ReportQueueConsumer initialized');
  }

  /**
   * Start consuming PDF generation requests
   */
  async start(): Promise<void> {
    if (!this.consumer) {
      throw new Error('Consumer not initialized. Call initialize() first.');
    }

    logger.info('Starting report generation consumer...');

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        try {
          if (!message.value) {
            logger.warn('Received message with no value');
            return;
          }

          const request = JSON.parse(message.value.toString()) as {
            symbol: string;
            language: SupportedLanguage;
            userId: string;
            requestId?: string;
            reportConfig?: ReportConfig;
          };

          logger.info(
            `Received PDF generation request for ${request.symbol} (language: ${request.language}, user: ${request.userId})`
          );

          // Generate PDF
          const pdfBuffer = await reportService.generatePDF(
            request.symbol,
            request.language,
            request.userId,
            request.reportConfig
          );

          // Save to storage
          const metadata = await storageService.savePDF(
            pdfBuffer,
            request.symbol,
            request.language,
            request.userId
          );

          logger.info(
            `PDF generated and saved successfully: ${metadata.id} for ${request.symbol}`
          );

          // In production, you might want to publish a completion event
          // or notify the user via Redis Pub/Sub
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`Failed to process PDF generation request: ${errorMessage}`);
          // In production, you might want to publish a failure event
        }
      },
    });

    logger.info('Report generation consumer started');
  }

  /**
   * Stop consuming
   */
  async stop(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
      logger.info('Report generation consumer stopped');
    }
  }
}

// Singleton instance
const reportQueueConsumer = new ReportQueueConsumer();

export default reportQueueConsumer;
