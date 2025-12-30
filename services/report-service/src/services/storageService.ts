import { v4 as uuidv4 } from 'uuid';
import minioClient from '../config/minio.js';
import postgresClient from '../config/postgres.js';
import logger from '../utils/logger.js';
import { ReportMetadata, SupportedLanguage } from '../types/models.js';

/**
 * StorageService - Handles PDF storage in MinIO and metadata in PostgreSQL
 * Requirements: 5.5, 8.3
 */
class StorageService {
  /**
   * Save PDF to MinIO and store metadata in PostgreSQL
   * Property 22: PDF Report Storage
   * Requirements: 8.3
   * 
   * @param pdfBuffer PDF file buffer
   * @param symbol Stock symbol
   * @param language Language code
   * @param userId User ID
   * @returns Report metadata
   */
  async savePDF(
    pdfBuffer: Buffer,
    symbol: string,
    language: SupportedLanguage,
    userId: string = 'anonymous'
  ): Promise<ReportMetadata> {
    logger.info(`Saving PDF for ${symbol} (language: ${language}, user: ${userId})`);

    try {
      await postgresClient.ensureConnected();
      const reportId = uuidv4();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const objectName = `reports/${symbol}/${timestamp}_${reportId}.pdf`;
      const bucketName = minioClient.getBucketName();

      // Upload to MinIO
      const minio = minioClient.getClient();
      await minio.putObject(bucketName, objectName, pdfBuffer, pdfBuffer.length, {
        'Content-Type': 'application/pdf',
      });

      logger.info(`PDF uploaded to MinIO: ${objectName}`);

      // Store metadata in PostgreSQL
      const pool = postgresClient.getPool();
      const query = `
        INSERT INTO reports_metadata.reports (
          id, user_id, symbol, language, file_path, file_size,
          minio_bucket, minio_object_name, generated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const result = await pool.query(query, [
        reportId,
        userId,
        symbol.toUpperCase(),
        language,
        objectName,
        pdfBuffer.length,
        bucketName,
        objectName,
        new Date(),
      ]);

      const metadata: ReportMetadata = {
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        symbol: result.rows[0].symbol,
        language: result.rows[0].language,
        filePath: result.rows[0].file_path,
        fileSize: result.rows[0].file_size,
        minioBucket: result.rows[0].minio_bucket,
        minioObjectName: result.rows[0].minio_object_name,
        generatedAt: result.rows[0].generated_at.toISOString(),
        createdAt: result.rows[0].created_at.toISOString(),
        updatedAt: result.rows[0].updated_at.toISOString(),
      };

      logger.info(`PDF metadata stored in PostgreSQL: ${reportId}`);
      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to save PDF: ${errorMessage}`);
      throw new Error(`PDF storage failed: ${errorMessage}`);
    }
  }

  /**
   * Retrieve PDF from MinIO
   * Requirements: 5.5
   * 
   * @param reportId Report ID
   * @returns PDF buffer
   */
  async getPDF(reportId: string): Promise<Buffer> {
    logger.info(`Retrieving PDF: ${reportId}`);

    try {
      await postgresClient.ensureConnected();
      // Get metadata from PostgreSQL
      const pool = postgresClient.getPool();
      const metadataQuery = `
        SELECT minio_bucket, minio_object_name
        FROM reports_metadata.reports
        WHERE id = $1
      `;

      const metadataResult = await pool.query(metadataQuery, [reportId]);

      if (metadataResult.rows.length === 0) {
        throw new Error(`Report not found: ${reportId}`);
      }

      const { minio_bucket, minio_object_name } = metadataResult.rows[0];

      // Retrieve from MinIO
      const minio = minioClient.getClient();
      const chunks: Buffer[] = [];

      const stream = await minio.getObject(minio_bucket, minio_object_name);

      return new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        stream.on('error', reject);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to retrieve PDF: ${errorMessage}`);
      throw new Error(`PDF retrieval failed: ${errorMessage}`);
    }
  }

  /**
   * Get report metadata
   * 
   * @param reportId Report ID
   * @returns Report metadata
   */
  async getMetadata(reportId: string): Promise<ReportMetadata | null> {
    try {
      await postgresClient.ensureConnected();
      const pool = postgresClient.getPool();
      const query = `
        SELECT *
        FROM reports_metadata.reports
        WHERE id = $1
      `;

      const result = await pool.query(query, [reportId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        symbol: row.symbol,
        language: row.language,
        filePath: row.file_path,
        fileSize: row.file_size,
        minioBucket: row.minio_bucket,
        minioObjectName: row.minio_object_name,
        generatedAt: row.generated_at.toISOString(),
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get metadata: ${errorMessage}`);
      throw new Error(`Metadata retrieval failed: ${errorMessage}`);
    }
  }

  /**
   * List reports for a user
   * 
   * @param userId User ID
   * @param limit Optional limit
   * @returns Array of report metadata
   */
  async listReports(userId: string, limit: number = 50): Promise<ReportMetadata[]> {
    try {
      await postgresClient.ensureConnected();
      const pool = postgresClient.getPool();
      const query = `
        SELECT *
        FROM reports_metadata.reports
        WHERE user_id = $1
        ORDER BY generated_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);

      return result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        symbol: row.symbol,
        language: row.language,
        filePath: row.file_path,
        fileSize: row.file_size,
        minioBucket: row.minio_bucket,
        minioObjectName: row.minio_object_name,
        generatedAt: row.generated_at.toISOString(),
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to list reports: ${errorMessage}`);
      throw new Error(`Report listing failed: ${errorMessage}`);
    }
  }
}

// Singleton instance
const storageService = new StorageService();

export default storageService;
