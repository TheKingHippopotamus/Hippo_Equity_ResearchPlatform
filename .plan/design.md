# Design Document: Global Stock Market Dashboard - Hippo Equity Research

## Overview

The Global Stock Market Dashboard - Hippo Equity Researchis a scalable, production-ready web application that aggregates stock market data from multiple APIs and presents it through a responsive, multi-language interface. The system is designed to handle high concurrent load from users worldwide while maintaining sub-2-second response times. Core features include real-time data fetching, queue-based autopilot batch processing, dynamic multi-language support, and professional PDF report generation.

The architecture emphasizes modularity, reusability, and separation of concerns through a component-based UI layer, a service-oriented backend, and a robust data persistence layer.

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer (Browser)                    │
│  React/Vue Components (Reusable Design System)                   │
│  - Stock Display Cards, News Feed, Charts, Language Selector     │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (HTTPS)
┌─────────────────────────────────────────────────────────────────┐
│                    Apache (Reverse Proxy)                        │
│  SSL/TLS Termination, Request Routing, Rate Limiting             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway (Express/FastAPI)                 │
│  Route requests, Rate limiting, CORS, Logging                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Microservices (Docker Containers)               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ Data Service     │  │ Queue Consumer   │  │ Report       │  │
│  │ - API Fetching   │  │ - Kafka Consumer │  │ Service      │  │
│  │ - Normalization  │  │ - Task Processing│  │ - PDF Gen    │  │
│  │ - Caching        │  │ - Store Results  │  │ - Rendering  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ Translation      │  │ User Service     │  │ Kafka        │  │
│  │ Service          │  │ - Preferences    │  │ Producer     │  │
│  │ - Multi-lang     │  │ - Sessions       │  │ - Enqueue    │  │
│  │ - Content Trans  │  │ - Auth           │  │   Tasks      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Message Queue & Cache Layer                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Kafka (Distributed Event Streaming)                     │   │
│  │  - queue-tasks-topic: Autopilot queue (FIFO)             │   │
│  │  - stock-data-topic: API fetch events                    │   │
│  │  - report-generation-topic: PDF requests                 │   │
│  │  - Durable, replay-capable, high throughput              │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Redis (In-Memory Cache & Session Store)                 │   │
│  │  - API response cache (with TTL)                         │   │
│  │  - Session data                                          │   │
│  │  - User preferences                                      │   │
│  │  - Rate limiting counters                                │   │
│  │  - Real-time notifications (Pub/Sub)                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Data Persistence Layer                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ PostgreSQL       │  │ MinIO (S3)       │  │ Logs         │  │
│  │ - Stock Data     │  │ - PDF Reports    │  │ - Audit      │  │
│  │ - User Prefs     │  │ - Images/Logos   │  │ - Events     │  │
│  │ - Reports Meta   │  │ - Backups        │  │ - Analytics  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    External API Layer                            │
│  data provider API (/api/stock-news, /api/quote/financial-analysis) │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack Rationale

**Kafka vs Redis - Clear Separation of Concerns:**

| Component | Purpose | Why |
|-----------|---------|-----|
| **Kafka** | Durable, ordered task queue | FIFO ordering, event replay, persistence, horizontal scaling |
| **Redis** | Fast in-memory cache & sessions | Sub-millisecond latency, TTL support, Pub/Sub, session management |

**Why both?**
- Kafka handles *durable, ordered task processing* (autopilot queue) - tasks must be processed in order and survive restarts
- Redis handles *fast, temporary data* (cache, sessions, rate limits) - needs sub-millisecond latency
- They serve different purposes and complement each other perfectly

**Simplified Stack (Production-Ready):**
- **Frontend**: React/Vue with reusable components
- **API Gateway**: Express.js or FastAPI
- **Microservices**: Data, Queue Consumer, Report, Translation, User services
- **Message Queue**: Kafka (autopilot queue, event streaming)
- **Cache**: Redis (API responses, sessions, rate limiting)
- **Database**: PostgreSQL (persistent data)
- **File Storage**: MinIO (PDF reports, logos)
- **Reverse Proxy**: Nginx (SSL/TLS, routing, rate limiting)

### Request Flow

1. **User Request**: Client sends request for stock data with language preference
2. **API Gateway**: Routes request, applies rate limiting
3. **Cache Check**: Service checks Redis for cached data
4. **API Fetch** (if cache miss): Fetches from data provider API with retry logic
5. **Data Normalization**: Transforms JSON to internal schema
6. **Translation**: Applies language-specific translations
7. **Response**: Returns formatted data to client
8. **Cache Store**: Stores result in Redis with TTL

### Autopilot Queue Flow

1. **User Submits**: User provides list of stock symbols
2. **Kafka Producer**: Enqueues each symbol as a task to `queue-tasks-topic`
3. **Kafka Consumer**: Processes tasks in FIFO order
4. **Data Fetch**: For each task, fetches news and analysis
5. **Store Results**: Saves processed data to PostgreSQL
6. **Notify User**: Updates queue status in Redis, sends notification
7. **Download**: User can view results and generate PDF reports

## Components and Interfaces

### Frontend Components (Reusable)

#### 1. StockCard Component
- Displays current price, change, percentage change
- Shows sentiment indicators
- Responsive layout for mobile/tablet/desktop
- Props: `stockData`, `language`, `onSelect`

#### 2. NewsCard Component
- Displays article title, date, preview, sentiment
- Clickable to expand full content
- Translatable content
- Props: `article`, `language`, `onExpand`

#### 3. ChartComponent
- Renders time-series data (price history, metrics)
- Interactive tooltips
- Responsive sizing
- Props: `data`, `type` (line/bar/area), `timeRange`

#### 4. FinancialMetricsPanel
- Displays organized financial data sections
- Color-coded ratings (1-5 scale)
- Expandable sections
- Props: `analysis`, `language`

#### 5. LanguageSelector
- Dropdown or button group for language selection
- Persists selection to localStorage
- Triggers re-render of all content
- Props: `currentLanguage`, `onLanguageChange`

#### 6. AutopilotQueue
- Shows queue status, progress, ETA
- Displays current processing task
- Lists pending tasks
- Props: `queueState`, `onCancel`

#### 7. PDFReportButton
- Triggers PDF generation
- Shows progress during generation
- Provides download link
- Props: `stockSymbol`, `language`, `onGenerate`

### Backend Services

#### 1. DataService
```
Interface: IDataService
- fetchStockNews(symbol: string): Promise<NewsData[]>
- fetchFinancialAnalysis(symbol: string): Promise<AnalysisData>
- normalizeData(rawData: any): Promise<NormalizedData>
- getCachedData(symbol: string): Promise<NormalizedData | null>
- setCachedData(symbol: string, data: NormalizedData, ttl: number): Promise<void>
```

#### 2. QueueService (Kafka Consumer)
```
Interface: IQueueService
- consumeQueueTasks(): Promise<void>
- processTask(task: QueueTask): Promise<void>
- getQueueStatus(queueId: string): Promise<QueueStatus>
- publishTaskEvent(event: TaskEvent): Promise<void>
```

#### 3. TranslationService
```
Interface: ITranslationService
- setLanguage(language: string): void
- translate(key: string, language: string): string
- translateContent(content: any, language: string): Promise<any>
- getAvailableLanguages(): string[]
- loadLanguagePack(language: string): Promise<void>
```

#### 4. ReportService
```
Interface: IReportService
- generatePDF(symbol: string, language: string): Promise<PDFBuffer>
- includeLogo(pdf: PDFDocument, logoUrl: string): Promise<void>
- renderCharts(pdf: PDFDocument, data: ChartData[]): Promise<void>
- applyBranding(pdf: PDFDocument): Promise<void>
- savePDF(pdf: PDFBuffer, filename: string): Promise<string>
```

#### 5. UserService
```
Interface: IUserService
- setLanguagePreference(userId: string, language: string): Promise<void>
- getLanguagePreference(userId: string): Promise<string>
- createSession(userId: string): Promise<SessionToken>
- validateSession(token: SessionToken): Promise<boolean>
- clearSession(token: SessionToken): Promise<void>
```

#### 6. CacheService
```
Interface: ICacheService
- get(key: string): Promise<any | null>
- set(key: string, value: any, ttl: number): Promise<void>
- delete(key: string): Promise<void>
- clear(): Promise<void>
- exists(key: string): Promise<boolean>
```

## Data Models

### StockData
```typescript
interface StockData {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  priceChange: number;
  priceChangePercent: number;
  tradingDate: string;
  timestamp: string;
}
```

### NewsArticle
```typescript
interface NewsArticle {
  id: string;
  title: string;
  content: string;
  contentPreview: string;
  publishedAt: string;
  sentiment: number; // -2 to 4 scale
  source: string;
  url: string;
  imageUrl?: string;
}
```

### FinancialAnalysis
```typescript
interface FinancialAnalysis {
  symbol: string;
  companyDescription: string;
  competitors: {
    industry: string;
    keyPoints: string[];
    rating: number;
    summary: string;
  };
  financialHealth: {
    keyPoints: string[];
    rating: number;
    summary: string;
  };
  growth: {
    keyPoints: string[];
    rating: number;
    summary: string;
  };
  profitability: {
    keyPoints: string[];
    rating: number;
    summary: string;
  };
  shareholder_returns: {
    keyPoints: string[];
    summary: string;
  };
  valuation: {
    keyPoints: string[];
    rating: number;
    summary: string;
  };
}
```

### QueueTask
```typescript
interface QueueTask {
  id: string;
  symbol: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: ProcessedStockData;
  error?: string;
}
```

### ProcessedStockData
```typescript
interface ProcessedStockData {
  symbol: string;
  stockData: StockData;
  news: NewsArticle[];
  analysis: FinancialAnalysis;
  fetchedAt: string;
}
```

### UserPreferences
```typescript
interface UserPreferences {
  userId: string;
  language: string;
  theme?: 'light' | 'dark';
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: API Response Schema Validation
*For any* JSON response from the data provider API, the parser should validate it against the expected schema and either successfully parse it or reject it with a clear error, never silently accepting malformed data.
**Validates: Requirements 1.2**

### Property 2: Exponential Backoff Retry Timing
*For any* API failure, the system should retry with exponential backoff (1s, 2s, 4s) and stop after exactly 3 attempts, never exceeding the maximum retry count.
**Validates: Requirements 1.3**

### Property 3: Graceful Error Degradation
*For any* API failure with cached data available, the system should return the cached data rather than exposing the raw API error to the user.
**Validates: Requirements 1.4**

### Property 4: Data Normalization Round-Trip
*For any* raw API response, after normalization to the internal schema, the essential fields (symbol, currentPrice, previousClose, tradingDate) should be preserved and retrievable without loss.
**Validates: Requirements 1.5**

### Property 5: Queue FIFO Ordering
*For any* list of stock symbols submitted to the autopilot queue, the processing order should match the submission order exactly, with each symbol processed in sequence.
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 6: Queue Status Accuracy
*For any* autopilot queue in progress, the reported queue position, completion percentage, and current task should accurately reflect the actual processing state.
**Validates: Requirements 2.4**

### Property 7: Queue Completion Notification
*For any* autopilot queue that completes all tasks, the system should notify the user and make all results available for viewing and report generation.
**Validates: Requirements 2.5**

### Property 8: Language Preference Persistence
*For any* user who sets a language preference, that preference should be retrievable on subsequent sessions without requiring re-selection.
**Validates: Requirements 3.2, 8.2**

### Property 9: Multi-Language Content Translation
*For any* stock data displayed in the UI, all text labels, article titles, and analysis descriptions should be translated to the user's selected language without any untranslated strings remaining.
**Validates: Requirements 3.3, 3.4**

### Property 10: Language Switching Without Reload
*For any* user who changes language mid-session, all content should re-render in the new language without requiring a page reload.
**Validates: Requirements 3.5**

### Property 11: Chart Rendering for Time-Series Data
*For any* numerical time-series data (price history, revenue trends), the system should render an interactive chart that accurately represents the data points.
**Validates: Requirements 4.3**

### Property 12: News Card Display Completeness
*For any* news article, the card layout should display title, publication date, sentiment rating, and preview text without omitting any required field.
**Validates: Requirements 4.4**

### Property 13: Responsive Design Usability
*For any* viewport size (mobile, tablet, desktop), the interface should maintain readability and usability without horizontal scrolling or content overflow.
**Validates: Requirements 4.5**

### Property 14: PDF Report Content Completeness
*For any* PDF report generated, the document should contain stock summary, current price, news articles, and financial analysis sections without missing sections.
**Validates: Requirements 5.1**

### Property 15: PDF Report Branding Consistency
*For any* PDF report generated, the document should include company logo, consistent branding, and professional formatting throughout.
**Validates: Requirements 5.2**

### Property 16: PDF Report Language Translation
*For any* PDF report generated for a user with a non-English language preference, all text content should be rendered in the selected language.
**Validates: Requirements 5.3**

### Property 17: PDF Chart Embedding
*For any* chart included in a PDF report, it should be rendered as a high-quality image embedded in the document without external dependencies.
**Validates: Requirements 5.4**

### Property 18: Concurrent Request Language Isolation
*For any* two concurrent requests from different users with different language preferences, each should receive data translated to their respective language without cross-contamination.
**Validates: Requirements 7.1**

### Property 19: Cache TTL Expiration
*For any* cached stock data with a TTL, after the TTL expires, subsequent requests should fetch fresh data from the API rather than returning stale cached data.
**Validates: Requirements 7.2**

### Property 20: Rate Limiting Under High Load
*For any* system experiencing high concurrent load, rate limiting should be applied to prevent service degradation while maintaining fairness across requests.
**Validates: Requirements 7.4**

### Property 21: Stock Data Persistence with Timestamps
*For any* stock data fetched, it should be persisted to the database with accurate timestamps for historical tracking and retrieval.
**Validates: Requirements 8.1**

### Property 22: PDF Report Storage
*For any* PDF report generated, a copy should be stored for audit and retrieval purposes with proper metadata.
**Validates: Requirements 8.3**

### Property 23: Database Query Consistency
*For any* database query, the results should be consistent across multiple executions with the same parameters, maintaining data integrity.
**Validates: Requirements 8.4**

### Property 24: User-Friendly Error Messages
*For any* API failure, the system should display a user-friendly error message explaining the issue and suggesting next steps, never exposing raw API errors or stack traces.
**Validates: Requirements 9.1**

### Property 25: Input Validation Feedback
*For any* invalid user input, the system should provide inline validation feedback before submission, preventing invalid data from being processed.
**Validates: Requirements 9.5**

### Property 26: HTTPS Encryption
*For any* user data transmission, the system should use HTTPS encryption for all communications, never transmitting sensitive data over unencrypted connections.
**Validates: Requirements 10.1**

### Property 27: Sensitive Data Logging Protection
*For any* system logs or error messages, sensitive user information should not be exposed, protecting user privacy.
**Validates: Requirements 10.2**

### Property 28: API Key Security
*For any* API key used by the system, it should be stored securely in environment variables, never appearing in source code or configuration files.
**Validates: Requirements 10.3**

### Property 29: Session Data Cleanup
*For any* user session that ends, session data should be cleared and re-authentication should be required for sensitive operations.
**Validates: Requirements 10.4**

## Error Handling

### API Failures
- **Retry Strategy**: Exponential backoff (1s, 2s, 4s) with max 3 attempts
- **Fallback**: Return cached data if available, otherwise display error message
- **Logging**: Log all API failures with timestamp, endpoint, and error details

### Queue Processing Errors
- **Task Failure**: Mark task as failed, log error, continue with next task
- **User Notification**: Display error in queue status UI with retry option
- **Recovery**: Allow user to retry failed tasks individually

### Translation Errors
- **Missing Translations**: Fall back to English or display key name
- **Invalid Language**: Default to English and log warning
- **Partial Translations**: Display available translations, mark missing content

### PDF Generation Errors
- **Missing Data**: Generate report with available data, note missing sections
- **Chart Rendering**: Skip charts if rendering fails, continue with text content
- **File System**: Retry save operation, provide error message if persistent

### Database Errors
- **Connection Loss**: Implement connection pooling and retry logic
- **Query Failures**: Log error, return cached data if available
- **Data Integrity**: Implement constraints and validation at application layer

## Testing Strategy

### Unit Testing Approach
- Test individual service methods with mocked dependencies
- Verify data normalization logic with various API response formats
- Test translation service with multiple language packs
- Validate queue operations (enqueue, dequeue, status tracking)
- Test cache operations (get, set, expire, clear)

### Property-Based Testing Approach
- Use **fast-check** (JavaScript) or **Hypothesis** (Python) for property testing
- Configure each property test to run minimum 100 iterations
- Generate random but valid inputs (stock symbols, API responses, language codes)
- Verify properties hold across diverse input combinations
- Tag each test with format: `**Feature: stock-market-dashboard, Property {number}: {property_text}**`

### Integration Testing
- Test end-to-end flows: fetch data → normalize → translate → display
- Test queue processing with multiple symbols
- Test PDF generation with various data combinations
- Test concurrent requests with different language preferences
- Test cache behavior with TTL expiration

### Performance Testing
- Verify response times under 2 seconds for 95th percentile
- Load test with 100+ concurrent users
- Test cache hit rates and effectiveness
- Monitor database query performance
- Test CDN effectiveness for global users

### Security Testing
- Verify HTTPS enforcement
- Test API key security (not exposed in logs/errors)
- Validate session management and token expiration
- Test input validation and sanitization
- Verify GDPR/CCPA compliance for user data
