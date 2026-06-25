#!/bin/bash

# Hippo Equity Research App - Installation Script
# This script installs and sets up the application

set -e

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
ENV_FILE="$REPO_ROOT/.env"
ENV_EXAMPLE="$REPO_ROOT/.env.example"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"

echo "🚀 Hippo Equity Research App - Installation Script"
echo "=================================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "📝 Creating .env file from .env.example..."
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo "✅ .env file created."
    else
        echo "⚠️  .env.example not found. Creating basic .env file..."
        cat > "$ENV_FILE" << EOF
NODE_ENV=development
POSTGRES_DB=change_me
POSTGRES_USER=change_me
POSTGRES_PASSWORD=change_me
REDIS_PASSWORD=change_me
MINIO_ROOT_USER=change_me
MINIO_ROOT_PASSWORD=change_me
DATA_PROVIDER_API_KEY=change_me
DATA_PROVIDER_API_URL=change_me
REALTIME_API_URL=change_me
REALTIME_INSTRUMENT_ID=change_me
REALTIME_DOMAIN_ID=1
EOF
    fi
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🔨 Building Docker images..."
docker-compose -f "$COMPOSE_FILE" build

echo ""
echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Run: ./scripts/start.sh"
echo "   2. Check status: ./scripts/check.sh"
echo ""
