# System Flow: From Clone to Running
## Diagram (runtime traffic)

### Runtime Architecture Diagram
![Runtime Diagram](../frontend/public/static/images/hippo_system_flow_diagram.png)
## 1) Clone and prerequisites (user action)

1. Clone the repository:
   ```bash
   git clone git@github.com:TheKingHippopotamus/Hippo_Equity_ResearchPlatform.git
   cd Hippo_EquityResearch_App
   ```
2. Ensure these are installed on your machine:
   - Docker Engine 20.10+
   - Docker Compose v2+
   - Git

Nothing runs automatically during clone. All services start only after you run
the install/start scripts.

## 2) Environment setup (user action required)

Create and edit `.env` before the first boot:

```bash
cp .env.example .env
```

Open `.env` and set real values. These are required for a clean boot:

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
  - Used by the PostgreSQL container and all services that connect to it.
- `REDIS_PASSWORD`
  - Used by the Redis container and services that authenticate to Redis.
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
  - Used by the MinIO container and the report service for object storage.
- `DATA_PROVIDER_API_KEY`
  - Optional. If your data provider requires a key, set it here.
- `DATA_PROVIDER_API_URL`
  - Optional. Defaults to the provider used by the data service.

You can choose any values you want for these credentials as long as they are
non-empty. Use strong passwords, and prefer simple characters (letters, digits,
underscores) to avoid shell parsing issues.

Important: the first time Postgres and MinIO start, they initialize from these
values and store data in Docker volumes. If you change credentials later, the
running services will not match the stored values. In that case, either update
the credentials inside those services or recreate the volumes.

If you skip these values, containers may still start but data access or auth
will fail. This is the most common reason for first-boot errors.

## 3) Install script flow (what happens behind the scenes)

Run:

```bash
./scripts/install.sh
```

Behind the scenes, the script:

1. Checks `docker` and `docker-compose` are available in PATH.
2. Creates `.env` from `.env.example` if `.env` does not exist.
3. Runs `docker-compose build` to build all app images.

Images built from Dockerfiles:

- `docker/apache` (Apache reverse proxy)
  - Installs OpenSSL and enables proxy + SSL modules.
- `services/*` (Node.js services)
  - `npm install` (including dev deps), build TypeScript, then `npm prune --production`.
- `frontend` (React + Vite)
  - Multi-stage build to static files served by Nginx.

## 4) Start script flow (what happens behind the scenes)

Run:

```bash
./scripts/start.sh
```

Behind the scenes, the script:

1. Verifies `.env` exists (fails fast if missing).
2. Runs `docker-compose up -d` to start all services.
3. Waits 10 seconds and prints service URLs.

Docker Compose also:

- Creates the `hippo-network` bridge network for service-to-service traffic.
- Creates named volumes for persistence:
  - `postgres_data`, `redis_data`, `kafka_data`, `minio_data`

## 5) First boot sequence (container by container)

The following is the normal startup flow when containers come online.

1. **PostgreSQL**
   - Uses `POSTGRES_*` env values to create the DB and user.
   - Runs `docker/postgres/init.sql` on first boot.
   - Creates schemas and applies `docker/postgres/migrations/001_initial_schema.sql`.
2. **Redis**
   - Starts with `--requirepass ${REDIS_PASSWORD}`.
   - Persists data to the `redis_data` volume.
3. **Zookeeper + Kafka**
   - Zookeeper starts first.
   - Kafka connects to Zookeeper and binds ports 9092/9093.
4. **MinIO**
   - Starts object storage at port 9000 and admin console at 9001.
   - Uses `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`.
5. **API Gateway**
   - Connects to Redis and Postgres using `.env` values.
   - Serves the public API on port 3000.
6. **Data Service**
   - Connects to Redis and Postgres.
   - Uses `DATA_PROVIDER_API_URL` (and `DATA_PROVIDER_API_KEY` if required).
   - Calls the Translation Service for localized content.
7. **Queue Service**
   - Connects to Kafka, Redis, and Postgres.
   - Processes autopilot batch jobs asynchronously.
8. **Report Service**
   - Connects to MinIO for PDF storage.
   - Connects to Postgres for report metadata.
   - Pulls data from Data Service and translations from Translation Service.
9. **Translation Service**
   - Serves language translations on port 3004.
10. **User Service**
    - Stores user preferences in Postgres and caches in Redis.
11. **Apache Reverse Proxy**
    - Proxies `/api/*` to the API Gateway.
    - Enforces HTTPS and rate limiting (100 req/min with burst 20).
    - If SSL files are missing, `docker/apache/entrypoint.sh` generates a
      self-signed cert at `docker/apache/ssl/server.crt` and `server.key`.
12. **Frontend (Nginx)**
    - Serves the built React app at http://localhost:5173.

## 6) Runtime request flows (what happens when you use the app)

- **Browser load**
  - Browser -> Nginx (frontend container) -> static app assets.
- **API calls (direct)**
  - Browser -> API Gateway (port 3000).
- **API calls (via Apache + TLS)**
  - Browser -> Apache (port 443) -> API Gateway.
  - If using HTTPS with a self-signed cert, the browser will show a warning;
    you must accept it to proceed.
- **Stock data**
  - API Gateway -> Data Service -> external provider -> Redis cache + Postgres.
- **Translations**
  - Data Service / Report Service -> Translation Service.
- **Autopilot queue**
  - API Gateway -> Queue Service -> Kafka -> worker processing -> Redis/Postgres.
- **PDF reports**
  - API Gateway -> Report Service -> Data/Translation -> MinIO object store +
    Postgres metadata.
- **User preferences**
  - API Gateway -> User Service -> Postgres + Redis.

## 7) User inputs and prompts you will see

- **.env credentials (required)**
  - You must set real values for database, Redis, and MinIO before first boot.
- **Data provider API URL (l)**
  - If your data provider requires a key, set `DATA_PROVIDER_API_KEY`.
- **HTTPS trust prompt (optional)**
  - If you access `https://localhost` with a self-signed cert, your browser will
    show a security warning. Accept the cert to continue.

## 8) Verifying the system

Run the health check:

```bash
./scripts/check.sh
```

This script:
- Confirms containers are running.
- Calls health endpoints for each service.
- Tests Postgres, Redis, Kafka, and MinIO readiness.

## 9) Shutting down

```bash
docker-compose down
```

This stops containers but preserves data in Docker volumes. To wipe all data,
use `docker-compose down -v` (this removes volumes).


#  
