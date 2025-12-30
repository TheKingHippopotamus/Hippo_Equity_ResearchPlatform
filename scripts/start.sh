#!/bin/bash

# Hippo Equity Research App - Start Script
# This script starts all services

set -e

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
ENV_FILE="$REPO_ROOT/.env"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"

echo "🚀 Starting Hippo Equity Research App..."
echo "========================================"
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found. Please run ./scripts/install.sh first."
    exit 1
fi

# No API key required - using public API

echo "🐳 Starting Docker containers..."
docker-compose -f "$COMPOSE_FILE" up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "✅ Services started!"
echo ""
echo "📋 Service URLs:"
echo "   - Frontend: http://localhost:5173"
echo "   - API Gateway: http://localhost:3000"
echo "   - API Documentation: http://localhost:3000/api-docs"
echo "   - Health Check: http://localhost:3000/health"
echo ""
echo "📊 Check service status: ./scripts/check.sh"
echo "📝 View logs: docker-compose logs -f"
echo "🛑 Stop services: docker-compose down"
echo ""
