import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import logger from './src/utils/logger.js';
import postgresClient from './src/config/postgres.js';
import minioClient from './src/config/minio.js';
import kafkaClient from './src/config/kafka.js';
import reportService from './src/services/reportService.js';
import storageService from './src/services/storageService.js';
import reportQueueConsumer from './src/services/reportQueueConsumer.js';
import { SupportedLanguage } from './src/types/models.js';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const postgresHealth = await postgresClient.healthCheck();
    const minioHealth = await minioClient.healthCheck();
    
    const isHealthy = postgresHealth.status === 'healthy' && minioHealth.status === 'healthy';
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'report-service',
      postgres: postgresHealth.status,
      minio: minioHealth.status,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Health check failed: ${errorMessage}`);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'report-service',
      error: errorMessage,
    });
  }
});

// Generate PDF report
app.post('/generate', async (req: Request, res: Response) => {
  try {
    const { symbol, language = 'en', userId = 'anonymous', reportConfig } = req.body;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: 'Invalid symbol',
        message: 'Stock symbol is required',
      });
    }

    // Validate language
    const supportedLanguages: SupportedLanguage[] = ['en', 'es', 'fr', 'de', 'zh', 'he'];
    const validLanguage = supportedLanguages.includes(language as SupportedLanguage)
      ? (language as SupportedLanguage)
      : 'en';

    logger.info(`PDF generation requested for ${symbol} (language: ${validLanguage}, user: ${userId})`);

    // Generate PDF
    const pdfBuffer = await reportService.generatePDF(
      symbol.toUpperCase(),
      validLanguage,
      userId,
      reportConfig
    );

    // Save to storage
    const metadata = await storageService.savePDF(pdfBuffer, symbol.toUpperCase(), validLanguage, userId);

    // Return metadata with download URL
    res.json({
      success: true,
      reportId: metadata.id,
      symbol: metadata.symbol,
      language: metadata.language,
      downloadUrl: `/download/${metadata.id}`,
      fileSize: metadata.fileSize,
      generatedAt: metadata.generatedAt,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error generating PDF: ${errorMessage}`);
    
    res.status(500).json({
      error: 'Failed to generate PDF',
      message: 'An error occurred while generating the PDF report. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Download PDF report
app.get('/download/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    if (!reportId || typeof reportId !== 'string') {
      return res.status(400).json({
        error: 'Invalid report ID',
        message: 'Report ID is required',
      });
    }

    // Get metadata
    const metadata = await storageService.getMetadata(reportId);
    if (!metadata) {
      return res.status(404).json({
        error: 'Report not found',
        message: `Report with ID ${reportId} was not found`,
      });
    }

    // Retrieve PDF
    const pdfBuffer = await storageService.getPDF(reportId);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${metadata.symbol}_report_${metadata.generatedAt.split('T')[0]}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    // Send PDF
    res.send(pdfBuffer);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error downloading PDF: ${errorMessage}`);
    
    res.status(500).json({
      error: 'Failed to download PDF',
      message: 'An error occurred while downloading the PDF report. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Get report metadata
app.get('/metadata/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    if (!reportId || typeof reportId !== 'string') {
      return res.status(400).json({
        error: 'Invalid report ID',
        message: 'Report ID is required',
      });
    }

    const metadata = await storageService.getMetadata(reportId);
    if (!metadata) {
      return res.status(404).json({
        error: 'Report not found',
        message: `Report with ID ${reportId} was not found`,
      });
    }

    res.json({
      ...metadata,
      downloadUrl: `/download/${metadata.id}`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error getting metadata: ${errorMessage}`);
    
    res.status(500).json({
      error: 'Failed to get metadata',
      message: 'An error occurred while retrieving report metadata. Please try again later.',
    });
  }
});

// List reports for a user
app.get('/reports', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'anonymous';
    const limit = parseInt((req.query.limit as string) || '50', 10);

    const reports = await storageService.listReports(userId, limit);

    res.json({
      userId,
      count: reports.length,
      reports: reports.map((report) => ({
        ...report,
        downloadUrl: `/download/${report.id}`,
      })),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error listing reports: ${errorMessage}`);
    
    res.status(500).json({
      error: 'Failed to list reports',
      message: 'An error occurred while listing reports. Please try again later.',
    });
  }
});

// Initialize connections and start server
async function startServer() {
  try {
    // Connect to PostgreSQL
    await postgresClient.connect();
    logger.info('PostgreSQL connected successfully');

    // Connect to MinIO
    await minioClient.connect();
    logger.info('MinIO connected successfully');

    // Initialize Kafka client
    kafkaClient.initialize();
    logger.info('Kafka client initialized');

    // Create Kafka consumer for report generation queue
    const consumer = await kafkaClient.createConsumer(
      'hippo-report-consumer-group',
      ['report-generation']
    );
    await reportQueueConsumer.initialize(consumer);
    await reportQueueConsumer.start();
    logger.info('Report queue consumer started');

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Report Service running on port ${PORT}`);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to start server: ${errorMessage}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await reportQueueConsumer.stop();
  await kafkaClient.disconnect();
  await postgresClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await reportQueueConsumer.stop();
  await kafkaClient.disconnect();
  await postgresClient.disconnect();
  process.exit(0);
});

// Start the server
startServer();

export default app;
