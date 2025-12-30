#!/bin/bash

# Hippo Equity Research App - Installation Script
# This script installs and sets up the application

set -e

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
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ .env file created."
    else
        echo "⚠️  .env.example not found. Creating basic .env file..."
        cat > .env << EOF
NODE_ENV=development
POSTGRES_DB=hippo_db
POSTGRES_USER=hippo_user
POSTGRES_PASSWORD=hippo_password
REDIS_PASSWORD=redis_password
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
DATA_PROVIDER_API_URL=https://provider.example
EOF
    fi
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🔨 Building Docker images..."
docker-compose build

echo ""
echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Run: ./scripts/start.sh"
echo "   2. Check status: ./scripts/check.sh"
echo ""
