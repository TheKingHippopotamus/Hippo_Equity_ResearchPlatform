# Hippo Equity Research - Command Flow

This file lists the recommended command flow after `git clone`, plus service tech notes in logical order.

---

## 1) Prerequisites

- Docker Desktop (or Docker Engine + Compose v2)
- Node.js 18+ (for local dev without Docker)

---

## 2) First-Time Setup

### 2.1 Create environment file

```bash
cp .env.example .env
```

Update `.env` with your real values where needed.

### 2.2 Build all services

```bash
docker compose build
```

### 2.3 Start the full stack

```bash
docker compose up -d
```

---

## 3) Core Platform Services (Docker)

These containers start together with `docker compose up -d`:

- **PostgreSQL**: main relational database
- **Redis**: cache + queue support
- **Kafka** + **Zookeeper**: event/queue backbone
- **MinIO**: object storage for reports
- **API Gateway**: public API entry point
- **Data Service**: market data + news fetching
- **Report Service**: PDF generation
- **Translation Service**: UI and report localization
- **User Service**: language/user settings
- **Queue Service**: background jobs
- **Frontend (Nginx)**: UI
- **Apache**: reverse proxy (if enabled)

---

## 4) Common Operational Commands

### 4.1 Check running containers

```bash
docker compose ps
```

### 4.2 View logs

```bash
docker compose logs -f api-gateway
```

### 4.3 Restart a single service

```bash
docker compose restart data-service
```

### 4.4 Rebuild and restart a single service

```bash
docker compose build report-service
```

```bash
docker compose up -d report-service
```

### 4.5 Stop all services

```bash
docker compose down
```

---

## 5) Service-Specific Commands

### 5.1 PostgreSQL

```bash
docker compose exec postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}
```

```bash
docker compose exec postgres pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}
```

```bash
docker compose exec postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "SELECT NOW();"
```

### 5.2 Redis

```bash
docker compose exec redis redis-cli -a ${REDIS_PASSWORD} ping
```

```bash
docker compose exec redis redis-cli -a ${REDIS_PASSWORD} info
```

```bash
docker compose exec redis redis-cli -a ${REDIS_PASSWORD} set healthcheck ok
```

```bash
docker compose exec redis redis-cli -a ${REDIS_PASSWORD} get healthcheck
```

```bash
docker compose exec redis redis-cli -a ${REDIS_PASSWORD} del healthcheck
```

### 5.3 Kafka + Zookeeper

```bash
docker compose exec kafka kafka-topics.sh --bootstrap-server kafka:9092 --list
```

```bash
docker compose exec kafka kafka-consumer-groups.sh --bootstrap-server kafka:9092 --list
```

```bash
docker compose exec kafka kafka-topics.sh --bootstrap-server kafka:9092 --create --topic healthcheck --partitions 1 --replication-factor 1
```

```bash
docker compose exec kafka kafka-console-producer.sh --bootstrap-server kafka:9092 --topic healthcheck <<< "ok"
```

```bash
docker compose exec kafka kafka-console-consumer.sh --bootstrap-server kafka:9092 --topic healthcheck --from-beginning --max-messages 1
```

```bash
docker compose exec kafka kafka-topics.sh --bootstrap-server kafka:9092 --delete --topic healthcheck
```

```bash
docker compose exec kafka kafka-console-consumer.sh --bootstrap-server kafka:9092 --topic stock-requests --from-beginning
```

```bash
docker compose exec zookeeper zkCli.sh -server zookeeper:2181 ls /
```

### 5.4 MinIO

```bash
docker compose exec minio mc alias set local http://localhost:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}
```

```bash
docker compose exec minio mc ls local
```

```bash
docker compose exec minio mc mb local/healthcheck
```

```bash
docker compose exec minio mc rm --recursive --force local/healthcheck
```

### 5.5 Apache (Reverse Proxy)

```bash
docker compose exec apache httpd -t
```

```bash
docker compose logs -f apache
```

---

## 6) Local Dev (Optional)

If you want to run a service without Docker, use:

```bash
cd services/<service-name>
npm install
npm run dev
```

Example:

```bash
cd services/data-service
npm install
npm run dev
```

---

## 7) Health Check Examples

```bash
curl http://localhost:3000/api/health
```


```bash
curl http://localhost:3000/api/data/stock/AAPL?language=en
```

## Clean Docker Cache 
```bash
docker builder prune -af
```

---

## 8) Troubleshooting Quick Notes

- **Database not found**: ensure `.env` `POSTGRES_DB` matches and Postgres is running.
- **429 errors**: API rate limit in gateway; wait or adjust config in dev.
- **PDF errors**: check report-service logs and MinIO health.







