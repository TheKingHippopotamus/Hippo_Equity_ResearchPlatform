/**
 * Property Test: PDF Report Storage
 * Feature: stock-market-dashboard, Property 22: PDF Report Storage
 * Validates: Requirements 8.3
 * 
 * For any PDF report generated, a copy should be stored for audit and
 * retrieval purposes with proper metadata.
 */

import fc from 'fast-check';
import storageService from '../../src/services/storageService.js';
import minioClient from '../../src/config/minio.js';
import postgresClient from '../../src/config/postgres.js';
import { SupportedLanguage } from '../../src/types/models.js';

// Mock dependencies
jest.mock('../../src/config/minio.js');
jest.mock('../../src/config/postgres.js');

const mockedMinioClient = minioClient as jest.Mocked<typeof minioClient>;
const mockedPostgresClient = postgresClient as jest.Mocked<typeof postgresClient>;

describe('Property 22: PDF Report Storage', () => {
  const supportedLanguages: SupportedLanguage[] = ['en', 'es', 'fr', 'de', 'zh', 'he'];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock MinIO client
    const mockMinioClient = {
      putObject: jest.fn().mockResolvedValue(undefined),
      getObject: jest.fn().mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('fake-pdf-data'));
          } else if (event === 'end') {
            callback();
          }
          return {
            on: jest.fn(),
          };
        }),
      }),
    };

    mockedMinioClient.getClient.mockReturnValue(mockMinioClient as any);
    mockedMinioClient.getBucketName.mockReturnValue('reports');

    // Mock PostgreSQL client
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'test-id',
            user_id: 'test-user',
            symbol: 'AAPL',
            language: 'en',
            file_path: 'reports/AAPL/test.pdf',
            file_size: 1024,
            minio_bucket: 'reports',
            minio_object_name: 'reports/AAPL/test.pdf',
            generated_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      }),
    };

    mockedPostgresClient.getPool.mockReturnValue(mockPool as any);
  });

  it('should store PDF with metadata for all supported languages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...supportedLanguages),
        fc.string({ minLength: 1, maxLength: 10 }),
        async (language: SupportedLanguage, symbol: string) => {
          const pdfBuffer = Buffer.from('fake-pdf-data');
          const userId = 'test-user';

          const metadata = await storageService.savePDF(
            pdfBuffer,
            symbol.toUpperCase(),
            language,
            userId
          );

          expect(metadata).toBeDefined();
          expect(metadata.symbol).toBe(symbol.toUpperCase());
          expect(metadata.language).toBe(language);
          expect(metadata.userId).toBe(userId);
          expect(metadata.fileSize).toBe(pdfBuffer.length);
          expect(metadata.minioBucket).toBe('reports');
          expect(metadata.minioObjectName).toContain(symbol.toUpperCase());

          return true;
        }
      ),
      { numRuns: supportedLanguages.length }
    );
  });

  it('should retrieve stored PDF by report ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (reportId: string) => {
          const pdfBuffer = await storageService.getPDF(reportId);

          expect(pdfBuffer).toBeInstanceOf(Buffer);
          expect(pdfBuffer.length).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should retrieve metadata for stored reports', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (reportId: string) => {
          const metadata = await storageService.getMetadata(reportId);

          expect(metadata).toBeDefined();
          expect(metadata?.id).toBeDefined();
          expect(metadata?.symbol).toBeDefined();
          expect(metadata?.language).toBeDefined();
          expect(metadata?.filePath).toBeDefined();

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should list reports for a user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 100 }),
        async (userId: string, limit: number) => {
          const reports = await storageService.listReports(userId, limit);

          expect(Array.isArray(reports)).toBe(true);
          expect(reports.length).toBeLessThanOrEqual(limit);

          if (reports.length > 0) {
            reports.forEach((report) => {
              expect(report.userId).toBe(userId);
              expect(report.id).toBeDefined();
              expect(report.symbol).toBeDefined();
            });
          }

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should store PDFs with unique IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.constantFrom(...supportedLanguages),
        async (symbol: string, language: SupportedLanguage) => {
          const pdfBuffer1 = Buffer.from('pdf-data-1');
          const pdfBuffer2 = Buffer.from('pdf-data-2');
          const userId = 'test-user';

          const metadata1 = await storageService.savePDF(
            pdfBuffer1,
            symbol.toUpperCase(),
            language,
            userId
          );

          const metadata2 = await storageService.savePDF(
            pdfBuffer2,
            symbol.toUpperCase(),
            language,
            userId
          );

          // Verify unique IDs
          expect(metadata1.id).not.toBe(metadata2.id);

          return true;
        }
      ),
      { numRuns: 5 }
    );
  });
});

