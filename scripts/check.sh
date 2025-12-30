#!/bin/bash

# Hippo Equity Research App - Health Check Script
# This script checks the health of all services

set -e

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
ENV_FILE="$REPO_ROOT/.env"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"

echo "🔍 Hippo Equity Research App - Health Check"
echo "==========================================="
echo ""

# Load environment variables if available
if [ -f "$ENV_FILE" ]; then
    set -a
    . "$ENV_FILE"
    set +a
fi

# Check Docker containers
echo "📦 Checking Docker containers..."
if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
    echo "✅ Docker containers are running"
    docker-compose -f "$COMPOSE_FILE" ps
else
    echo "❌ Some Docker containers are not running"
    docker-compose -f "$COMPOSE_FILE" ps
    exit 1
fi

echo ""
echo "🏥 Checking service health endpoints..."
echo ""

# Function to check health endpoint
check_health() {
    local service_name=$1
    local url=$2
    
    echo -n "   $service_name: "
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo "✅ Healthy"
        return 0
    else
        echo "❌ Unhealthy or not responding"
        return 1
    fi
}

# Check API Gateway health
check_health "API Gateway" "http://localhost:3000/health"

# Check Data Service health
check_health "Data Service" "http://localhost:3001/health"

# Check Report Service health
check_health "Report Service" "http://localhost:3003/health"

# Check Translation Service health
check_health "Translation Service" "http://localhost:3004/health"

# Check User Service health
check_health "User Service" "http://localhost:3005/health"

# Check Frontend
echo -n "   Frontend: "
if curl -s -f "http://localhost:5173" > /dev/null 2>&1; then
    echo "✅ Accessible"
else
    echo "❌ Not accessible"
fi

echo ""
echo "📊 Detailed health status:"
echo "   curl http://localhost:3000/health | jq"
echo ""

# Check infrastructure services
echo "🔧 Checking infrastructure services..."
echo -n "   PostgreSQL: "
if [ -z "${POSTGRES_USER}" ]; then
    echo "⚠️  POSTGRES_USER not set"
else
    if docker exec hippo-postgres pg_isready -U "${POSTGRES_USER}" > /dev/null 2>&1; then
        echo "✅ Ready"
    else
        echo "❌ Not ready"
    fi
fi

echo -n "   Redis: "
if [ -n "${REDIS_PASSWORD}" ]; then
    if docker exec hippo-redis redis-cli -a "${REDIS_PASSWORD}" --raw incr ping > /dev/null 2>&1; then
        echo "✅ Ready"
    else
        echo "❌ Not ready"
    fi
else
    if docker exec hippo-redis redis-cli --raw incr ping > /dev/null 2>&1; then
        echo "✅ Ready"
    else
        echo "❌ Not ready"
    fi
fi

echo -n "   Kafka: "
if docker exec hippo-kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; then
    echo "✅ Ready"
else
    echo "❌ Not ready"
fi

echo -n "   MinIO: "
if curl -s -f "http://localhost:9000/minio/health/live" > /dev/null 2>&1; then
    echo "✅ Ready"
else
    echo "❌ Not ready"
fi

echo ""
echo "✅ Health check complete!"
echo ""
