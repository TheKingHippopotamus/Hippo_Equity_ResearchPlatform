# Hippo Equity Research Platform

Hippo Equity Research is a production-ready, microservices-based platform for
equity research workflows. It ingests market data, normalizes and caches it,
supports multi-language analysis, and delivers professional PDF reports through
an interactive React dashboard.

## Platform Highlights

- **Market Data Pipeline**: Pulls stock news and financial analysis, normalizes
  to a consistent schema, and caches responses with TTLs.
- **Autopilot Queue**: Batch-processes multiple symbols with FIFO ordering,
  progress tracking, and completion notifications.
- **Multi-Language Coverage**: 6 supported languages (en, es, fr, de, zh, he)
  with persistent user preferences and language-specific caching.
- **Professional PDF Reports**: PDFKit-based reports with charts, branding,
  and a customizable report builder (sections, order, and design presets).
- **Interactive Dashboard**: React + lightweight-charts with timeframe controls,
  chart styles, and TradingView-like options.
- **Reliability & Security**: Structured error logging, input validation,
  HTTPS enforcement, API key support, and sanitized logs.
- **Performance & Scale**: Redis caching, Postgres persistence, query indexes,
  Apache rate limiting, and connection pooling.
- **Observability & Docs**: Health checks, integration tests, and Swagger UI.

## Future Features

- **Kafka Management UI**: Cluster health, topic controls, and consumer monitoring.
- **Redis Management UI**: Cache visibility, key inspection, and TTL controls.
- **PostgreSQL Management UI**: Query explorer, schema browsing, and performance insights.
- **Apache Management UI**: Proxy rules, TLS status, and rate limit monitoring.

## Architecture

Hippo runs as a microservices stack behind an Apache reverse proxy and an
Express API Gateway.

```
Browser
  -> Apache (TLS, rate limits)
  -> API Gateway
     -> Data Service (ingest + normalize + cache)
     -> Queue Service (autopilot batch processing)
     -> Report Service (PDF generation + storage)
     -> Translation Service (language packs)
     -> User Service (preferences)
  -> PostgreSQL (data + metadata)
  -> Redis (cache + queue status)
  -> Kafka (queue transport)
  -> MinIO (PDF storage)
```

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Kafka, Redis, PostgreSQL, MinIO
- **Frontend**: React, Vite, TypeScript, lightweight-charts, CSS variables
- **PDF**: PDFKit + Canvas
- **Infra**: Apache, Docker, Docker Compose
- **Testing**: Jest, Vitest, fast-check

## Getting Started
## Prerequisites

Before installing the Hippo Equity Research App, ensure you have the following installed:
- **Docker** (version 20.10 or higher)
- **Docker Compose** (version 2.0 or higher)

### Clone

```bash
git clone git@github.com:TheKingHippopotamus/Hippo_Equity_ResearchPlatform.git
cd Hippo_EquityResearch_App
```

### Verify Installation

```bash
docker --version
docker-compose --version
git --version
```

## Quick Installation

```bash
./scripts/install.sh
./scripts/start.sh
```

This script will:
- Check for Docker and Docker Compose
- Create `.env` file from `.env.example`
- Build all Docker images

### Verify Health

```bash
./scripts/check.sh
```

### Run End-to-End Tests (Optional)

```bash
./scripts/test-e2e.sh
```
- This will run comprehensive end-to-end tests to verify everything is working.





## Manual Installation

If you prefer to install manually:

### 1. Create Environment File

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 2. Build Docker Images

```bash
docker-compose build
```

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Check Service Status

```bash
docker-compose ps
```

### 5. View Logs

```bash
docker-compose logs -f
```

### Configuration

- Copy `.env.example` to `.env` if you want to customize settings.
- External API settings are driven by `API_BASE_URL` and `API_KEY` (optional).

## Service URLs

- Frontend: http://localhost:5173
- API Gateway: http://localhost:3000
- Swagger UI: http://localhost:3000/api-docs
- Health Check: http://localhost:3000/health
- MinIO Console: http://localhost:9001

## Ports

| Service | Port | Notes |
| --- | --- | --- |
| Apache | 80/443 | Reverse proxy + TLS |
| API Gateway | 3000 | Public API entry |
| Data Service | 3001 | Market data ingestion |
| Queue Service | 3002 | Autopilot queue |
| Report Service | 3003 | PDF generation |
| Translation Service | 3004 | Language packs |
| User Service | 3005 | Preferences |
| PostgreSQL | 5432 | Data + metadata |
| Redis | 6379 | Cache + status |
| Kafka | 9092 | Queue transport |
| MinIO | 9000/9001 | PDF storage + console |

## API Documentation

- OpenAPI spec: `docs/api/openapi.yaml`
- Swagger UI: http://localhost:3000/api-docs

## License

This repository is proprietary. See `LICENSE`.


# Hippo_Equity_ResearchPlatform
