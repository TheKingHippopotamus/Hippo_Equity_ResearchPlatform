# Report Service

Report Service for PDF generation in Hippo Equity Research App.

## Overview

The Report Service generates professional PDF reports for stock analysis, including:
- Stock summary and current price
- Financial analysis sections
- News articles
- Interactive charts
- Multi-language support
- Company branding

## Features

- **PDF Generation**: Generate comprehensive stock reports using PDFKit
- **Multi-Language Support**: Translate all content to user's preferred language
- **Chart Rendering**: Embed high-quality charts (line, bar, area) in PDFs
- **Logo Support**: Include company logos in reports
- **Storage**: Store PDFs in MinIO and metadata in PostgreSQL
- **Queue Integration**: Process PDF generation requests from Kafka queue

## Requirements Met

- ✅ **Requirement 5.1**: PDF report content completeness
- ✅ **Requirement 5.2**: Company logo and branding
- ✅ **Requirement 5.3**: Multi-language PDF support
- ✅ **Requirement 5.4**: Chart embedding
- ✅ **Requirement 5.5**: PDF download
- ✅ **Requirement 8.3**: PDF storage and metadata

## Architecture

```
┌─────────────────────────────────────────┐
│         Report Service (Port 3003)      │
│  ┌───────────────────────────────────┐  │
│  │  ReportService                    │  │
│  │  - generatePDF()                  │  │
│  │  - includeLogo()                  │  │
│  │  - renderCharts()                 │  │
│  │  - applyBranding()                │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  StorageService                   │  │
│  │  - savePDF()                      │  │
│  │  - getPDF()                       │  │
│  │  - getMetadata()                  │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  ReportQueueConsumer              │  │
│  │  - Consumes Kafka messages        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
            ↓              ↓
    ┌──────────────┐  ┌──────────────┐
    │    MinIO     │  │  PostgreSQL  │
    │  (PDF Files) │  │  (Metadata)  │
    └──────────────┘  └──────────────┘
```

## API Endpoints

### POST /generate
Generate a PDF report for a stock symbol.

**Request Body:**
```json
{
  "symbol": "AAPL",
  "language": "en",
  "userId": "user123"
}
```

**Response:**
```json
{
  "success": true,
  "reportId": "uuid",
  "symbol": "AAPL",
  "language": "en",
  "downloadUrl": "/download/{reportId}",
  "fileSize": 102400,
  "generatedAt": "2024-01-15T10:00:00Z"
}
```

### GET /download/:reportId
Download a generated PDF report.

**Response:** PDF file (application/pdf)

### GET /metadata/:reportId
Get metadata for a report.

**Response:**
```json
{
  "id": "uuid",
  "userId": "user123",
  "symbol": "AAPL",
  "language": "en",
  "filePath": "reports/AAPL/...",
  "fileSize": 102400,
  "generatedAt": "2024-01-15T10:00:00Z",
  "downloadUrl": "/download/{id}"
}
```

### GET /reports
List reports for a user.

**Query Parameters:**
- `userId` (optional): User ID (default: 'anonymous')
- `limit` (optional): Maximum number of reports (default: 50)

## Environment Variables

- `PORT`: Service port (default: 3003)
- `MINIO_ENDPOINT`: MinIO endpoint (default: minio)
- `MINIO_PORT`: MinIO port (default: 9000)
- `MINIO_ACCESS_KEY`: MinIO access key
- `MINIO_SECRET_KEY`: MinIO secret key
- `POSTGRES_HOST`: PostgreSQL host (default: postgres)
- `POSTGRES_PORT`: PostgreSQL port (default: 5432)
- `POSTGRES_DB`: Database name
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password
- `KAFKA_BROKER`: Kafka broker address (default: kafka:29092)
- `DATA_SERVICE_URL`: Data service URL (default: http://data-service:3001)
- `TRANSLATION_SERVICE_URL`: Translation service URL (default: http://translation-service:3004)

## Dependencies

- **pdfkit**: PDF generation
- **canvas**: Chart rendering
- **minio**: Object storage client
- **pg**: PostgreSQL client
- **kafkajs**: Kafka client
- **axios**: HTTP client
- **express**: Web framework

## Testing

### Unit Tests
```bash
npm test
```

### Property Tests
Property tests validate:
- **Property 14**: PDF Report Content Completeness
- **Property 16**: PDF Report Language Translation
- **Property 22**: PDF Report Storage

## Docker

The service is containerized and can be built with:
```bash
docker build -t hippo-report-service .
```

## Integration

The service integrates with:
- **Data Service**: Fetches stock data
- **Translation Service**: Translates content
- **MinIO**: Stores PDF files
- **PostgreSQL**: Stores metadata
- **Kafka**: Receives PDF generation requests

